package mesh

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"math"
	"os"
	"testing"
)

// golden.json is generated from the real TypeScript mesh pipeline
// (instant-quote/tests/golden/mesh-generate.ts). Regenerate with
//
//	cd instant-quote && bun tests/golden/mesh-generate.ts
//
// Comparison is TOLERANCE-based (relative 1e-6), NOT bit-exact: the Go engine
// is authoritative at quote time, so it only needs to agree with the client
// within noise. For cases where TS used its convex-hull fallback
// (usedHullFallback: true), only the hull-independent fields are checked —
// Go has no hull, so it reports Watertight=false and a raw signed volume.

const relTol = 1e-6

type goldenFile struct {
	Metrics []struct {
		Name     string  `json:"name"`
		Kind     string  `json:"kind"`
		DataB64  string  `json:"dataB64"`
		Expected Metrics `json:"expected"`
	} `json:"metrics"`
	Errors []struct {
		Name         string `json:"name"`
		Kind         string `json:"kind"`
		DataB64      string `json:"dataB64"`
		ExpectedCode string `json:"expectedCode"`
	} `json:"errors"`
}

func loadGolden(t *testing.T) goldenFile {
	t.Helper()
	raw, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatalf("read golden file: %v", err)
	}
	var g goldenFile
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parse golden file: %v", err)
	}
	return g
}

func decodeB64(t *testing.T, s string) []byte {
	t.Helper()
	data, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}
	return data
}

// closeEnough compares two floats at relative tolerance relTol, with an
// absolute floor for values near zero.
func closeEnough(got, want float64) bool {
	diff := math.Abs(got - want)
	if diff <= 1e-9 {
		return true
	}
	scale := math.Max(math.Abs(got), math.Abs(want))
	return diff <= relTol*scale
}

func TestGoldenMetrics(t *testing.T) {
	g := loadGolden(t)
	if len(g.Metrics) < 16 {
		t.Fatalf("suspiciously few metrics cases: %d", len(g.Metrics))
	}
	for _, tc := range g.Metrics {
		got, err := Analyze(tc.Kind, decodeB64(t, tc.DataB64))
		if err != nil {
			t.Errorf("%s: unexpected error: %v", tc.Name, err)
			continue
		}
		w := tc.Expected

		// Hull-independent fields are always checked.
		if !closeEnough(got.SurfaceAreaCm2, w.SurfaceAreaCm2) {
			t.Errorf("%s: surfaceAreaCm2 got %v want %v", tc.Name, got.SurfaceAreaCm2, w.SurfaceAreaCm2)
		}
		if !closeEnough(got.BboxMm.X, w.BboxMm.X) || !closeEnough(got.BboxMm.Y, w.BboxMm.Y) || !closeEnough(got.BboxMm.Z, w.BboxMm.Z) {
			t.Errorf("%s: bboxMm got %+v want %+v", tc.Name, got.BboxMm, w.BboxMm)
		}
		if got.TriangleCount != w.TriangleCount {
			t.Errorf("%s: triangleCount got %d want %d", tc.Name, got.TriangleCount, w.TriangleCount)
		}
		if len(got.Pieces) != len(w.Pieces) {
			t.Errorf("%s: pieces len got %d want %d", tc.Name, len(got.Pieces), len(w.Pieces))
		} else {
			for i := range got.Pieces {
				gp, wp := got.Pieces[i].BboxMm, w.Pieces[i].BboxMm
				if !closeEnough(gp.X, wp.X) || !closeEnough(gp.Y, wp.Y) || !closeEnough(gp.Z, wp.Z) {
					t.Errorf("%s: piece[%d] bbox got %+v want %+v", tc.Name, i, gp, wp)
				}
			}
		}

		if w.UsedHullFallback {
			// TS substituted a hull volume and marked the mesh non-watertight.
			// Go has no hull: assert only that it also finds it non-watertight.
			if got.Watertight {
				t.Errorf("%s: expected non-watertight (TS used hull), got watertight", tc.Name)
			}
			continue
		}

		if got.Watertight != w.Watertight {
			t.Errorf("%s: watertight got %v want %v", tc.Name, got.Watertight, w.Watertight)
		}
		if !closeEnough(got.VolumeCm3, w.VolumeCm3) {
			t.Errorf("%s: volumeCm3 got %v want %v", tc.Name, got.VolumeCm3, w.VolumeCm3)
		}
	}
}

func TestGoldenErrors(t *testing.T) {
	g := loadGolden(t)
	for _, tc := range g.Errors {
		_, err := Analyze(tc.Kind, decodeB64(t, tc.DataB64))
		var pe *ParseError
		if !errors.As(err, &pe) {
			t.Errorf("%s: expected *ParseError, got %v", tc.Name, err)
			continue
		}
		if string(pe.Code) != tc.ExpectedCode {
			t.Errorf("%s: code got %q want %q", tc.Name, pe.Code, tc.ExpectedCode)
		}
	}
}

func TestStepUnsupported(t *testing.T) {
	_, err := Analyze("step", []byte("ISO-10303-21;"))
	var pe *ParseError
	if !errors.As(err, &pe) || pe.Code != ErrUnsupported {
		t.Fatalf("step: expected unsupported ParseError, got %v", err)
	}
}

func TestPiecesOmittedWhenNil(t *testing.T) {
	m := Metrics{VolumeCm3: 1, TriangleCount: 12}
	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(raw); contains(got, "pieces") {
		t.Errorf("expected pieces field omitted, got %s", got)
	}
}

func TestZipBombCap(t *testing.T) {
	// A valid 3MF whose decompressed size exceeds a lowered cap must be
	// rejected as corrupt rather than read into memory.
	orig := maxDecompressedBytes
	maxDecompressedBytes = 64 // bytes — far below any real model
	defer func() { maxDecompressedBytes = orig }()

	data := smallValid3mf(t)
	_, err := Analyze("3mf", data)
	var pe *ParseError
	if !errors.As(err, &pe) || pe.Code != ErrCorrupt {
		t.Fatalf("expected corrupt (cap exceeded), got %v", err)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
