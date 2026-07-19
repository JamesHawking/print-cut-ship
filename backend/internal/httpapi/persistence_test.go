package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// setupTestStore migrates and resets a test database, seeds an active
// pricing-config snapshot (pricing.Default, mirroring the DB-wins bootstrap),
// and returns a Store plus the snapshot id (handlers receive a holder over it
// via testHolder, mirroring the serve() bootstrap).
// The whole suite is skipped unless TEST_DATABASE_URL points at a throwaway
// Postgres.
func setupTestStore(t *testing.T) (*store.Store, uuid.UUID) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed persistence test")
	}
	ctx := context.Background()
	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx,
		`TRUNCATE quote_parts, quotes, step_requests, orders, files, users, pricing_config_snapshots RESTART IDENTITY CASCADE`,
	); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	st := store.NewStore(pool)
	defJSON, err := json.Marshal(pricing.Default)
	if err != nil {
		t.Fatalf("marshal pricing.Default: %v", err)
	}
	cfgID, err := st.InsertPricingConfigSnapshot(ctx, store.InsertPricingConfigSnapshotParams{
		Label: "test", Config: defJSON, IsActive: true,
	})
	if err != nil {
		t.Fatalf("seed pricing config: %v", err)
	}
	return st, cfgID
}

// testHolder mirrors serve()'s bootstrap: a holder over the seeded snapshot.
func testHolder(cfgID uuid.UUID) *pricing.Holder {
	cfg := pricing.Default
	return pricing.NewHolder(cfgID, &cfg)
}

func TestSubmitQuotePersists(t *testing.T) {
	st, cfgID := setupTestStore(t)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID)}, nil)
	ctx := context.Background()

	quotePart := strings.Replace(validPart, `"metrics"`,
		`"fileName": "part.stl", "hash": "abc123", "metrics"`, 1)
	body := fmt.Sprintf(`{"email": "jan@example.com", "country": "PL", "parts": [%s]}`, quotePart)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var res SubmitQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}

	q, err := st.GetQuoteByShortID(ctx, res.QuoteId)
	if err != nil {
		t.Fatalf("read back quote: %v", err)
	}
	wantGross, err := money.ToGrosze(res.Totals.GrossTotalPln)
	if err != nil {
		t.Fatalf("ToGrosze: %v", err)
	}
	if q.GrossTotalGrosze != wantGross {
		t.Errorf("gross grosze %d, want %d", q.GrossTotalGrosze, wantGross)
	}
	if q.Email == nil || *q.Email != "jan@example.com" {
		t.Errorf("email %v", q.Email)
	}
	if q.UserID != nil {
		t.Errorf("anonymous quote should have nil user_id, got %v", q.UserID)
	}
	parts, err := st.GetQuotePartsByQuoteID(ctx, q.ID)
	if err != nil {
		t.Fatalf("read back parts: %v", err)
	}
	if len(parts) != 1 {
		t.Fatalf("parts len %d, want 1", len(parts))
	}
	if parts[0].UnitPriceGrosze <= 0 || parts[0].Process != "pla" {
		t.Errorf("part row wrong: %+v", parts[0])
	}
}

func TestListOrdersByEmail(t *testing.T) {
	st, cfgID := setupTestStore(t)
	mailer := &captureMailer{}
	svc := auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)
	pipeline := &payments.Pipeline{Store: st, Logger: slog.New(slog.DiscardHandler)}
	h := testHandler(t, Config{
		Store: st, Pricing: testHolder(cfgID), Auth: svc,
		Payments: payments.NewStub("http://test.local", pipeline),
		Pipeline: pipeline, PublicBaseURL: "http://test.local",
	}, nil)

	// Two guest checkouts under the same email (no session on create).
	for range 2 {
		quoteID := submitTestQuote(t, h, st, "jan@example.com")
		createTestOrder(t, h, quoteID, "jan@example.com", "")
	}

	// Anonymous: 401.
	if rec := doJSON(t, h, http.MethodGet, "/api/v1/orders", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous list status %d, want 401", rec.Code)
	}

	session := requestCodeAndVerify(t, h, mailer, "jan@example.com")
	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/orders", "", session)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status %d: %s", rec.Code, rec.Body)
	}
	var res ListOrdersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Orders) != 2 {
		t.Fatalf("orders len %d, want 2", len(res.Orders))
	}
	o := res.Orders[0]
	if o.FileName != "widget.stl" || o.PartCount != 1 || o.Status != "draft" ||
		o.GrossTotalPln <= 0 || !strings.HasPrefix(o.OrderId, "O-") {
		t.Errorf("order summary wrong: %+v", o)
	}

	// Someone else's session sees nothing.
	other := requestCodeAndVerify(t, h, mailer, "other@example.com")
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/orders", "", other)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status %d: %s", rec.Code, rec.Body)
	}
	res = ListOrdersResponse{}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Orders) != 0 {
		t.Errorf("expected empty order list, got %d", len(res.Orders))
	}
}

func TestSubmitStepQuotePersists(t *testing.T) {
	st, cfgID := setupTestStore(t)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID)}, nil)
	ctx := context.Background()

	rec := doJSON(t, h, http.MethodPost, "/api/v1/step-quotes",
		`{"email": "jan@example.com", "fileName": "bracket.step", "fileSize": 12345}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var res StepQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	sr, err := st.GetStepRequestByShortID(ctx, res.RequestId)
	if err != nil {
		t.Fatalf("read back step request: %v", err)
	}
	if sr.FileName != "bracket.step" || sr.FileSizeBytes != 12345 {
		t.Errorf("step request wrong: %+v", sr)
	}
}
