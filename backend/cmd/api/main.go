package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"reflect"
	"strconv"
	"syscall"
	"time"

	// Embed tzdata so Europe/Warsaw works in minimal container images.
	_ "time/tzdata"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/httpapi"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "serve":
		serve(logger)
	case "migrate":
		if err := db.Migrate(context.Background(), os.Getenv("DATABASE_URL")); err != nil {
			logger.Error("migrate failed", "err", err)
			os.Exit(1)
		}
		logger.Info("migrations applied")
	case "seed":
		if err := seed(context.Background(), logger); err != nil {
			logger.Error("seed failed", "err", err)
			os.Exit(1)
		}
	case "sweep":
		if err := sweep(context.Background(), logger); err != nil {
			logger.Error("sweep failed", "err", err)
			os.Exit(1)
		}
	case "retry-invoices":
		if err := retryInvoices(context.Background(), logger); err != nil {
			logger.Error("retry-invoices failed", "err", err)
			os.Exit(1)
		}
	case "promote-admin":
		if len(os.Args) < 3 {
			logger.Error("promote-admin requires an email", "usage", "api promote-admin <email>")
			os.Exit(2)
		}
		if err := promoteAdmin(context.Background(), logger, os.Args[2]); err != nil {
			logger.Error("promote-admin failed", "err", err)
			os.Exit(1)
		}
	case "reference-prices":
		if err := referencePrices(); err != nil {
			logger.Error("reference-prices failed", "err", err)
			os.Exit(1)
		}
	default:
		logger.Error("unknown command", "cmd", cmd, "usage", "api [serve|migrate|seed|sweep|retry-invoices|promote-admin|reference-prices]")
		os.Exit(2)
	}
}

func serve(logger *slog.Logger) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	pool, err := db.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		logger.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	st := store.NewStore(pool)
	pricingConfigID, err := ensureActivePricingConfig(context.Background(), st, logger)
	if err != nil {
		logger.Error("pricing config bootstrap failed", "err", err)
		os.Exit(1)
	}

	strg, err := storage.New()
	if err != nil {
		logger.Error("storage init failed", "err", err)
		os.Exit(1)
	}
	if err := strg.EnsureBucket(context.Background()); err != nil {
		logger.Error("storage bucket bootstrap failed", "err", err)
		os.Exit(1)
	}

	// Payment provider port (plan 05). Only the stub exists until plan 18
	// adds Stripe; PAYMENTS_PROVIDER selects it, defaulting to stub.
	pipeline := &payments.Pipeline{Store: st, Logger: logger}
	publicBaseURL := os.Getenv("PUBLIC_BASE_URL")
	if publicBaseURL == "" {
		publicBaseURL = "http://localhost:3000"
	}
	var provider payments.Provider
	switch name := os.Getenv("PAYMENTS_PROVIDER"); name {
	case "", "stub":
		logger.Warn("payments: stub provider active — no real money moves (plan 18 wires Stripe)")
		provider = payments.NewStub(publicBaseURL, pipeline)
	default:
		logger.Error("unknown PAYMENTS_PROVIDER", "value", name, "known", []string{"stub"})
		os.Exit(1)
	}

	srv := &http.Server{
		Addr: ":" + port,
		Handler: httpapi.NewRouter(httpapi.Config{
			BambuCloudToken: os.Getenv("BAMBU_CLOUD_TOKEN"),
			Logger:          logger,
			Store:           st,
			Storage:         strg,
			Auth: auth.NewService(
				st,
				// Console transport until plan 06 swaps in Resend (launch gate).
				email.ConsoleSender{Logger: logger},
				logger,
				envDurationMinutes("LOGIN_CODE_TTL_MINUTES", 10),
				envDurationDays("SESSION_TTL_DAYS", 30),
			),
			Payments:        provider,
			Pipeline:        pipeline,
			PublicBaseURL:   publicBaseURL,
			CookieSecure:    os.Getenv("COOKIE_SECURE") == "true",
			PricingConfigID: pricingConfigID,
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutdown failed", "err", err)
	}
}

// seed ensures the active pricing-config snapshot matches pricing.Default.
// Idempotent; serve() runs the same bootstrap at startup, so this subcommand
// exists mainly for CI and manual setup.
func seed(ctx context.Context, logger *slog.Logger) error {
	pool, err := db.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	_, err = ensureActivePricingConfig(ctx, store.NewStore(pool), logger)
	return err
}

// sweep runs the file-retention sweep (Coolify scheduled task, plan 03). Reads
// FILE_RETENTION_UNORDERED_DAYS (default 30).
func sweep(ctx context.Context, logger *slog.Logger) error {
	pool, err := db.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	strg, err := storage.New()
	if err != nil {
		return err
	}
	days := 0
	if v := os.Getenv("FILE_RETENTION_UNORDERED_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			days = n
		}
	}
	return storage.RunSweep(ctx, store.NewStore(pool), strg, days, logger)
}

