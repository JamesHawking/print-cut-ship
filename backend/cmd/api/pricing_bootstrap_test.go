package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// setupPricingBootstrapTest migrates + resets the pricing table only.
func setupPricingBootstrapTest(t *testing.T) (*store.Store, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed bootstrap test")
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
		`TRUNCATE pricing_config_snapshots RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return store.NewStore(pool), pool
}

func discardLogger() *slog.Logger { return slog.New(slog.DiscardHandler) }

// Seed-on-empty: no active row → a Default snapshot is inserted and loaded.
func TestLoadActivePricingConfigSeedsWhenEmpty(t *testing.T) {
	st, pool := setupPricingBootstrapTest(t)
	holder, err := loadActivePricingConfig(context.Background(), st, discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	act := holder.Get()
	if act.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatal("holder id is nil uuid, want the seeded row id")
	}
	if !reflect.DeepEqual(*act.Cfg, pricing.Default) {
		t.Fatal("seeded config != pricing.Default")
	}
	var active int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM pricing_config_snapshots WHERE is_active`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("active rows %d, want 1", active)
	}
}

// DB-wins regression (plan 07 decision 3): an admin-edited active row must
// survive the bootstrap — the old ensureActivePricingConfig clobbered it on
// every restart.
func TestLoadActivePricingConfigKeepsAdminEdit(t *testing.T) {
	st, _ := setupPricingBootstrapTest(t)
	ctx := context.Background()

	// Deep copy — a struct copy would share the Processes slice's backing
	// array with the global pricing.Default and poison sibling tests.
	raw, err := json.Marshal(pricing.Default)
	if err != nil {
		t.Fatal(err)
	}
	var edited pricing.Config
	if err := json.Unmarshal(raw, &edited); err != nil {
		t.Fatal(err)
	}
	edited.Processes[1].PlnPerKg = 80 // PETG rate change, as the editor would
	raw, err = json.Marshal(edited)
	if err != nil {
		t.Fatal(err)
	}
	id, err := st.ReplaceActivePricingConfig(ctx, "admin edit", raw)
	if err != nil {
		t.Fatal(err)
	}

	holder, err := loadActivePricingConfig(ctx, st, discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	act := holder.Get()
	if act.ID != id {
		t.Fatalf("holder id %s, want the admin-edited row %s", act.ID, id)
	}
	if act.Cfg.Processes[1].PlnPerKg != 80 {
		t.Fatalf("admin edit clobbered: PETG rate %v, want 80", act.Cfg.Processes[1].PlnPerKg)
	}
}

// Self-heal: invalid stored JSON is replaced with a fresh Default snapshot,
// loudly, instead of crashing startup.
func TestLoadActivePricingConfigSelfHeals(t *testing.T) {
	st, pool := setupPricingBootstrapTest(t)
	ctx := context.Background()
	if _, err := st.InsertPricingConfigSnapshot(ctx, store.InsertPricingConfigSnapshotParams{
		Label: "corrupt", Config: []byte(`{"Processes": 42}`), IsActive: true,
	}); err != nil {
		t.Fatal(err)
	}

	holder, err := loadActivePricingConfig(ctx, st, discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	act := holder.Get()
	if !reflect.DeepEqual(*act.Cfg, pricing.Default) {
		t.Fatal("self-healed config != pricing.Default")
	}
	var active int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM pricing_config_snapshots WHERE is_active`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("active rows %d, want 1 after self-heal", active)
	}
}
