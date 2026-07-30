package pricing

import (
	"math"
	"testing"
)

// The demo bracket in PETG — the same geometry the landing page quotes live
// (instant-quote/src/components/how-it-works/demo.ts, drift-pinned there
// against real mesh analysis). Its default quote is 7.78 zł.
var bracketMetrics = MeshMetrics{
	VolumeCm3:      67.2,
	SurfaceAreaCm2: 132.8,
	BboxMm:         Vec3{X: 96, Y: 64, Z: 24},
}

func bracketConfig() PartConfig {
	return PartConfig{Process: "petg", Quantity: 1, LeadTime: "standard"}
}

// The defaults must be the identity element: a config that names no nozzle,
// infill or colour has to price exactly as it did before those axes existed.
// This is what keeps testdata/golden.json (whose configs predate the fields)
// valid, so it is checked directly rather than only through the golden grid.
func TestUnnamedOptionsPriceAsBefore(t *testing.T) {
	bare := Default.ComputePartQuote(bracketMetrics, bracketConfig())

	explicit := bracketConfig()
	explicit.Nozzle = DefaultNozzleID
	explicit.Infill = DefaultInfillID
	explicit.Color = DefaultColorID
	named := Default.ComputePartQuote(bracketMetrics, explicit)

	if bare.UnitPricePln != named.UnitPricePln {
		t.Errorf("empty ids priced %v, explicit defaults priced %v",
			bare.UnitPricePln, named.UnitPricePln)
	}
	if bare.UnitPricePln != 7.78 {
		t.Errorf("bracket default = %v zł, want 7.78 (the pinned demo value)",
			bare.UnitPricePln)
	}
	if bare.WeightG != named.WeightG || bare.PrintHours != named.PrintHours {
		t.Errorf("weight/hours drift: %v/%v vs %v/%v",
			bare.WeightG, bare.PrintHours, named.WeightG, named.PrintHours)
	}
	// An in-stock colour must not add a breakdown line: the golden fixtures
	// compare breakdown arrays element-wise at a fixed length.
	for _, l := range bare.Breakdown {
		if l.Key == "color" {
			t.Error("in-stock colour emitted a surcharge line")
		}
	}
	// An unknown id falls back to the default rather than to a zero-value
	// definition, whose ×0 multipliers would divide by zero.
	junk := bracketConfig()
	junk.Nozzle, junk.Infill, junk.Color = "nope", "nope", "nope"
	if got := Default.ComputePartQuote(bracketMetrics, junk); got.UnitPricePln != bare.UnitPricePln {
		t.Errorf("unknown ids priced %v, want the default %v", got.UnitPricePln, bare.UnitPricePln)
	}
}

// Infill needs no new pricing constants — the shell+infill model already
// derives weight and print hours from the fraction. These are the numbers
// that model produces, and they are far above the design mock's proposed
// ×0.96/×1/×1.08/×1.45 (see the plan's "Corrections to the mock").
func TestInfillSweep(t *testing.T) {
	cases := []struct {
		id      string
		weightG float64
		hours   float64
		price   float64
	}{
		{"light", 25.7, 2.48, 7.13},
		{"standard", 29.2, 2.68, 7.78},
		{"strong", 43.2, 3.46, 10.37},
		{"solid", 85.3, 5.80, 18.16},
	}
	for _, tc := range cases {
		t.Run(tc.id, func(t *testing.T) {
			cfg := bracketConfig()
			cfg.Infill = tc.id
			q := Default.ComputePartQuote(bracketMetrics, cfg)
			if math.Abs(q.WeightG-tc.weightG) > 0.05 {
				t.Errorf("weight = %.2f g, want %.1f", q.WeightG, tc.weightG)
			}
			if math.Abs(q.PrintHours-tc.hours) > 0.005 {
				t.Errorf("print = %.3f h, want %.2f", q.PrintHours, tc.hours)
			}
			if q.UnitPricePln != tc.price {
				t.Errorf("price = %v zł, want %v", q.UnitPricePln, tc.price)
			}
		})
	}
}

// Nozzle drives shell thickness and throughput, which pull in opposite
// directions: a wider nozzle lays thicker walls (more material) but deposits
// faster (less machine time). The seeded multipliers are geometric, not
// measured — this test pins what they currently produce so a calibration pass
// has to change it deliberately.
func TestNozzleSweep(t *testing.T) {
	cases := []struct {
		id      string
		weightG float64
		hours   float64
		price   float64
	}{
		{"n02", 23.1, 7.25, 17.70},
		{"n04", 29.2, 2.68, 7.78},
		{"n06", 35.3, 1.57, 5.66},
		{"n08", 41.4, 1.10, 4.96},
	}
	prev := math.Inf(1)
	for _, tc := range cases {
		t.Run(tc.id, func(t *testing.T) {
			cfg := bracketConfig()
			cfg.Nozzle = tc.id
			q := Default.ComputePartQuote(bracketMetrics, cfg)
			if math.Abs(q.WeightG-tc.weightG) > 0.05 {
				t.Errorf("weight = %.2f g, want %.1f", q.WeightG, tc.weightG)
			}
			if math.Abs(q.PrintHours-tc.hours) > 0.005 {
				t.Errorf("print = %.3f h, want %.2f", q.PrintHours, tc.hours)
			}
			if q.UnitPricePln != tc.price {
				t.Errorf("price = %v zł, want %v", q.UnitPricePln, tc.price)
			}
			// A wider nozzle must never cost more than a narrower one, or the
			// benefit-first labels ("Max speed" costing more than "Sturdy
			// draft") stop making sense to the person choosing.
			if q.UnitPricePln > prev {
				t.Errorf("price %v is above the narrower nozzle's %v — ladder is not monotonic",
					q.UnitPricePln, prev)
			}
			prev = q.UnitPricePln
		})
	}
}