// promoteAdmin flips a verified user's role to 'admin' (plan 07 — the only
// role-escalation path; run it via a Coolify task or locally). Errors when
// the email has no users row (i.e. never completed a login).
func promoteAdmin(ctx context.Context, logger *slog.Logger, email string) error {
	pool, err := db.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	updated, err := store.NewStore(pool).SetUserRoleByEmail(ctx, store.SetUserRoleByEmailParams{
		Email: email,
		Role:  "admin",
	})
	if err != nil {
		return err
	}
	if updated == 0 {
		return fmt.Errorf("no user with email %q (the user must log in once first)", email)
	}
	logger.Info("user promoted to admin", "email", email)
	return nil
}

// retryInvoices lists paid, invoice-eligible orders that have no VAT invoice
// row yet (plan 05 seam). It is a deliberate no-op until plan 18 lands the
// Fakturownia client — then the Coolify scheduled task (plan 03) re-attempts
// issuance after a provider outage.
func retryInvoices(ctx context.Context, logger *slog.Logger) error {
	pool, err := db.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	orders, err := store.NewStore(pool).ListInvoiceableOrders(ctx)
	if err != nil {
		return err
	}
	for _, o := range orders {
		logger.Info("invoice pending (no-op until plan 18)", "orderId", o.ShortID)
	}
	logger.Info("retry-invoices complete", "pending", len(orders))
	return nil
}

// envDurationDays reads a whole-days duration env var with a default.
func envDurationDays(name string, def int) time.Duration {
	return envDuration(name, def, 24*time.Hour)
}

// envDurationMinutes reads a whole-minutes duration env var with a default.
func envDurationMinutes(name string, def int) time.Duration {
	return envDuration(name, def, time.Minute)
}

func envDuration(name string, def int, unit time.Duration) time.Duration {
	if v := os.Getenv(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * unit
		}
	}
	return time.Duration(def) * unit
}

// ensureActivePricingConfig guarantees the DB's active pricing_config_snapshots
// row equals the compiled-in pricing.Default, so the pricing_config_id stamped
// onto quotes always describes the config that actually priced them. Until
// plan 07 makes the engine load config from the DB, the binary is the source
// of truth and the DB row follows it: no active row → insert; active row with
// a different config → replace with a new active snapshot.
func ensureActivePricingConfig(ctx context.Context, st *store.Store, logger *slog.Logger) (uuid.UUID, error) {
	wantJSON, err := json.Marshal(pricing.Default)
	if err != nil {
		return uuid.Nil, err
	}

	row, err := st.GetActivePricingConfig(ctx)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		id, err := st.InsertPricingConfigSnapshot(ctx, store.InsertPricingConfigSnapshotParams{
			Label:    "auto: pricing.Default",
			Config:   wantJSON,
			IsActive: true,
		})
		if err != nil {
			return uuid.Nil, err
		}
		logger.Info("seeded active pricing config", "id", id)
		return id, nil
	case err != nil:
		return uuid.Nil, err
	}

	var stored pricing.Config
	if json.Unmarshal(row.Config, &stored) == nil && reflect.DeepEqual(stored, pricing.Default) {
		return row.ID, nil
	}

	id, err := st.ReplaceActivePricingConfig(ctx, "auto: pricing.Default (superseded "+row.Label+")", wantJSON)
	if err != nil {
		return uuid.Nil, err
	}
	logger.Warn("active pricing config differed from the binary; replaced it",
		"oldId", row.ID, "oldLabel", row.Label, "newId", id)
	return id, nil
}
