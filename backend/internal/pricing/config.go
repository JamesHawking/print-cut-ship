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

// NozzleDef scales the FdmModel baseline, which is calibrated for the 0.4 mm
// nozzle — so n04 is the identity element and the 0.4 mm path is unchanged by
// construction. A wider nozzle lays thicker walls (more material) and deposits
// faster (less machine time); the two pull against each other.
type NozzleDef struct {
	ID             string
	DiameterMm     float64
	ShellMult      float64 // × Fdm.ShellThicknessMm
	ThroughputMult float64 // × both Fdm g/h rates
}

// InfillDef replaces Fdm.InfillFraction per part. No new pricing constants:
// the fraction already drives interior volume → weight → material zł, and
// → print hours → machine zł.
type InfillDef struct {
	ID       string
	Fraction float64
}

// ColorDef is a filament colour. Label is the canonical English name; the
// frontend localizes from ID and falls back to Label, the same contract
// ProcessDef.Label uses. Hex is the swatch.
type ColorDef struct {
	ID      string
	Label   string
	Hex     string
	InStock bool
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
	Nozzles       []NozzleDef
	Infills       []InfillDef
	Colors        []ColorDef
	Fdm           FdmModel
	DiscountTiers []DiscountTier

	// Charged on parts printed in a colour that isn't on the shelf, and
	// added to the quoted lead time.
	ColorSurchargeFraction float64
	ColorSurchargeLeadDays int

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

// Default print options. An empty id means "the default": golden.json's
// configs predate these fields and decode to "", and a zero-value NozzleDef
// would divide by zero on its ×0 throughput. Lookups fall back here rather
// than returning a zero value, so an unrecognised id degrades to a real
// price instead of a panic.
const (
	DefaultNozzleID = "n04"
	DefaultInfillID = "standard"
	DefaultColorID  = "black"
)

// Nozzle resolves a nozzle id, falling back to the 0.4 mm baseline.
func (c *Config) Nozzle(id string) NozzleDef {
	var fallback NozzleDef
	for _, n := range c.Nozzles {
		if n.ID == id {
			return n
		}
		if n.ID == DefaultNozzleID {
			fallback = n
		}
	}
	return fallback
}

// Infill resolves an infill id, falling back to the standard density.
func (c *Config) Infill(id string) InfillDef {
	var fallback InfillDef
	for _, i := range c.Infills {
		if i.ID == id {
			return i
		}
		if i.ID == DefaultInfillID {
			fallback = i
		}
	}
	return fallback
}

// Color resolves a colour id, falling back to the default stock colour.
func (c *Config) Color(id string) ColorDef {
	var fallback ColorDef
	for _, col := range c.Colors {
		if col.ID == id {
			return col
		}
		if col.ID == DefaultColorID {
			fallback = col
		}
	}
	return fallback
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
	// UNCALIBRATED — geometric seeds, not measured. Slicers lay a fixed two
	// walls at a line width of ~1.125 × nozzle, which reproduces the
	// calibrated 0.9 mm shell at 0.4 mm exactly; the extruded bead's
	// cross-section scales with diameter², hence (d/0.4)² throughput. The
	// resulting ladder is monotonic but steep (0.2 mm prices at +127% on the
	// demo bracket). Re-fit these against real print data before launch —
	// plans/engineering/14-pricing-engine.md §2. They live in the versioned
	// snapshot, so the admin editor retunes them without a deploy.
	Nozzles: []NozzleDef{
		{ID: "n02", DiameterMm: 0.2, ShellMult: 0.5, ThroughputMult: 0.25},
		{ID: "n04", DiameterMm: 0.4, ShellMult: 1.0, ThroughputMult: 1.0},
		{ID: "n06", DiameterMm: 0.6, ShellMult: 1.5, ThroughputMult: 2.25},
		{ID: "n08", DiameterMm: 0.8, ShellMult: 2.0, ThroughputMult: 4.0},
	},
	// "standard" must equal Fdm.InfillFraction — it is the same setting, and
	// the default part has to price identically whether or not it names one.
	Infills: []InfillDef{
		{ID: "light", Fraction: 0.15},
		{ID: "standard", Fraction: 0.2},
		{ID: "strong", Fraction: 0.4},
		{ID: "solid", Fraction: 1.0},
	},
	Colors: []ColorDef{
		{ID: "black", Label: "Black", Hex: "#1b1b1f", InStock: true},
		{ID: "white", Label: "White", Hex: "#f2f1ec", InStock: true},
		{ID: "grey", Label: "Grey", Hex: "#9a9ea6", InStock: true},
		{ID: "red", Label: "Red", Hex: "#c8322b"},
		{ID: "orange", Label: "Orange", Hex: "#f26722"},
		{ID: "yellow", Label: "Yellow", Hex: "#f2c14e"},
		{ID: "green", Label: "Green", Hex: "#3fa66b"},
		{ID: "blue", Label: "Blue", Hex: "#3060c0"},
		{ID: "silver", Label: "Silver", Hex: "#c9ccd2"},
	},
	ColorSurchargeFraction: 0.05,
	ColorSurchargeLeadDays: 1,
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
	FreeShippingThresholdPln: 300,
	VatRate:                  0.23,
	MinBillableVolumeCm3:     1,
	MinFeatureMm:             1,
	SameDayCutoffHour:        14,
}
