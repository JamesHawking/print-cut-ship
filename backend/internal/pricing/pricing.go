package pricing

import (
	"fmt"
	"math"
	"sort"
	"strconv"
)

type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Piece struct {
	BboxMm Vec3 `json:"bboxMm"`
}

// MeshMetrics is the pricing-relevant subset of the client's mesh analysis.
type MeshMetrics struct {
	VolumeCm3        float64 `json:"volumeCm3"`
	SurfaceAreaCm2   float64 `json:"surfaceAreaCm2"`
	BboxMm           Vec3    `json:"bboxMm"`
	UsedHullFallback bool    `json:"usedHullFallback"`
	Pieces           []Piece `json:"pieces,omitempty"`
}

type PartConfig struct {
	Process  string  `json:"process"`
	Quantity float64 `json:"quantity"`
	LeadTime string  `json:"leadTime"`
}

type DfmFlag struct {
	Code               string   `json:"code"`
	Severity           string   `json:"severity"`
	Message            string   `json:"message"`
	SuggestedProcesses []string `json:"suggestedProcesses,omitempty"`
}

type BreakdownLine struct {
	Key       string  `json:"key"`
	Label     string  `json:"label"`
	AmountPln float64 `json:"amountPln"`
}

type PriceBreak struct {
	Quantity         float64 `json:"quantity"`
	UnitPricePln     float64 `json:"unitPricePln"`
	DiscountFraction float64 `json:"discountFraction"`
}

type PartQuote struct {
	Blocked            bool            `json:"blocked"`
	BillableVolumeCm3  float64         `json:"billableVolumeCm3"`
	UnitBasePln        float64         `json:"unitBasePln"`
	DiscountFraction   float64         `json:"discountFraction"`
	LeadTimeMultiplier float64         `json:"leadTimeMultiplier"`
	UnitPricePln       float64         `json:"unitPricePln"`
	LineTotalPln       float64         `json:"lineTotalPln"`
	Breakdown          []BreakdownLine `json:"breakdown"`
	DfmFlags           []DfmFlag       `json:"dfmFlags"`
	PriceBreaks        []PriceBreak    `json:"priceBreaks"`
	// Present only for multi-piece 3MF parts.
	PieceCount *int `json:"pieceCount,omitempty"`
	Plates     *int `json:"plates,omitempty"`
}

type OrderTotals struct {
	PartsSubtotalPln float64 `json:"partsSubtotalPln"`
	MinOrderTopUpPln float64 `json:"minOrderTopUpPln"`
	OrderFeePln      float64 `json:"orderFeePln"`
	ShippingPln      float64 `json:"shippingPln"`
	NetTotalPln      float64 `json:"netTotalPln"`
	VatPln           float64 `json:"vatPln"`
	GrossTotalPln    float64 `json:"grossTotalPln"`
	FreeShipping     bool    `json:"freeShipping"`
	MinOrderApplied  bool    `json:"minOrderApplied"`
}

// round2 replicates JS `Math.round(n*100)/100`: half-up toward +Inf,
// which differs from Go's math.Round (half away from zero) for negatives.
func round2(n float64) float64 {
	return math.Floor(n*100+0.5) / 100
}

