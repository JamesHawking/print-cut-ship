// Package httpapi wires the HTTP surface of the instant-quote backend:
// routing, middleware, and handlers implementing api/openapi.yaml.
// Routes and types are generated from the spec into gen.go (make gen-go).
package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

type Config struct {
	BambuCloudToken string
	Logger          *slog.Logger
	// Store persists quotes and step-requests. Nil in unit tests, where
	// handlers fall back to log-only behavior.
	Store *store.Store
	// Storage holds uploaded model files. Nil in unit tests; the file
	// endpoints degrade to log-only when absent.
	Storage *storage.Store
	// Auth runs the OTP login flow (plan 04). Nil in unit tests without a DB.
	Auth *auth.Service
	// CookieSecure forces the Secure flag on the session cookie even over
	// plain http (COOKIE_SECURE). TLS requests always get Secure.
	CookieSecure bool
	// PricingConfigID is the active pricing_config_snapshots row verified at
	// startup to equal the compiled-in pricing.Default (see cmd/api). Quotes
	// are stamped with it; plan 07 replaces this with a live-swappable config.
	PricingConfigID uuid.UUID
}

func NewRouter(cfg Config) http.Handler {
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	s := &server{cfg: cfg}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(s.sessionMiddleware)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	return HandlerFromMux(s, r)
}

type server struct {
	cfg Config
	// makerworldClient overrides the HTTP client in tests; nil = default.
	makerworldClient *http.Client
}

var _ ServerInterface = (*server)(nil)
