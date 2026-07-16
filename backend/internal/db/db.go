// Package db owns the Postgres connection pool and schema migrations for the
// instant-quote backend. Migrations are embedded SQL run by goose; the serve
// path uses a pgx pool. See Plans/01-persistence.md.
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New opens a pgx pool against url and verifies connectivity. It fails fast so
// a missing or wrong DATABASE_URL surfaces at startup, not on first request.
func New(ctx context.Context, url string) (*pgxpool.Pool, error) {
	if url == "" {
		return nil, fmt.Errorf("db: DATABASE_URL is empty")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("db: open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return pool, nil
}