// fmtNum renders a float the way a JS template literal does: shortest
// round-trip decimal ("340", "0.2", "1.5").
func fmtNum(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// InterpolateDiscount is the piecewise-linear discount fraction for a
// quantity, clamped outside the tiers.
func (c *Config) InterpolateDiscount(quantity float64) float64 {
	tiers := c.DiscountTiers
	q := math.Max(1, math.Floor(quantity))
	if q <= tiers[0].Quantity {
		return tiers[0].Fraction
	}
	last := tiers[len(tiers)-1]
	if q >= last.Quantity {
		return last.Fraction
	}
	for i := 0; i < len(tiers)-1; i++ {
		lo, loD := tiers[i].Quantity, tiers[i].Fraction
		hi, hiD := tiers[i+1].Quantity, tiers[i+1].Fraction
		if q >= lo && q <= hi {
			t := (q - lo) / (hi - lo)
			return loD + t*(hiD-loD)
		}
	}
	return last.Fraction // unreachable
}

// unitBasePrice: shell (surface area × thickness, clamped to volume) plus
// infill of the remaining interior; material from weight × per-kg rate and
// factor; machine time books shell and infill grams at separate throughputs.
func (c *Config) unitBasePrice(proc ProcessDef, volumeCm3, surfaceAreaCm2 float64) (float64, []BreakdownLine) {
	shellVolCm3 := math.Min(volumeCm3, surfaceAreaCm2*(c.Fdm.ShellThicknessMm/10))
	infillVolCm3 := c.Fdm.InfillFraction * (volumeCm3 - shellVolCm3)
	shellG := shellVolCm3 * proc.DensityGCm3
	infillG := infillVolCm3 * proc.DensityGCm3
	weightG := shellG + infillG
	material := (weightG * proc.PlnPerKg * proc.Factor) / 1000
	printH := shellG/c.Fdm.ShellGramsPerPrintHour + infillG/c.Fdm.InfillGramsPerPrintHour
	machine := printH * proc.PlnPerHour
	return material + machine, []BreakdownLine{
		{Key: "material", Label: "Material", AmountPln: material},
		{Key: "machine", Label: "Machine time", AmountPln: machine},
		{Key: "finishing", Label: "Finishing", AmountPln: 0},
	}
}

// sortedDesc lets us compare a part against a build box allowing any rotation.
func sortedDesc(v Vec3) [3]float64 {
	d := [3]float64{v.X, v.Y, v.Z}
	sort.Sort(sort.Reverse(sort.Float64Slice(d[:])))
	return d
}

func fitsBuildVolume(proc ProcessDef, bboxMm Vec3) bool {
	part := sortedDesc(bboxMm)
	build := sortedDesc(Vec3(proc.Build))
	return part[0] <= build[0] && part[1] <= build[1] && part[2] <= build[2]
}

func (c *Config) processesThatFit(bboxMm Vec3) []string {
	var ids []string
	for _, p := range c.Processes {
		if fitsBuildVolume(p, bboxMm) {
			ids = append(ids, p.ID)
		}
	}
	return ids
}

func (c *Config) ComputePartQuote(metrics MeshMetrics, config PartConfig) PartQuote {
	proc, _ := c.Process(config.Process)
	dfmFlags := []DfmFlag{}

	// Billable volume: minimum 1 cm³.
	rawVolume := metrics.VolumeCm3
	billableVolumeCm3 := math.Max(rawVolume, c.MinBillableVolumeCm3)
	if rawVolume < c.MinBillableVolumeCm3 {
		dfmFlags = append(dfmFlags, DfmFlag{
			Code:     "min_volume_billed",
			Severity: "info",
			Message:  fmt.Sprintf("Under 1 cm³ — billed at the %s cm³ minimum.", fmtNum(c.MinBillableVolumeCm3)),
		})
	}

	// Approximated geometry from convex-hull fallback.
	if metrics.UsedHullFallback {
		dfmFlags = append(dfmFlags, DfmFlag{
			Code:     "geometry_approximated",
			Severity: "warn",
			Message:  "Mesh is not watertight — volume estimated from its convex hull. Final price may change.",
		})
	}

	// Smallest feature warning.
	minDim := math.Min(metrics.BboxMm.X, math.Min(metrics.BboxMm.Y, metrics.BboxMm.Z))
	if minDim < c.MinFeatureMm {
		dfmFlags = append(dfmFlags, DfmFlag{
			Code:     "small_feature",
			Severity: "warn",
			Message:  fmt.Sprintf("Smallest dimension is %s mm — thin features may not survive printing.", strconv.FormatFloat(minDim, 'f', 2, 64)),
		})
	}

	// Build-volume check for the chosen process (blocking). Multi-piece 3MF
	// files are gated piece-by-piece with plate packing; single-piece parts
	// keep the rotation-aware bbox check.
	pieces := metrics.Pieces
	multiPiece := len(pieces) >= 2
	plates := 1
	var fits bool
	if multiPiece {
		counted := CountPlates(pieces, proc.Build, PackOpts{GutterMm: c.PlateGutterMm})
		fits = counted != nil
		if counted != nil {
			plates = *counted
		}
		if !fits {
			var alternatives []string
			for _, p := range c.Processes {
				if CountPlates(pieces, p.Build, PackOpts{GutterMm: c.PlateGutterMm}) != nil {
					alternatives = append(alternatives, p.ID)
				}
			}
			dfmFlags = append(dfmFlags, DfmFlag{
				Code:     "exceeds_build_volume",
				Severity: "block",
				Message: fmt.Sprintf("A piece exceeds the %s×%s×%s mm build plate.",
					fmtNum(proc.Build.X), fmtNum(proc.Build.Y), fmtNum(proc.Build.Z)),
				SuggestedProcesses: alternatives,
			})
		} else if plates > 1 {
			dfmFlags = append(dfmFlags, DfmFlag{
				Code:     "multi_plate",
				Severity: "info",
				Message: fmt.Sprintf("%d pieces pack onto %d build plates — %s zł per extra plate.",
					len(pieces), plates, fmtNum(c.ExtraPlateFeePln)),
			})
		}
	} else {
		fits = fitsBuildVolume(proc, metrics.BboxMm)
		if !fits {
			alternatives := c.processesThatFit(metrics.BboxMm)
			dfmFlags = append(dfmFlags, DfmFlag{
				Code:     "exceeds_build_volume",
				Severity: "block",
				Message: fmt.Sprintf("Part exceeds the %s×%s×%s mm build volume.",
					fmtNum(proc.Build.X), fmtNum(proc.Build.Y), fmtNum(proc.Build.Z)),
				SuggestedProcesses: alternatives,
			})
		}
	}

	unitBasePln, baseLines := c.unitBasePrice(proc, billableVolumeCm3, metrics.SurfaceAreaCm2)
	// Per-unit fee for each plate beyond the first, folded into the base so
	// discounts, lead-time multipliers, and breakdown scaling apply uniformly.
	plateFeePln := float64(plates-1) * c.ExtraPlateFeePln
	if plateFeePln > 0 {
		unitBasePln += plateFeePln
		baseLines = append(baseLines, BreakdownLine{
			Key:       "plates",
			Label:     fmt.Sprintf("Extra plates (%d)", plates-1),
			AmountPln: plateFeePln,
		})
	}
	discountFraction := c.InterpolateDiscount(config.Quantity)
	leadTime, _ := c.LeadTime(config.LeadTime)
	leadTimeMultiplier := leadTime.Mult

	rawUnit := unitBasePln * (1 - discountFraction) * leadTimeMultiplier
	// mapi-tech floors every part at a minimum price.
	unitPricePln := math.Max(round2(rawUnit), c.MinPartPricePln)
	qty := math.Max(1, math.Floor(config.Quantity))
	lineTotalPln := round2(unitPricePln * qty)

	// Scale breakdown lines to the line total so they sum exactly.
	scale := 0.0
	if unitBasePln > 0 {
		scale = lineTotalPln / unitBasePln
	}
	scaled := make([]BreakdownLine, len(baseLines))
	for i, l := range baseLines {
		l.AmountPln = round2(l.AmountPln * scale)
		scaled[i] = l
	}
	// Absorb rounding drift into the machine line so lines sum to lineTotal.
	sum := 0.0
	for _, l := range scaled {
		sum += l.AmountPln
	}
	drift := lineTotalPln - sum
	for i := range scaled {
		if scaled[i].Key == "machine" {
			scaled[i].AmountPln = round2(scaled[i].AmountPln + drift)
			break
		}
	}

	// Price-break table for the currently-selected process & lead time.
	priceBreaks := make([]PriceBreak, 0, len(QuantityChips))
	for _, q := range QuantityChips {
		d := c.InterpolateDiscount(float64(q))
		priceBreaks = append(priceBreaks, PriceBreak{
			Quantity:         float64(q),
			UnitPricePln:     math.Max(round2(unitBasePln*(1-d)*leadTimeMultiplier), c.MinPartPricePln),
			DiscountFraction: d,
		})
	}

	quote := PartQuote{
		Blocked:            !fits,
		BillableVolumeCm3:  billableVolumeCm3,
		UnitBasePln:        round2(unitBasePln),
		DiscountFraction:   discountFraction,
		LeadTimeMultiplier: leadTimeMultiplier,
		UnitPricePln:       unitPricePln,
		LineTotalPln:       lineTotalPln,
		Breakdown:          scaled,
		DfmFlags:           dfmFlags,
		PriceBreaks:        priceBreaks,
	}
	if multiPiece {
		n := len(pieces)
		p := plates
		quote.PieceCount = &n
		quote.Plates = &p
	}
	return quote
}

// ComputeOrderTotals: minimum order, flat order fee, shipping. Blocked parts
// excluded. All prices are gross (VAT-inclusive); vatPln is the included
// portion, netTotalPln the gross minus that VAT.
func (c *Config) ComputeOrderTotals(quotes []PartQuote) OrderTotals {
	var active []PartQuote
	for _, q := range quotes {
		if !q.Blocked {
			active = append(active, q)
		}
	}
	sum := 0.0
	for _, q := range active {
		sum += q.LineTotalPln
	}
	partsSubtotalPln := round2(sum)

	minOrderTopUpPln := round2(math.Max(0, c.MinOrderPln-partsSubtotalPln))
	minOrderApplied := minOrderTopUpPln > 0

	afterMin := round2(partsSubtotalPln + minOrderTopUpPln)
	orderFeePln := 0.0
	if len(active) > 0 {
		orderFeePln = c.OrderFeePln
	}
	freeShipping := afterMin >= c.FreeShippingThresholdPln
	shippingPln := c.ShippingFlatPln
	if freeShipping {
		shippingPln = 0
	}

	grossTotalPln := round2(afterMin + orderFeePln + shippingPln)
	vatPln := round2((grossTotalPln * c.VatRate) / (1 + c.VatRate))
	netTotalPln := round2(grossTotalPln - vatPln)

	return OrderTotals{
		PartsSubtotalPln: partsSubtotalPln,
		MinOrderTopUpPln: minOrderTopUpPln,
		OrderFeePln:      orderFeePln,
		ShippingPln:      shippingPln,
		NetTotalPln:      netTotalPln,
		VatPln:           vatPln,
		GrossTotalPln:    grossTotalPln,
		FreeShipping:     freeShipping,
		MinOrderApplied:  minOrderApplied,
	}
}
