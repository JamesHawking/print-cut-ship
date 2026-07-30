package pricing

import (
	"encoding/json"
	"fmt"
	"io"
)

// FieldError marks a single invalid config field; the admin endpoint maps it
// to a 400 pricing_config_invalid with the field path in params.
type FieldError struct {
	Field string
	Msg   string
}

func (e *FieldError) Error() string {
	return fmt.Sprintf("pricing config: %s: %s", e.Field, e.Msg)
}

// DecodeStrict decodes a pricing config rejecting unknown fields — the
// editor's schema is derived from this Go struct, so drift is an error, not
// a silent drop (the httpapi drift-guard test pins spec ↔ struct parity).
func DecodeStrict(r io.Reader) (*Config, error) {
	dec := json.NewDecoder(r)
	dec.DisallowUnknownFields()
	var cfg Config
	if err := dec.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("pricing config: decode: %w", err)
	}
	return &cfg, nil
}

// BackfillDefaults fills in tables a snapshot predates. Config snapshots are
// persisted JSON, so one written before print options existed decodes with nil
// Nozzles/Infills/Colors — and a zero-value NozzleDef would divide by zero on
// its ×0 throughput. Without this the bootstrap's self-heal would reset the
// whole snapshot to Default, throwing away whatever rates the operator had
// tuned; backfilling keeps their work and only adds what is missing.
//
// It reports whether it changed anything, so the caller can say so.
func BackfillDefaults(cfg *Config) bool {
	changed := false
	if len(cfg.Nozzles) == 0 {
		cfg.Nozzles = append([]NozzleDef(nil), Default.Nozzles...)
		changed = true
	}
	if len(cfg.Infills) == 0 {
		cfg.Infills = append([]InfillDef(nil), Default.Infills...)
		// The default infill entry is the same setting as Fdm.InfillFraction,
		// which the operator may have tuned — carry theirs across rather than
		// silently repricing every standard part.
		for i := range cfg.Infills {
			if cfg.Infills[i].ID == DefaultInfillID && cfg.Fdm.InfillFraction > 0 {
				cfg.Infills[i].Fraction = cfg.Fdm.InfillFraction
			}
		}
		changed = true
	}
	if len(cfg.Colors) == 0 {
		cfg.Colors = append([]ColorDef(nil), Default.Colors...)
		cfg.ColorSurchargeFraction = Default.ColorSurchargeFraction
		cfg.ColorSurchargeLeadDays = Default.ColorSurchargeLeadDays
		changed = true
	}
	return changed
}

