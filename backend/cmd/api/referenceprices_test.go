package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// The committed frontend JSON must always equal what the current pricing
// config produces — a rate change without `make gen-reference-prices` would
// otherwise silently publish stale marketing prices (seo_prompts/02 DoD).
func TestReferencePricesJSONInSync(t *testing.T) {
	doc, err := buildReferencePrices()
	if err != nil {
		t.Fatal(err)
	}
	wantJSON, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}

	committedPath := filepath.Join(
		"..", "..", "..", "instant-quote", "src", "content", "reference-prices.json")
	committed, err := os.ReadFile(committedPath)
	if err != nil {
		t.Fatalf("committed reference-prices.json unreadable — run `make gen-reference-prices`: %v", err)
	}

	var want, got any
	if err := json.Unmarshal(wantJSON, &want); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(committed, &got); err != nil {
		t.Fatalf("committed reference-prices.json is not valid JSON: %v", err)
	}
	if !reflect.DeepEqual(want, got) {
		t.Errorf("instant-quote/src/content/reference-prices.json is stale — run `make gen-reference-prices` and commit the result")
	}
}

func TestReferencePricesShape(t *testing.T) {
	doc, err := buildReferencePrices()
	if err != nil {
		t.Fatal(err)
	}
	for _, material := range referenceMaterials {
		for _, part := range referenceParts {
			perQty := doc.Prices[material][part.ID]
			if len(perQty) != len(referenceQuantities) {
				t.Fatalf("%s/%s: got %d quantities", material, part.ID, len(perQty))
			}
			// Unit price must not increase with quantity (discount tiers).
			if perQty["10"] > perQty["1"] || perQty["50"] > perQty["10"] {
				t.Errorf("%s/%s: unit prices not non-increasing: %v", material, part.ID, perQty)
			}
			if perQty["1"] <= 0 {
				t.Errorf("%s/%s: non-positive qty-1 price", material, part.ID)
			}
		}
	}
}
