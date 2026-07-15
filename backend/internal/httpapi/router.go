// Package httpapi wires the HTTP surface of the instant-quote backend:
// routing, middleware, and handlers implementing api/openapi.yaml.
// Routes and types are generated from the spec into gen.go (make gen-go).
package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Config struct {
	BambuCloudToken string
	Logger          *slog.Logger
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
