package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"time"

	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
)

// Reference-part price tables for the material landing pages
// (plans/seo/02). The frontend must never re-implement the engine, and the
// prerendered pages can't call the API at build time — so this DB-free
// subcommand computes the tables through internal/pricing and the result is
// committed as instant-quote/src/content/reference-prices.json
// (`make gen-reference-prices`; drift pinned by referenceprices_test.go).

type referencePart struct {
	ID             string       `json:"id"`
	VolumeCm3      float64      `json:"volumeCm3"`
	SurfaceAreaCm2 float64      `json:"surfaceAreaCm2"`
	BboxMm         pricing.Vec3 `json:"bboxMm"`
}

// Three canonical example parts: a small solid bracket, a thin-walled
// enclosure, a larger housing. Values are plausible geometry, chosen once —
// changing them changes published marketing tables, so treat as content.
var referenceParts = []referencePart{
	{ID: "bracket", VolumeCm3: 20, SurfaceAreaCm2: 120, BboxMm: pricing.Vec3{X: 80, Y: 60, Z: 30}},
	{ID: "enclosure", VolumeCm3: 60, SurfaceAreaCm2: 480, BboxMm: pricing.Vec3{X: 160, Y: 110, Z: 45}},
	{ID: "housing", VolumeCm3: 100, SurfaceAreaCm2: 700, BboxMm: pricing.Vec3{X: 200, Y: 140, Z: 60}},
}

// The materials with published landing pages (slugs live in
// instant-quote/src/content/materials/slugs.ts).
var referenceMaterials = []string{"petg", "asa", "pa12_cf"}

var referenceQuantities = []int{1, 10, 50}

const referenceLeadTime = "standard"

// ------------------------------------------------- pricing-page dataset (03)

type catalogMaterial struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	DensityGCm3 float64 `json:"densityGCm3"`
	PlnPerKg    float64 `json:"plnPerKg"`
	PlnPerHour  float64 `json:"plnPerHour"`
	Factor      float64 `json:"factor"`
}

type discountTier struct {
	Quantity float64 `json:"quantity"`
	Fraction float64 `json:"fraction"`
}

type leadTimeEntry struct {
	ID           string  `json:"id"`
	Mult         float64 `json:"mult"`
	BusinessDays int     `json:"businessDays"`
}

type feeSection struct {
	MinPartPricePln          float64 `json:"minPartPricePln"`
	MinOrderPln              float64 `json:"minOrderPln"`
	OrderFeePln              float64 `json:"orderFeePln"`
	ShippingFlatPln          float64 `json:"shippingFlatPln"`
	FreeShippingThresholdPln float64 `json:"freeShippingThresholdPln"`
	VatRate                  float64 `json:"vatRate"`
}

type catalogSection struct {
	Materials         []catalogMaterial `json:"materials"`
	DiscountTiers     []discountTier    `json:"discountTiers"`
	LeadTimes         []leadTimeEntry   `json:"leadTimes"`
	Fees              feeSection        `json:"fees"`
	SameDayCutoffHour int               `json:"sameDayCutoffHour"`
}

type discountExampleRow struct {
	Quantity int     `json:"quantity"`
	UnitPln  float64 `json:"unitPln"`
	LinePln  float64 `json:"linePln"`
}

type minOrderExample struct {
	Material         string  `json:"material"`
	PartID           string  `json:"partId"`
	UnitPln          float64 `json:"unitPln"`
	MinOrderTopUpPln float64 `json:"minOrderTopUpPln"`
	OrderFeePln      float64 `json:"orderFeePln"`
	ShippingPln      float64 `json:"shippingPln"`
	GrossTotalPln    float64 `json:"grossTotalPln"`
}

type shipDateExample struct {
	// Fixed hypothetical order moments (a Tuesday, before/after the 14:00
	// cutoff) — the frontend shows localized weekday names only, so the
	// anchor year never surfaces and the copy stays evergreen.
	OrderISO    string            `json:"orderIso"`
	AfterCutoff bool              `json:"afterCutoff"`
	ShipISO     map[string]string `json:"shipIso"`
}

