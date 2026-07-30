package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// Print options (design project 9deb1493, "Editor Options" turn 2) have to
// survive the whole way from the panel to the shop floor: a customer picks a
// 0.6 mm nozzle in solid orange, and the order the operator prints from has
// to say exactly that. Anything less and we bill for a configuration we
// never build.
func TestPrintOptionsSurviveQuoteToOrder(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	ctx := context.Background()

	hash := strings.Repeat("cd", 32)
	key := "test/" + hash[:8]
	if _, err := st.InsertFile(ctx, store.InsertFileParams{
		FileName: "bracket.stl", FileSizeBytes: 1234, Kind: "stl",
		Hash: &hash, Source: "upload", StorageKey: &key,
	}); err != nil {
		t.Fatalf("insert file: %v", err)
	}
	f, err := st.GetUploadedFileBySha256(ctx, &hash)
	if err != nil {
		t.Fatalf("file id: %v", err)
	}

	part := fmt.Sprintf(`{"fileName": "bracket.stl", "hash": %q, "fileId": %q,
		"metrics": {"volumeCm3": 67.2, "surfaceAreaCm2": 132.8,
		"bboxMm": {"x": 96, "y": 64, "z": 24}, "usedHullFallback": false},
		"process": "petg", "quantity": 2, "leadTime": "express",
		"nozzle": "n06", "infill": "solid", "color": "orange"}`, hash, f.ID.String())
	rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes",
		fmt.Sprintf(`{"email": "opts@example.com", "country": "PL", "parts": [%s], "locale": "pl"}`, part))
	if rec.Code != http.StatusOK {
		t.Fatalf("submit quote status %d: %s", rec.Code, rec.Body)
	}
	var quoted SubmitQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &quoted); err != nil {
		t.Fatal(err)
	}

	// Stored on the quote.
	q, err := st.GetQuoteByShortID(ctx, quoted.QuoteId)
	if err != nil {
		t.Fatalf("read quote: %v", err)
	}
	parts, err := st.GetQuotePartsByQuoteID(ctx, q.ID)
	if err != nil {
		t.Fatalf("read quote parts: %v", err)
	}
	if len(parts) != 1 {
		t.Fatalf("got %d quote parts, want 1", len(parts))
	}
	if parts[0].Nozzle != "n06" || parts[0].Infill != "solid" || parts[0].Color != "orange" {
		t.Errorf("quote part stored %s/%s/%s, want n06/solid/orange",
			parts[0].Nozzle, parts[0].Infill, parts[0].Color)
	}

	// And carried onto the order the shop works from.
	order := createTestOrder(t, h, quoted.QuoteId, "opts@example.com", "")
	o, err := st.GetOrderByShortID(ctx, order.OrderId)
	if err != nil {
		t.Fatalf("read order: %v", err)
	}
	items, err := st.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil {
		t.Fatalf("read order items: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("got %d order items, want 1", len(items))
	}
	if items[0].Nozzle != "n06" || items[0].Infill != "solid" || items[0].Color != "orange" {
		t.Errorf("order item stored %s/%s/%s, want n06/solid/orange",
			items[0].Nozzle, items[0].Infill, items[0].Color)
	}
}

// A part that names no options is stored as the defaults rather than as empty
// strings — a row has to say what was printed, not what went unsaid.
func TestOmittedPrintOptionsStoreDefaults(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "defaults@example.com")

	q, err := st.GetQuoteByShortID(context.Background(), quoteID)
	if err != nil {
		t.Fatalf("read quote: %v", err)
	}
	parts, err := st.GetQuotePartsByQuoteID(context.Background(), q.ID)
	if err != nil {
		t.Fatalf("read quote parts: %v", err)
	}
	if parts[0].Nozzle != pricing.DefaultNozzleID ||
		parts[0].Infill != pricing.DefaultInfillID ||
		parts[0].Color != pricing.DefaultColorID {
		t.Errorf("stored %s/%s/%s, want the defaults",
			parts[0].Nozzle, parts[0].Infill, parts[0].Color)
	}
}

// An id the catalog doesn't know is rejected rather than silently priced as
// the default: the engine's fallback is right for old persisted rows, wrong
// for a live request the shop would have to fulfil.
func TestUnknownPrintOptionRejected(t *testing.T) {
	h, _, _, _ := setupOrdersTest(t)
	body := `{"parts": [{"metrics": {"volumeCm3": 10, "surfaceAreaCm2": 30,
		"bboxMm": {"x": 20, "y": 20, "z": 20}, "usedHullFallback": false},
		"process": "pla", "quantity": 1, "leadTime": "standard", "color": "chartreuse"}]}`
	rec := doJSON(t, h, http.MethodPost, "/api/v1/price", body)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400: %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), string(UnknownPrintOption)) {
		t.Errorf("body %s, want %s", rec.Body, UnknownPrintOption)
	}
}
