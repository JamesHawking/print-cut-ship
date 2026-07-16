package pricing

import "testing"

// The localization contract (Plans/08-i18n.md): every parameterized DFM flag
// carries structured params so the frontend renders localized copy without
// parsing the debug message.

func flagByCode(t *testing.T, q PartQuote, code string) DfmFlag {
	t.Helper()
	for _, f := range q.DfmFlags {
		if f.Code == code {
			return f
		}
	}
	t.Fatalf("flag %q not emitted; got %+v", code, q.DfmFlags)
	return DfmFlag{}
}

func TestDfmFlagParams(t *testing.T) {
	c := &Default
	cfg := PartConfig{Process: "pla", Quantity: 1, LeadTime: "standard"}

	t.Run("min_volume_billed + small_feature", func(t *testing.T) {
		q := c.ComputePartQuote(MeshMetrics{
			VolumeCm3: 0.2, SurfaceAreaCm2: 4, BboxMm: Vec3{X: 10, Y: 10, Z: 0.5},
		}, cfg)
		if p := flagByCode(t, q, "min_volume_billed").Params; p["minCm3"] != c.MinBillableVolumeCm3 {
			t.Errorf("min_volume_billed params = %v", p)
		}
		if p := flagByCode(t, q, "small_feature").Params; p["minDimMm"] != 0.5 {
			t.Errorf("small_feature params = %v", p)
		}
	})

	t.Run("exceeds_build_volume", func(t *testing.T) {
		q := c.ComputePartQuote(MeshMetrics{
			VolumeCm3: 5000, SurfaceAreaCm2: 4000,
			BboxMm: Vec3{X: 900, Y: 900, Z: 900},
		}, cfg)
		p := flagByCode(t, q, "exceeds_build_volume").Params
		proc, _ := c.Process("pla")
		if p["x"] != proc.Build.X || p["y"] != proc.Build.Y || p["z"] != proc.Build.Z {
			t.Errorf("exceeds_build_volume params = %v", p)
		}
	})

	t.Run("multi_plate", func(t *testing.T) {
		pieces := make([]Piece, 0, 8)
		for range 8 {
			pieces = append(pieces, Piece{BboxMm: Vec3{X: 200, Y: 200, Z: 50}})
		}
		q := c.ComputePartQuote(MeshMetrics{
			VolumeCm3: 400, SurfaceAreaCm2: 900,
			BboxMm: Vec3{X: 200, Y: 200, Z: 50}, Pieces: pieces,
		}, cfg)
		p := flagByCode(t, q, "multi_plate").Params
		if p["pieces"] != 8 || p["extraFeePln"] != c.ExtraPlateFeePln {
			t.Errorf("multi_plate params = %v", p)
		}
		if plates, ok := p["plates"].(int); !ok || plates < 2 {
			t.Errorf("multi_plate plates = %v", p["plates"])
		}
		// The plates breakdown line carries its count for localized labels.
		for _, l := range q.Breakdown {
			if l.Key == "plates" && l.Count != plates(t, p)-1 {
				t.Errorf("plates line count = %d, want %d", l.Count, plates(t, p)-1)
			}
		}
	})
}

func plates(t *testing.T, p map[string]any) int {
	t.Helper()
	v, ok := p["plates"].(int)
	if !ok {
		t.Fatalf("plates param missing: %v", p)
	}
	return v
}