// The volume-only rate card prices idealized cubes: side = ∛V. Mirrored by
// cubeMetrics() in instant-quote/src/components/pricing/PriceSlider.tsx —
// keep the two in sync.
func cubeMetrics(volumeCm3 float64) pricing.MeshMetrics {
	sideCm := math.Cbrt(volumeCm3)
	sideMm := sideCm * 10
	return pricing.MeshMetrics{
		VolumeCm3:      volumeCm3,
		SurfaceAreaCm2: 6 * sideCm * sideCm,
		BboxMm:         pricing.Vec3{X: sideMm, Y: sideMm, Z: sideMm},
	}
}

var rateCardVolumes = []float64{1, 10, 100}

var discountExampleQuantities = []int{1, 5, 10, 25, 50}

type referencePricesDoc struct {
	Comment     string                                   `json:"$comment"`
	Currency    string                                   `json:"currency"`
	VatIncluded bool                                     `json:"vatIncluded"`
	LeadTime    string                                   `json:"leadTime"`
	Parts       []referencePart                          `json:"parts"`
	Prices      map[string]map[string]map[string]float64 `json:"prices"`
	// Pricing-page dataset (plans/seo/03):
	Catalog          catalogSection                `json:"catalog"`
	RateCard         map[string]map[string]float64 `json:"rateCard"`
	DiscountExample  []discountExampleRow          `json:"discountExample"`
	MinOrderExample  minOrderExample               `json:"minOrderExample"`
	ShipDateExamples []shipDateExample             `json:"shipDateExamples"`
}

// buildReferencePrices computes unit prices for every published material ×
// reference part × quantity. Output is deterministic: maps marshal with
// sorted keys and there is no timestamp, so regeneration is diff-stable.
func buildReferencePrices() (referencePricesDoc, error) {
	prices := make(map[string]map[string]map[string]float64, len(referenceMaterials))
	for _, material := range referenceMaterials {
		if _, ok := pricing.Default.Process(material); !ok {
			return referencePricesDoc{}, fmt.Errorf("unknown material %q", material)
		}
		perPart := make(map[string]map[string]float64, len(referenceParts))
		for _, part := range referenceParts {
			perQty := make(map[string]float64, len(referenceQuantities))
			for _, qty := range referenceQuantities {
				q := pricing.Default.ComputePartQuote(pricing.MeshMetrics{
					VolumeCm3:      part.VolumeCm3,
					SurfaceAreaCm2: part.SurfaceAreaCm2,
					BboxMm:         part.BboxMm,
				}, pricing.PartConfig{
					Process:  material,
					Quantity: float64(qty),
					LeadTime: referenceLeadTime,
				})
				if q.Blocked {
					return referencePricesDoc{}, fmt.Errorf(
						"reference part %q is blocked for %q — fix the part geometry", part.ID, material)
				}
				perQty[fmt.Sprintf("%d", qty)] = q.UnitPricePln
			}
			perPart[part.ID] = perQty
		}
		prices[material] = perPart
	}
	shipExamples, err := buildShipDateExamples()
	if err != nil {
		return referencePricesDoc{}, err
	}
	return referencePricesDoc{
		Comment:     "GENERATED by `make gen-reference-prices` (backend/cmd/api reference-prices) — do not edit; gross PLN unit prices from internal/pricing.",
		Currency:    "PLN",
		VatIncluded: true,
		LeadTime:    referenceLeadTime,
		Parts:       referenceParts,
		Prices:      prices,

		Catalog:          buildCatalog(),
		RateCard:         buildRateCard(),
		DiscountExample:  buildDiscountExample(),
		MinOrderExample:  buildMinOrderExample(),
		ShipDateExamples: shipExamples,
	}, nil
}

func buildCatalog() catalogSection {
	c := &pricing.Default
	out := catalogSection{SameDayCutoffHour: c.SameDayCutoffHour}
	for _, p := range c.Processes {
		out.Materials = append(out.Materials, catalogMaterial{
			ID: p.ID, Label: p.Label, DensityGCm3: p.DensityGCm3,
			PlnPerKg: p.PlnPerKg, PlnPerHour: p.PlnPerHour, Factor: p.Factor,
		})
	}
	for _, dt := range c.DiscountTiers {
		out.DiscountTiers = append(out.DiscountTiers, discountTier{
			Quantity: dt.Quantity, Fraction: dt.Fraction,
		})
	}
	for _, lt := range c.LeadTimes {
		out.LeadTimes = append(out.LeadTimes, leadTimeEntry{
			ID: lt.ID, Mult: lt.Mult, BusinessDays: lt.BusinessDays,
		})
	}
	out.Fees = feeSection{
		MinPartPricePln:          c.MinPartPricePln,
		MinOrderPln:              c.MinOrderPln,
		OrderFeePln:              c.OrderFeePln,
		ShippingFlatPln:          c.ShippingFlatPln,
		FreeShippingThresholdPln: c.FreeShippingThresholdPln,
		VatRate:                  c.VatRate,
	}
	return out
}

