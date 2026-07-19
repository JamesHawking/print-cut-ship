package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestGetQuoteReadBack(t *testing.T) {
	st, cfgID := setupTestStore(t)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID)}, nil)

	quotePart := strings.Replace(validPart, `"metrics"`,
		`"fileName": "part.stl", "hash": "abc123", "metrics"`, 1)
	body := fmt.Sprintf(`{"email": "jan@example.com", "country": "PL", "parts": [%s]}`, quotePart)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("submit status %d: %s", rec.Code, rec.Body)
	}
	var submitted SubmitQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &submitted); err != nil {
		t.Fatal(err)
	}

	rec = doJSON(t, h, http.MethodGet, "/api/v1/quotes/"+submitted.QuoteId, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("get status %d: %s", rec.Code, rec.Body)
	}
	var got SubmitQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.QuoteId != submitted.QuoteId {
		t.Errorf("quoteId %q, want %q", got.QuoteId, submitted.QuoteId)
	}
	if got.Totals != submitted.Totals {
		t.Errorf("totals mismatch:\n got %+v\nwant %+v", got.Totals, submitted.Totals)
	}
}

func TestGetQuoteNotFound(t *testing.T) {
	st, cfgID := setupTestStore(t)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID)}, nil)

	rec := doJSON(t, h, http.MethodGet, "/api/v1/quotes/Q-"+strings.ToUpper(uuid.NewString()[:8]), "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d, want 404: %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "quote_not_found") {
		t.Errorf("expected quote_not_found, got %s", rec.Body)
	}
}
