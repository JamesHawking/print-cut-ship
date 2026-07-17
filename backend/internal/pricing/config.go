// Package pricing is the canonical port of the instant-quote TypeScript
// pricing engine (src/lib/pricing.ts + pricing-config.ts). It must produce
// bit-identical results to the original: arithmetic is kept in the same
// order, and rounding replicates JS Math.round semantics. Golden fixtures
// generated from the TS implementation enforce this (see golden_test.go).
package pricing

type BuildVolumeMm struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type ProcessDef struct {
	ID          string
	Label       string
	DensityGCm3 float64
	PlnPerKg    float64
	Factor      float64 // per-material price multiplier (mapi-tech "factor")
	PlnPerHour  float64 // machine-time rate
	Build       BuildVolumeMm
}

type LeadTimeDef struct {
	ID           string
	Mult         float64
	BusinessDays int
}

type FdmModel struct {
	InfillFraction          float64
	ShellThicknessMm        float64
	ShellGramsPerPrintHour  float64
	InfillGramsPerPrintHour float64
}

type DiscountTier struct {
	Quantity float64
	Fraction float64
}

type Config struct {
	// Order matters: it drives suggested-process lists and matches the
	// TS Object.keys insertion order.
	Processes     []ProcessDef
	LeadTimes     []LeadTimeDef
	Fdm           FdmModel
	DiscountTiers []DiscountTier

	ExtraPlateFeePln         float64
	PlateGutterMm            float64
	MinOrderPln              float64
	MinPartPricePln          float64
	OrderFeePln              float64
	ShippingFlatPln          float64
	FreeShippingThresholdPln float64
	VatRate                  float64
	MinBillableVolumeCm3     float64
	MinFeatureMm             float64
	SameDayCutoffHour        int
}

func (c *Config) Process(id string) (ProcessDef, bool) {
	for _, p := range c.Processes {
		if p.ID == id {
			return p, true
		}
	}
	return ProcessDef{}, false
}

func (c *Config) LeadTime(id string) (LeadTimeDef, bool) {
	for _, lt := range c.LeadTimes {
		if lt.ID == id {
			return lt, true
		}
	}
	return LeadTimeDef{}, false
}

// H2SPlate is the Bambu Lab H2S build plate shared by all processes.
var H2SPlate = BuildVolumeMm{X: 340, Y: 320, Z: 340}

var QuantityChips = []int{1, 5, 10, 25, 50}

const MaxParts = 5

// MaxQuantity bounds per-part quantity at the API boundary. Chosen well above
// any real order while keeping worst-case line totals far from the int32
// grosze ceiling that persistence enforces (internal/money).
const MaxQuantity = 10_000

// Default mirrors PRICING in src/lib/pricing-config.ts. Rates anchor to
// mapi-tech.pl reference quotes; see research/competitors/.
var Default = Config{
	Processes: []ProcessDef{
		{ID: "pla", Label: "PLA", DensityGCm3: 1.25, PlnPerKg: 50, Factor: 1.0, PlnPerHour: 1.8, Build: H2SPlate},
		{ID: "petg", Label: "PETG", DensityGCm3: 1.27, PlnPerKg: 50, Factor: 1.2, PlnPerHour: 2.25, Build: H2SPlate},
		{ID: "pctg", Label: "PCTG", DensityGCm3: 1.23, PlnPerKg: 150, Factor: 1.0, PlnPerHour: 2.25, Build: H2SPlate},
		{ID: "asa", Label: "ASA", DensityGCm3: 1.05, PlnPerKg: 120, Factor: 1.5, PlnPerHour: 2.5, Build: H2SPlate},
		{ID: "petg_fr", Label: "PETG FR (V0)", DensityGCm3: 1.03, PlnPerKg: 180, Factor: 1.0, PlnPerHour: 2.5, Build: H2SPlate},
		{ID: "pa12_cf", Label: "PA12-CF", DensityGCm3: 1.08, PlnPerKg: 350, Factor: 2.0, PlnPerHour: 3.5, Build: H2SPlate},
		{ID: "iglidur", Label: "Iglidur I150PF", DensityGCm3: 1.3, PlnPerKg: 550, Factor: 1.0, PlnPerHour: 3.5, Build: H2SPlate},
	},
	LeadTimes: []LeadTimeDef{
		{ID: "economy", Mult: 0.9, BusinessDays: 10},
		{ID: "standard", Mult: 1.0, BusinessDays: 5},
		{ID: "express", Mult: 1.3, BusinessDays: 3},
	},
	Fdm: FdmModel{
		InfillFraction:          0.2,
		ShellThicknessMm:        0.9,
		ShellGramsPerPrintHour:  8,
		InfillGramsPerPrintHour: 18,
	},
	DiscountTiers: []DiscountTier{
		{1, 0}, {5, 0.05}, {10, 0.12}, {25, 0.2}, {50, 0.28},
	},
	ExtraPlateFeePln:         10,
	PlateGutterMm:            5,
	MinOrderPln:              30,
	MinPartPricePln:          1.5,
	OrderFeePln:              1,
	ShippingFlatPln:          20,
	FreeShippingThresholdPln: 500,
	VatRate:                  0.23,
	MinBillableVolumeCm3:     1,
	MinFeatureMm:             1,
	SameDayCutoffHour:        14,
}
