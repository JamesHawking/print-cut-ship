package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// setupTestStore migrates and resets a test database, seeds an active
// pricing-config snapshot, and returns a Store plus the snapshot id (handlers
// receive it via Config.PricingConfigID, mirroring the serve() bootstrap).
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
	cfgID, err := st.InsertPricingConfigSnapshot(ctx, store.InsertPricingConfigSnapshotParams{
		Label: "test", Config: []byte(`{}`), IsActive: true,
	})
	if err != nil {
		t.Fatalf("seed pricing config: %v", err)
	}
	return st, cfgID
}

func TestSubmitQuotePersists(t *testing.T) {
	st, cfgID := setupTestStore(t)
	h := testHandler(t, Config{Store: st, PricingConfigID: cfgID}, nil)
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
	h := testHandler(t, Config{Store: st, PricingConfigID: cfgID}, nil)

	quotePart := strings.Replace(validPart, `"metrics"`,
		`"fileName": "plate.stl", "hash": "abc123", "metrics"`, 1)
	for range 2 {
		body := fmt.Sprintf(`{"email": "jan@example.com", "country": "PL", "parts": [%s]}`, quotePart)
		if rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body); rec.Code != http.StatusOK {
			t.Fatalf("submit status %d: %s", rec.Code, rec.Body)
		}
	}

	rec := doJSON(t, h, http.MethodGet, "/api/v1/orders?email=jan%40example.com", "")
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
	if o.FileName != "plate.stl" || o.PartCount != 1 || o.Status != "submitted" ||
		o.GrossTotalPln <= 0 || !strings.HasPrefix(o.QuoteId, "Q-") {
		t.Errorf("order summary wrong: %+v", o)
	}

	// Someone else's email sees nothing.
	rec = doJSON(t, h, http.MethodGet, "/api/v1/orders?email=other%40example.com", "")
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
	h := testHandler(t, Config{Store: st, PricingConfigID: cfgID}, nil)
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
