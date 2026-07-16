// Package money converts between PLN floats (as the pricing engine produces)
// and integer grosze (as the database stores). Rounding matches the pricing
// engine's round2 (JS Math.round semantics: half-up toward +Inf), so a value
// the engine already rounded to 2 dp converts without drift.
package money

import (
	"fmt"
	"math"
)

// ToGrosze converts a PLN amount to integer grosze using half-up rounding,
// identical to pricing.round2's math.Floor(n*100+0.5). It errors when the
// result does not fit int32 — Go's out-of-range float→int conversion is
// unspecified, so an unchecked cast would silently store corrupt money.
func ToGrosze(pln float64) (int32, error) {
	g := math.Floor(pln*100 + 0.5)
	if g > math.MaxInt32 || g < math.MinInt32 || math.IsNaN(g) {
		return 0, fmt.Errorf("money: %v PLN out of int32 grosze range", pln)
	}
	return int32(g), nil
}

// FromGrosze converts integer grosze back to a PLN float.
func FromGrosze(g int32) float64 {
	return float64(g) / 100
}