// A non-stock colour adds its own breakdown line and raises the unit price by
// exactly the surcharge. Because the surcharge is multiplicative it commutes
// with the quantity discount and the lead-time multiplier, so it is folded
// into the base — this checks the fold really is equivalent.
func TestColorSurcharge(t *testing.T) {
	stock := Default.ComputePartQuote(bracketMetrics, bracketConfig())

	cfg := bracketConfig()
	cfg.Color = "orange"
	fancy := Default.ComputePartQuote(bracketMetrics, cfg)

	want := round2(stock.UnitPricePln * (1 + Default.ColorSurchargeFraction))
	if math.Abs(fancy.UnitPricePln-want) > 0.01 {
		t.Errorf("on-request colour = %v zł, want ~%v", fancy.UnitPricePln, want)
	}

	var line *BreakdownLine
	for i := range fancy.Breakdown {
		if fancy.Breakdown[i].Key == "color" {
			line = &fancy.Breakdown[i]
		}
	}
	if line == nil {
		t.Fatalf("no colour line in breakdown: %+v", fancy.Breakdown)
	}

	// Breakdown lines must still sum to the line total.
	sum := 0.0
	for _, l := range fancy.Breakdown {
		sum += l.AmountPln
	}
	if math.Abs(sum-fancy.LineTotalPln) > 0.005 {
		t.Errorf("breakdown sums to %v, line total is %v", sum, fancy.LineTotalPln)
	}

	// It commutes: applying the surcharge before or after the discount and
	// lead multiplier gives the same answer.
	disc := bracketConfig()
	disc.Color, disc.Quantity, disc.LeadTime = "orange", 10, "express"
	withDisc := Default.ComputePartQuote(bracketMetrics, disc)

	plain := bracketConfig()
	plain.Quantity, plain.LeadTime = 10, "express"
	base := Default.ComputePartQuote(bracketMetrics, plain)

	if got, want := withDisc.UnitPricePln, round2(base.UnitPricePln*1.05); math.Abs(got-want) > 0.01 {
		t.Errorf("surcharge under discount+express = %v, want ~%v", got, want)
	}
}

// A config snapshot persisted before print options existed must survive the
// upgrade: backfilled with the new tables, keeping whatever the operator had
// tuned, and still pricing a default part exactly as it did.
func TestBackfillDefaultsUpgradesLegacySnapshot(t *testing.T) {
	legacy := Default
	legacy.Nozzles, legacy.Infills, legacy.Colors = nil, nil, nil
	legacy.ColorSurchargeFraction, legacy.ColorSurchargeLeadDays = 0, 0
	// A rate the operator tuned, which must not be reset.
	legacy.Processes = append([]ProcessDef(nil), Default.Processes...)
	legacy.Processes[1].PlnPerKg = 80

	if !BackfillDefaults(&legacy) {
		t.Fatal("backfill reported no change for a legacy snapshot")
	}
	if err := Validate(&legacy); err != nil {
		t.Fatalf("backfilled config does not validate: %v", err)
	}
	if legacy.Processes[1].PlnPerKg != 80 {
		t.Error("backfill clobbered a tuned process rate")
	}
	// Prices still work — a zero-value nozzle would divide by zero here.
	q := legacy.ComputePartQuote(bracketMetrics, bracketConfig())
	if q.UnitPricePln <= 0 || math.IsNaN(q.UnitPricePln) {
		t.Errorf("backfilled config priced %v", q.UnitPricePln)
	}

	// A tuned Fdm.InfillFraction carries into the standard infill entry —
	// they are the same setting, and standard parts must not silently reprice.
	tuned := Default
	tuned.Infills = nil
	tuned.Fdm.InfillFraction = 0.25
	BackfillDefaults(&tuned)
	if got := tuned.Infill(DefaultInfillID).Fraction; got != 0.25 {
		t.Errorf("standard infill = %v, want the tuned 0.25", got)
	}

	// Backfill is a no-op on a config that already has the tables.
	current := Default
	if BackfillDefaults(&current) {
		t.Error("backfill changed an already-current config")
	}
}

// Every delta the panel promises before a click has to be the price the user
// actually gets after it. OptionPrices is computed by the same code path as
// the real quote, and this asserts it.
func TestOptionPricesMatchRequoting(t *testing.T) {
	cfg := bracketConfig()
	q := Default.ComputePartQuote(bracketMetrics, cfg)

	if len(q.OptionPrices) == 0 {
		t.Fatal("no option prices")
	}

	seen := map[string]int{}
	for _, opt := range q.OptionPrices {
		seen[opt.Axis]++
		variant := cfg
		switch opt.Axis {
		case "nozzle":
			variant.Nozzle = opt.ID
		case "infill":
			variant.Infill = opt.ID
		case "leadTime":
			variant.LeadTime = opt.ID
		case "color":
			variant.Color = opt.ID
		default:
			t.Fatalf("unknown axis %q", opt.Axis)
		}
		want := Default.ComputePartQuote(bracketMetrics, variant).UnitPricePln
		if opt.UnitPricePln != want {
			t.Errorf("%s=%s promised %v, requoting gives %v",
				opt.Axis, opt.ID, opt.UnitPricePln, want)
		}
	}

	for axis, n := range map[string]int{
		"nozzle":   len(Default.Nozzles),
		"infill":   len(Default.Infills),
		"leadTime": len(Default.LeadTimes),
		"color":    len(Default.Colors),
	} {
		if seen[axis] != n {
			t.Errorf("axis %s has %d options, want %d", axis, seen[axis], n)
		}
	}
}
