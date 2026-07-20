// Package httpapi wires the HTTP surface of the instant-quote backend:
// routing, middleware, and handlers implementing api/openapi.yaml.
// Routes and types are generated from the spec into gen.go (make gen-go).
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
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
	// Email sends transactional mail (plan 06). Nil in unit tests — triggers
	// skip silently, commerce flows never fail on absent mail.
	Email *email.Service
	// Payments moves money through the provider port (plan 05). The stub
	// provider is the interim implementation; Stripe lands in plan 18.
	// Nil disables checkout/refund (500s on those endpoints).
	Payments payments.Provider
	// Pipeline applies provider payment events to orders (the only path that
	// flips paid/refunded). Nil in unit tests without a DB.
	Pipeline *payments.Pipeline
	// PublicBaseURL is the frontend origin used for provider redirect URLs
	// (PUBLIC_BASE_URL, e.g. http://localhost:3001).
	PublicBaseURL string
	// CookieSecure forces the Secure flag on the session cookie even over
	// plain http (COOKIE_SECURE). TLS requests always get Secure.
	CookieSecure bool
	// Pricing is the live-swappable active pricing config (plan 07): readers
	// take one snapshot per request so price and stamped config id can't
	// skew. Nil falls back to pricing.Default with a nil id (DB-less unit
	// tests).
	Pricing *pricing.Holder
	// Now is the clock seam for ship-by/ops derivations (plan 07); nil means
	// time.Now. Tests pin it for deterministic ship-date assertions.
	Now func() time.Time
}

// activePricing returns the current (id, config) pair; the nil-holder
// fallback keeps DB-less unit tests on pricing.Default — golden fixtures pin
// exactly that, so any holder-threading mistake shows up as fixture churn.
func (s *server) activePricing() pricing.Active {
	if s.cfg.Pricing == nil {
		return pricing.Active{ID: uuid.Nil, Cfg: &pricing.Default}
	}
	return s.cfg.Pricing.Get()
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

	return s.routes(r)
}

// routes mounts the health check, the guarded admin group, the dev-only stub
// surface, and the generated OpenAPI routes. Shared with tests so guard/stub
// wiring has a single source of truth.
func (s *server) routes(r chi.Router) http.Handler {
	// Fail-closed guard for every /api/v1/admin/* path (plan 07). Must be the
	// first statement: chi forbids Use after route registration, and this
	// runs after sessionMiddleware by Use order (NewRouter/tests mount it).
	r.Use(adminPrefixGuard)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// The stub provider's fake-checkout confirmation is dev-only surface:
	// registered only when the stub is active, so a Stripe-configured deploy
	// (plan 18) has no synthetic-payment path. Deliberately outside the
	// generated OpenAPI surface — it's not our contract.
	if _, ok := s.cfg.Payments.(*payments.Stub); ok {
		r.Post("/api/v1/payments/stub/complete", s.stubComplete)
	}

	return HandlerFromMux(s, r)
}

type server struct {
	cfg Config
	// makerworldClient overrides the HTTP client in tests; nil = default.
	makerworldClient *http.Client
}

var _ ServerInterface = (*server)(nil)
