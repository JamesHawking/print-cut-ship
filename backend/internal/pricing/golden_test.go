package pricing

import (
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"
)

// The golden file is generated from the original TypeScript implementation
// (instant-quote/tests/golden/generate.ts). Every output field must match
// exactly — same floats, same strings, same field presence. Regenerate with
//
//	cd instant-quote && bun tests/golden/generate.ts

type goldenFile struct {
	PartQuotes []struct {
		Name     string          `json:"name"`
		Metrics  MeshMetrics     `json:"metrics"`
		Config   PartConfig      `json:"config"`
		Expected json.RawMessage `json:"expected"`
	} `json:"partQuotes"`
	OrderTotals []struct {
		Name     string          `json:"name"`
		Quotes   []PartQuote     `json:"quotes"`
		Expected json.RawMessage `json:"expected"`
	} `json:"orderTotals"`
	Packing []struct {
		Name     string  `json:"name"`
		Pieces   []Piece `json:"pieces"`
		Expected *int    `json:"expected"`
	} `json:"packing"`
}

func loadGolden(t *testing.T) goldenFile {
	t.Helper()
	raw, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatalf("read golden file: %v", err)
	}
	var g goldenFile
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parse golden file: %v", err)
	}
	return g
}

// asTree round-trips a value through JSON into a generic tree, so expected
// (raw TS output) and actual (Go structs) compare on the wire format —
// field names, presence/absence, and exact float64 values.
func asTree(t *testing.T, v any) any {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var tree any
	if err := json.Unmarshal(raw, &tree); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return tree
}

func rawTree(t *testing.T, raw json.RawMessage) any {
	t.Helper()
	var tree any
	if err := json.Unmarshal(raw, &tree); err != nil {
		t.Fatalf("unmarshal expected: %v", err)
	}
	return tree
}

func TestGoldenPartQuotes(t *testing.T) {
	g := loadGolden(t)
	if len(g.PartQuotes) < 1000 {
		t.Fatalf("suspiciously few part-quote cases: %d", len(g.PartQuotes))
	}
	for _, tc := range g.PartQuotes {
		got := asTree(t, Default.ComputePartQuote(tc.Metrics, tc.Config))
		want := rawTree(t, tc.Expected)
		if !reflect.DeepEqual(got, want) {
			gotJSON, _ := json.MarshalIndent(got, "", " ")
			wantJSON, _ := json.MarshalIndent(want, "", " ")
			t.Errorf("%s:\n got: %s\nwant: %s", tc.Name, gotJSON, wantJSON)
		}
	}
}

func TestGoldenOrderTotals(t *testing.T) {
	g := loadGolden(t)
	if len(g.OrderTotals) == 0 {
		t.Fatal("no order-totals cases")
	}
	for _, tc := range g.OrderTotals {
		got := asTree(t, Default.ComputeOrderTotals(tc.Quotes))
		want := rawTree(t, tc.Expected)
		if !reflect.DeepEqual(got, want) {
			gotJSON, _ := json.MarshalIndent(got, "", " ")
			wantJSON, _ := json.MarshalIndent(want, "", " ")
			t.Errorf("%s:\n got: %s\nwant: %s", tc.Name, gotJSON, wantJSON)
		}
	}
}

func TestGoldenPacking(t *testing.T) {
	g := loadGolden(t)
	if len(g.Packing) == 0 {
		t.Fatal("no packing cases")
	}
	for _, tc := range g.Packing {
		got := CountPlates(tc.Pieces, Default.Processes[0].Build, PackOpts{GutterMm: Default.PlateGutterMm})
		switch {
		case got == nil && tc.Expected != nil:
			t.Errorf("%s: got nil, want %d", tc.Name, *tc.Expected)
		case got != nil && tc.Expected == nil:
			t.Errorf("%s: got %d, want nil", tc.Name, *got)
		case got != nil && tc.Expected != nil && *got != *tc.Expected:
			t.Errorf("%s: got %d, want %d", tc.Name, *got, *tc.Expected)
		}
	}
}

// Anchor from the mapi-tech.pl calibration (references/mapi-tech-pricing.md):
// Basket.3mf, thin-walled ribbed PLA, quoted 21.64 zł by the real widget.
// Mirrors the tolerance test in the original tests/pricing.test.ts. (The
// second anchor, test_object.step at 33.67 zł PETG, depends on client-side
// OCCT tessellation for its metrics and stays in the frontend E2E checks;
// engine exactness is already enforced by the golden grid above.)
func TestMapiTechBasketAnchor(t *testing.T) {
	q := Default.ComputePartQuote(
		MeshMetrics{
			VolumeCm3:      63.5,
			SurfaceAreaCm2: 702.58,
			BboxMm:         Vec3{X: 187, Y: 178, Z: 74},
		},
		PartConfig{Process: "pla", Quantity: 1, LeadTime: "standard"},
	)
	if q.Blocked {
		t.Fatal("Basket anchor unexpectedly blocked")
	}
	if diff := math.Abs(q.UnitPricePln-21.64) / 21.64; diff >= 0.01 {
		t.Errorf("Basket anchor: got %v zł, want within 1%% of 21.64 (off by %.2f%%)",
			q.UnitPricePln, diff*100)
	}
}