// Validate enforces the editor's invariants: formula structure is NOT
// editable (process and lead-time ID sequences must equal Default's), rates
// and densities are positive, fractions and fees stay in sane ranges.
func Validate(cfg *Config) error {
	if len(cfg.Processes) != len(Default.Processes) {
		return &FieldError{"Processes", "process list must match the built-in structure"}
	}
	for i, p := range cfg.Processes {
		pre := fmt.Sprintf("Processes[%d]", i)
		if p.ID != Default.Processes[i].ID {
			return &FieldError{pre + ".ID", "process ids and order are fixed"}
		}
		if p.DensityGCm3 <= 0 || p.PlnPerKg <= 0 || p.Factor <= 0 || p.PlnPerHour <= 0 {
			return &FieldError{pre, "rates and density must be positive"}
		}
		if p.Build.X <= 0 || p.Build.Y <= 0 || p.Build.Z <= 0 {
			return &FieldError{pre + ".Build", "build volume must be positive"}
		}
	}
	if len(cfg.LeadTimes) != len(Default.LeadTimes) {
		return &FieldError{"LeadTimes", "lead-time list must match the built-in structure"}
	}
	for i, lt := range cfg.LeadTimes {
		pre := fmt.Sprintf("LeadTimes[%d]", i)
		if lt.ID != Default.LeadTimes[i].ID {
			return &FieldError{pre + ".ID", "lead-time ids and order are fixed"}
		}
		if lt.Mult <= 0 {
			return &FieldError{pre + ".Mult", "multiplier must be positive"}
		}
		if lt.BusinessDays < 1 {
			return &FieldError{pre + ".BusinessDays", "must be at least 1"}
		}
	}
	if len(cfg.Nozzles) != len(Default.Nozzles) {
		return &FieldError{"Nozzles", "nozzle list must match the built-in structure"}
	}
	for i, n := range cfg.Nozzles {
		pre := fmt.Sprintf("Nozzles[%d]", i)
		if n.ID != Default.Nozzles[i].ID {
			return &FieldError{pre + ".ID", "nozzle ids and order are fixed"}
		}
		if n.DiameterMm <= 0 || n.ShellMult <= 0 || n.ThroughputMult <= 0 {
			// A zero throughput would divide by zero on every price call.
			return &FieldError{pre, "diameter and multipliers must be positive"}
		}
	}
	if len(cfg.Infills) != len(Default.Infills) {
		return &FieldError{"Infills", "infill list must match the built-in structure"}
	}
	for i, inf := range cfg.Infills {
		pre := fmt.Sprintf("Infills[%d]", i)
		if inf.ID != Default.Infills[i].ID {
			return &FieldError{pre + ".ID", "infill ids and order are fixed"}
		}
		if inf.Fraction <= 0 || inf.Fraction > 1 {
			return &FieldError{pre + ".Fraction", "must be in (0, 1]"}
		}
	}
	// Colours are the one editable list: plan 14 §5 wants new colourways added
	// from the editor without a deploy. Ids stay fixed for the ones that exist
	// so persisted orders keep resolving, and the default must survive.
	if len(cfg.Colors) < len(Default.Colors) {
		return &FieldError{"Colors", "built-in colours cannot be removed"}
	}
	for i, col := range cfg.Colors {
		pre := fmt.Sprintf("Colors[%d]", i)
		if i < len(Default.Colors) && col.ID != Default.Colors[i].ID {
			return &FieldError{pre + ".ID", "built-in colour ids and order are fixed"}
		}
		if col.ID == "" || col.Label == "" || col.Hex == "" {
			return &FieldError{pre, "id, label and hex are required"}
		}
	}
	if cfg.ColorSurchargeFraction < 0 || cfg.ColorSurchargeFraction >= 1 {
		return &FieldError{"ColorSurchargeFraction", "must be in [0, 1)"}
	}
	if cfg.ColorSurchargeLeadDays < 0 {
		return &FieldError{"ColorSurchargeLeadDays", "must be non-negative"}
	}

	f := cfg.Fdm
	if f.InfillFraction <= 0 || f.InfillFraction > 1 {
		return &FieldError{"Fdm.InfillFraction", "must be in (0, 1]"}
	}
	if f.ShellThicknessMm <= 0 || f.ShellGramsPerPrintHour <= 0 || f.InfillGramsPerPrintHour <= 0 {
		return &FieldError{"Fdm", "shell/infill rates must be positive"}
	}
	// InterpolateDiscount reads tiers[0] unconditionally — an empty list would
	// panic on every price call, so it must never validate.
	if len(cfg.DiscountTiers) == 0 {
		return &FieldError{"DiscountTiers", "at least one tier is required"}
	}
	for i, t := range cfg.DiscountTiers {
		pre := fmt.Sprintf("DiscountTiers[%d]", i)
		if i == 0 && t.Quantity != 1 {
			return &FieldError{pre + ".Quantity", "first tier must start at 1"}
		}
		if i > 0 && t.Quantity <= cfg.DiscountTiers[i-1].Quantity {
			return &FieldError{pre + ".Quantity", "tiers must be ascending"}
		}
		if t.Fraction < 0 || t.Fraction >= 1 {
			return &FieldError{pre + ".Fraction", "must be in [0, 1)"}
		}
	}
	fees := map[string]float64{
		"ExtraPlateFeePln":         cfg.ExtraPlateFeePln,
		"PlateGutterMm":            cfg.PlateGutterMm,
		"MinOrderPln":              cfg.MinOrderPln,
		"MinPartPricePln":          cfg.MinPartPricePln,
		"OrderFeePln":              cfg.OrderFeePln,
		"ShippingFlatPln":          cfg.ShippingFlatPln,
		"FreeShippingThresholdPln": cfg.FreeShippingThresholdPln,
		"MinBillableVolumeCm3":     cfg.MinBillableVolumeCm3,
		"MinFeatureMm":             cfg.MinFeatureMm,
	}
	for name, v := range fees {
		if v < 0 {
			return &FieldError{name, "must be non-negative"}
		}
	}
	if cfg.VatRate <= 0 || cfg.VatRate >= 1 {
		return &FieldError{"VatRate", "must be in (0, 1)"}
	}
	if cfg.SameDayCutoffHour < 0 || cfg.SameDayCutoffHour > 23 {
		return &FieldError{"SameDayCutoffHour", "must be in [0, 23]"}
	}
	return nil
}
