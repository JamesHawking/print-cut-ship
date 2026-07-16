package money

import (
	"math"
	"testing"
)

func TestToGrosze(t *testing.T) {
	cases := []struct {
		pln  float64
		want int32
	}{
		{0, 0},
		{1.5, 150},        // MinPartPricePln
		{21.64, 2164},     // Basket reference anchor
		{33.67, 3367},     // mapi-tech reference anchor
		{54.67, 5467},     // reference checkout total
		{1234.56, 123456}, // large value, no drift
		{0.004, 0},        // below half → rounds down
		{0.005, 1},        // exactly half → rounds up (half-up)
	}
	for _, c := range cases {
		got, err := ToGrosze(c.pln)
		if err != nil {
			t.Errorf("ToGrosze(%v) error: %v", c.pln, err)
			continue
		}
		if got != c.want {
			t.Errorf("ToGrosze(%v) = %d, want %d", c.pln, got, c.want)
		}
	}
}

func TestToGroszeRange(t *testing.T) {
	for _, pln := range []float64{
		math.MaxInt32/100 + 1, // just over the int32 grosze ceiling
		-math.MaxInt32 / 50,
		2.25e7, // 22.5M PLN → 2.25e9 grosze > MaxInt32
		math.NaN(),
	} {
		if got, err := ToGrosze(pln); err == nil {
			t.Errorf("ToGrosze(%v) = %d, want out-of-range error", pln, got)
		}
	}
	// The ceiling itself still converts.
	if _, err := ToGrosze(21474836.47); err != nil {
		t.Errorf("ToGrosze(MaxInt32 grosze) unexpected error: %v", err)
	}
}

func TestFromGroszeRoundTrip(t *testing.T) {
	for _, pln := range []float64{0, 1.5, 33.67, 54.67, 1234.56} {
		g, err := ToGrosze(pln)
		if err != nil {
			t.Fatalf("ToGrosze(%v): %v", pln, err)
		}
		if got := FromGrosze(g); got != pln {
			t.Errorf("round-trip %v = %v", pln, got)
		}
	}
}