// buildRateCard prices idealized cubes of 1/10/100 cm³ for EVERY catalog
// material (qty 1, standard lead time) — the pricing page's headline table.
func buildRateCard() map[string]map[string]float64 {
	out := make(map[string]map[string]float64, len(pricing.Default.Processes))
	for _, p := range pricing.Default.Processes {
		perVolume := make(map[string]float64, len(rateCardVolumes))
		for _, volume := range rateCardVolumes {
			q := pricing.Default.ComputePartQuote(cubeMetrics(volume), pricing.PartConfig{
				Process: p.ID, Quantity: 1, LeadTime: referenceLeadTime,
			})
			perVolume[fmt.Sprintf("%.0f", volume)] = q.UnitPricePln
		}
		out[p.ID] = perVolume
	}
	return out
}

// buildDiscountExample walks the PETG enclosure through every quantity tier.
func buildDiscountExample() []discountExampleRow {
	enclosure := referenceParts[1]
	rows := make([]discountExampleRow, 0, len(discountExampleQuantities))
	for _, qty := range discountExampleQuantities {
		q := pricing.Default.ComputePartQuote(pricing.MeshMetrics{
			VolumeCm3:      enclosure.VolumeCm3,
			SurfaceAreaCm2: enclosure.SurfaceAreaCm2,
			BboxMm:         enclosure.BboxMm,
		}, pricing.PartConfig{
			Process: "petg", Quantity: float64(qty), LeadTime: referenceLeadTime,
		})
		rows = append(rows, discountExampleRow{
			Quantity: qty, UnitPln: q.UnitPricePln, LinePln: q.LineTotalPln,
		})
	}
	return rows
}

// buildMinOrderExample shows the order minimum binding on a single small part.
func buildMinOrderExample() minOrderExample {
	bracket := referenceParts[0]
	q := pricing.Default.ComputePartQuote(pricing.MeshMetrics{
		VolumeCm3:      bracket.VolumeCm3,
		SurfaceAreaCm2: bracket.SurfaceAreaCm2,
		BboxMm:         bracket.BboxMm,
	}, pricing.PartConfig{Process: "petg", Quantity: 1, LeadTime: referenceLeadTime})
	totals := pricing.Default.ComputeOrderTotals([]pricing.PartQuote{q})
	return minOrderExample{
		Material:         "petg",
		PartID:           bracket.ID,
		UnitPln:          q.UnitPricePln,
		MinOrderTopUpPln: totals.MinOrderTopUpPln,
		OrderFeePln:      totals.OrderFeePln,
		ShippingPln:      totals.ShippingPln,
		GrossTotalPln:    totals.GrossTotalPln,
	}
}

func buildShipDateExamples() ([]shipDateExample, error) {
	warsaw, err := time.LoadLocation("Europe/Warsaw")
	if err != nil {
		return nil, err
	}
	cutoff := pricing.Default.SameDayCutoffHour
	// A fixed Tuesday, once before and once after the cutoff.
	anchors := []time.Time{
		time.Date(2026, 1, 6, 11, 0, 0, 0, warsaw),
		time.Date(2026, 1, 6, 15, 0, 0, 0, warsaw),
	}
	out := make([]shipDateExample, 0, len(anchors))
	for _, anchor := range anchors {
		ex := shipDateExample{
			OrderISO:    anchor.Format("2006-01-02T15:04"),
			AfterCutoff: anchor.Hour() >= cutoff,
			ShipISO:     make(map[string]string, len(pricing.Default.LeadTimes)),
		}
		for _, lt := range pricing.Default.LeadTimes {
			sd := leadtime.ComputeShipDate(lt.BusinessDays, cutoff, anchor)
			ex.ShipISO[lt.ID] = fmt.Sprintf("%04d-%02d-%02d", sd.Date.Y, sd.Date.M, sd.Date.D)
		}
		out = append(out, ex)
	}
	return out, nil
}

func referencePrices() error {
	doc, err := buildReferencePrices()
	if err != nil {
		return err
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(doc)
}
