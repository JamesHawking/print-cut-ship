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
