package storage_test

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

func TestRunSweep(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" || os.Getenv("TEST_S3_ENDPOINT") == "" {
		t.Skip("TEST_DATABASE_URL and TEST_S3_ENDPOINT required")
	}
	ctx := context.Background()
	if err := db.Migrate(ctx, dbURL); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	defer pool.Close()
	if _, err := pool.Exec(ctx, `TRUNCATE quote_parts, quotes, step_requests, orders, files, users, pricing_config_snapshots RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	st := store.NewStore(pool)

	t.Setenv("S3_ENDPOINT", os.Getenv("TEST_S3_ENDPOINT"))
	strg, err := storage.New()
	if err != nil {
		t.Fatalf("storage: %v", err)
	}
	if err := strg.EnsureBucket(ctx); err != nil {
		t.Fatalf("bucket: %v", err)
	}

	old := pgtype.Timestamptz{Time: time.Now().AddDate(0, 0, -60), Valid: true}
	backdate := func(id uuid.UUID) {
		if _, err := pool.Exec(ctx, `UPDATE files SET created_at = $1 WHERE id = $2`, old, id); err != nil {
			t.Fatalf("backdate: %v", err)
		}
	}
	insert := func(name string, storageKey *string) uuid.UUID {
		h := name
		id, err := st.InsertFile(ctx, store.InsertFileParams{
			FileName: name, FileSizeBytes: 3, Kind: "3mf", Hash: &h,
			Source: "upload", StorageKey: storageKey,
		})
		if err != nil {
			t.Fatalf("insert %s: %v", name, err)
		}
		return id
	}

	// (a) old, uploaded, unreferenced → swept; object removed.
	unrefKey := storage.Key("aaa", "3mf")
	if err := strg.Put(ctx, unrefKey, bytes.NewReader([]byte("xyz")), 3, "model/3mf"); err != nil {
		t.Fatalf("put: %v", err)
	}
	unref := insert("unref", &unrefKey)
	backdate(unref)

	// (b) old, uploaded, referenced by a step request → kept.
	refKey := storage.Key("bbb", "3mf")
	ref := insert("ref", &refKey)
	backdate(ref)
	if _, err := st.InsertStepRequest(ctx, store.InsertStepRequestParams{
		ShortID: "STEP-REF00001", Email: "a@b.co", FileName: "ref", FileSizeBytes: 3,
		FileID: &ref,
	}); err != nil {
		t.Fatalf("step request: %v", err)
	}

	// (c) old, pending (never confirmed) → swept.
	pending := insert("pending", nil)
	backdate(pending)

	// (d) fresh, uploaded, unreferenced → kept (inside the window).
	freshKey := storage.Key("ddd", "3mf")
	fresh := insert("fresh", &freshKey)

	if err := storage.RunSweep(ctx, st, strg, 30, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("sweep: %v", err)
	}

	deleted := func(id uuid.UUID) bool {
		f, err := st.GetFileByID(ctx, id)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		return f.DeletedAt.Valid
	}
	if !deleted(unref) {
		t.Error("unreferenced old file should be soft-deleted")
	}
	if _, ok, _ := strg.Stat(ctx, unrefKey); ok {
		t.Error("unreferenced object should be removed")
	}
	if deleted(ref) {
		t.Error("referenced file must be kept")
	}
	if !deleted(pending) {
		t.Error("stale pending file should be soft-deleted")
	}
	if deleted(fresh) {
		t.Error("fresh file must be kept")
	}

	// Idempotent: a second run deletes nothing new.
	if err := storage.RunSweep(ctx, st, strg, 30, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("sweep re-run: %v", err)
	}
}
