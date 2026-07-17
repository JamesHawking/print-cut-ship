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
// otherwise silently publish stale marketing prices (plans/seo/02 DoD).
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

func TestPricingPageDatasetShape(t *testing.T) {
	doc, err := buildReferencePrices()
	if err != nil {
		t.Fatal(err)
	}
	// Rate card covers every catalog material at every cube volume.
	if len(doc.RateCard) != len(doc.Catalog.Materials) {
		t.Fatalf("rate card has %d materials, catalog %d",
			len(doc.RateCard), len(doc.Catalog.Materials))
	}
	for id, perVolume := range doc.RateCard {
		if len(perVolume) != len(rateCardVolumes) {
			t.Errorf("%s: %d volumes", id, len(perVolume))
		}
		if perVolume["1"] <= 0 || perVolume["100"] <= perVolume["1"] {
			t.Errorf("%s: implausible cube prices %v", id, perVolume)
		}
	}
	// The discount example actually discounts.
	rows := doc.DiscountExample
	if rows[0].Quantity != 1 || rows[len(rows)-1].Quantity != 50 {
		t.Fatalf("discount example quantities: %+v", rows)
	}
	if rows[len(rows)-1].UnitPln >= rows[0].UnitPln {
		t.Errorf("qty-50 unit not cheaper than qty-1: %+v", rows)
	}
	// The min-order example binds (that is its whole point).
	if doc.MinOrderExample.MinOrderTopUpPln <= 0 {
		t.Errorf("min-order example does not bind: %+v", doc.MinOrderExample)
	}
	if doc.MinOrderExample.UnitPln >= doc.Catalog.Fees.MinOrderPln {
		t.Errorf("min-order example part too expensive to demonstrate the top-up")
	}
	// The after-cutoff scenario ships at least a day later per lead time.
	if len(doc.ShipDateExamples) != 2 {
		t.Fatalf("expected 2 ship-date anchors, got %d", len(doc.ShipDateExamples))
	}
	before, after := doc.ShipDateExamples[0], doc.ShipDateExamples[1]
	if before.AfterCutoff || !after.AfterCutoff {
		t.Fatalf("cutoff flags wrong: %+v / %+v", before, after)
	}
	for lead, beforeISO := range before.ShipISO {
		if after.ShipISO[lead] <= beforeISO {
			t.Errorf("%s: after-cutoff ship %s not later than %s",
				lead, after.ShipISO[lead], beforeISO)
		}
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
