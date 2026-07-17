package mesh

import "testing"

// smallValid3mf returns the bytes of a real, well-formed 3MF from the golden
// fixtures (the first 3mf metrics case).
func smallValid3mf(t *testing.T) []byte {
	t.Helper()
	g := loadGolden(t)
	for _, tc := range g.Metrics {
		if tc.Kind == "3mf" {
			return decodeB64(t, tc.DataB64)
		}
	}
	t.Fatal("no 3mf metrics case in golden fixtures")
	return nil
}
