package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib" // database/sql driver "pgx" for goose
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrate applies all pending migrations against url. It opens its own
// database/sql connection (goose needs *sql.DB, not a pgx pool) and closes it
// before returning, so it is safe to call from the `migrate` subcommand and
// from tests independently of the serve-path pool.
func Migrate(ctx context.Context, url string) error {
	if url == "" {
		return fmt.Errorf("db: DATABASE_URL is empty")
	}
	sqlDB, err := sql.Open("pgx", url)
	if err != nil {
		return fmt.Errorf("db: open for migrate: %w", err)
	}
	defer sqlDB.Close()

	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("db: set dialect: %w", err)
	}
	if err := goose.UpContext(ctx, sqlDB, "migrations"); err != nil {
		return fmt.Errorf("db: migrate up: %w", err)
	}
	return nil
}
