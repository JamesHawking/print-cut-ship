package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
)

// Drift-guard (plan 07 §risks): the PricingConfig spec schema must mirror the
// Go struct's JSON exactly. If plan 14 adds a field without updating the
// spec, this fails the build — the editor can never silently drop it.
func TestPricingConfigSpecMatchesGoStruct(t *testing.T) {
	raw, err := json.Marshal(pricing.Default)
	if err != nil {
		t.Fatal(err)
	}
	// Strict-decode into the generated spec type: unknown fields must fail.
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var spec PricingConfig
	if err := dec.Decode(&spec); err != nil {
		t.Fatalf("spec type does not mirror the Go struct: %v", err)
	}
	// Round-trip back into the Go struct: bit-identical.
	back, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	var round pricing.Config
	if err := json.Unmarshal(back, &round); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(round, pricing.Default) {
		t.Fatalf("round-trip drift:\nwant %+v\ngot  %+v", pricing.Default, round)
	}
}

// editDefault returns pricing.Default with one scalar mutated via a map, as
// JSON ready for the publish endpoint.
func editDefault(t *testing.T, mutate func(map[string]any)) []byte {
	t.Helper()
	raw, err := json.Marshal(pricing.Default)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	mutate(m)
	out, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// publishConfigRec POSTs a config publish request as the admin.
func publishConfigRec(t *testing.T, h http.Handler, admin *http.Cookie, cfg []byte) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"label":  "test edit",
		"config": json.RawMessage(cfg),
	})
	return doJSONCookies(t, h, http.MethodPost, "/api/v1/admin/pricing-config", string(body), admin)
}

func TestAdminPricingConfigPublish(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "pricing@example.com"), "pricing@example.com")
	ctx := context.Background()

	// An order placed under the OLD config (PETG rate 50/kg): its totals are
	// frozen and must survive the swap.
	quoteID := submitTestQuote(t, h, st, "old@example.com")
	order := createTestOrder(t, h, quoteID, "old@example.com", "")
	before, _ := st.GetOrderByShortID(ctx, order.OrderId)

	// Baseline price for the test part.
	base := priceTestPart(t, h)
	beforeQuote, _ := st.GetQuoteByShortID(ctx, quoteID)

	// Publish: PETG 50 → 80/kg (editDefault keeps everything else).
	doubled := editDefault(t, func(m map[string]any) {
		procs := m["Processes"].([]any)
		for _, p := range procs {
			if p.(map[string]any)["ID"] == "petg" {
				p.(map[string]any)["PlnPerKg"] = 80.0
			}
		}
	})
	rec := publishConfigRec(t, h, admin, doubled)
	if rec.Code != http.StatusOK {
		t.Fatalf("publish status %d: %s", rec.Code, rec.Body)
	}
	var published ReplacePricingConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &published); err != nil {
		t.Fatal(err)
	}

	// Live swap, no restart: a fresh /price for a PETG part reflects the rate.
	after := priceTestPart(t, h)
	if after == base {
		t.Fatalf("price unchanged after publish: %v", after)
	}

	// A fresh quote is stamped with the NEW snapshot id.
	newQuoteID := submitTestQuote(t, h, st, "new@example.com")
	newQuote, _ := st.GetQuoteByShortID(ctx, newQuoteID)
	if newQuote.PricingConfigID != published.Id {
		t.Fatalf("quote stamped %s, want new snapshot %s", newQuote.PricingConfigID, published.Id)
	}
	if beforeQuote.PricingConfigID == published.Id {
		t.Fatal("old quote retro-stamped")
	}

	// The old order re-reads unchanged.
	afterOrder, _ := st.GetOrderByShortID(ctx, order.OrderId)
	if afterOrder.GrossTotalGrosze != before.GrossTotalGrosze ||
		!bytes.Equal(afterOrder.PricingSnapshot, before.PricingSnapshot) {
		t.Fatal("old order totals changed after publish")
	}

	// Exactly one active snapshot.
	var active int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM pricing_config_snapshots WHERE is_active`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("active snapshots %d, want 1", active)
	}

	// GET surfaces the new active + history.
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/pricing-config", "", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("get config status %d: %s", rec.Code, rec.Body)
	}
	var view AdminPricingConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.Active.Id != published.Id || len(view.History) < 2 {
		t.Fatalf("active/history wrong: %+v", view)
	}

	// Snapshot by id round-trips.
	rec = doJSONCookies(t, h, http.MethodGet,
		"/api/v1/admin/pricing-config/"+published.Id.String(), "", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("get snapshot status %d: %s", rec.Code, rec.Body)
	}
}

func TestAdminPricingConfigRejects(t *testing.T) {
	h, _, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "pricing2@example.com"), "pricing2@example.com")

	// Unknown key → 400 pricing_config_invalid (strict decode).
	bogus := editDefault(t, func(m map[string]any) { m["BrandNewField"] = 1 })
	rec := publishConfigRec(t, h, admin, bogus)
	assertPricingInvalid(t, rec, "unknown key")

	// Changed process ID list → 400 (formula structure not editable).
	renamed := editDefault(t, func(m map[string]any) {
		m["Processes"].([]any)[0].(map[string]any)["ID"] = "resin"
	})
	rec = publishConfigRec(t, h, admin, renamed)
	assertPricingInvalid(t, rec, "changed id list")

	// Non-positive rate → 400.
	zero := editDefault(t, func(m map[string]any) {
		m["Processes"].([]any)[0].(map[string]any)["PlnPerKg"] = 0
	})
	rec = publishConfigRec(t, h, admin, zero)
	assertPricingInvalid(t, rec, "zero rate")

	// Empty tier list → 400 (InterpolateDiscount reads tiers[0]; an empty
	// list published as active would panic every price call).
	noTiers := editDefault(t, func(m map[string]any) {
		m["DiscountTiers"] = []any{}
	})
	rec = publishConfigRec(t, h, admin, noTiers)
	assertPricingInvalid(t, rec, "empty discount tiers")
}

func assertPricingInvalid(t *testing.T, rec *httptest.ResponseRecorder, why string) {
	t.Helper()
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("%s: status %d, want 400 (%s)", why, rec.Code, rec.Body)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != PricingConfigInvalid {
		t.Fatalf("%s: code %q, want pricing_config_invalid", why, e.Code)
	}
}

// priceTestPart prices a fixed PETG part through the public endpoint. The
// quantity keeps the subtotal above the min-order floor so material-rate
// changes are visible in the gross total.
func priceTestPart(t *testing.T, h http.Handler) float64 {
	t.Helper()
	part := `{"metrics": {"volumeCm3": 100, "surfaceAreaCm2": 130,
		"bboxMm": {"x": 60, "y": 50, "z": 40}, "usedHullFallback": false},
		"process": "petg", "quantity": 10, "leadTime": "standard"}`
	rec := doJSON(t, h, http.MethodPost, "/api/v1/price", `{"parts": [`+part+`]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("price status %d: %s", rec.Code, rec.Body)
	}
	var res PriceResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	return res.Totals.GrossTotalPln
}
