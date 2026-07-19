package orders

import "testing"

func TestValidNIP(t *testing.T) {
	valid := []string{
		"8567346215", // canonical checksum example
		"5261040828",
	}
	for _, s := range valid {
		if !ValidNIP(s) {
			t.Errorf("ValidNIP(%q) = false, want true", s)
		}
	}
	invalid := []string{
		"",            // empty
		"856734621",   // too short
		"85673462150", // too long
		"8567346214",  // wrong check digit
		"85673a6215",  // non-digit
		"00000000000", // check digit 10 case can never be valid
	}
	for _, s := range invalid {
		if ValidNIP(s) {
			t.Errorf("ValidNIP(%q) = true, want false", s)
		}
	}
}
