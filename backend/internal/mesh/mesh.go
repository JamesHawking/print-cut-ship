// Package mesh is the server-side port of the client's mesh-analysis pipeline
// (instant-quote/src/lib/mesh). It parses STL/OBJ/3MF bytes into a triangle
// soup and computes the pricing-relevant metrics from geometry the server
// actually holds.
//
// The port is idiomatic Go, NOT a bit-exact clone: the server's numbers are
// authoritative at quote time, so the two engines only need tolerance-level
// agreement (golden fixtures compare at relative 1e-6). Two deliberate
// divergences from the TS engine:
//
//   - No convex-hull fallback. When a mesh is not watertight the TS client
//     substitutes its hull volume; Go reports Watertight=false and the caller
//     decides (quote recompute defers to the client's metrics and flags it).
//   - Strict float parsing. TS parseFloat/Number leniency (prefix parsing,
//     NaN propagation) is not reproduced; garbage input fails as "corrupt",
//     which the recompute path treats as a soft fallback.
package mesh

// Vec3 marshals like the TS bboxMm shape.
type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Piece is a per-build-item bounding box for multi-item 3MF files.
type Piece struct {
	BboxMm Vec3 `json:"bboxMm"`
}

// Metrics marshals exactly like the TS MeshMetrics interface
// (instant-quote/src/lib/mesh/types.ts).
type Metrics struct {
	VolumeCm3          float64 `json:"volumeCm3"`
	RawSignedVolumeCm3 float64 `json:"rawSignedVolumeCm3"`
	SurfaceAreaCm2     float64 `json:"surfaceAreaCm2"`
	BboxMm             Vec3    `json:"bboxMm"`
	TriangleCount      int     `json:"triangleCount"`
	Watertight         bool    `json:"watertight"`
	UsedHullFallback   bool    `json:"usedHullFallback"`
	Pieces             []Piece `json:"pieces,omitempty"`
}

// ErrorCode mirrors the client's WorkerErrorCode.
type ErrorCode string

const (
	ErrCorrupt     ErrorCode = "corrupt"
	ErrEmpty       ErrorCode = "empty"
	ErrUnsupported ErrorCode = "unsupported"
)

type ParseError struct {
	Code ErrorCode
	Msg  string
}

func (e *ParseError) Error() string { return string(e.Code) + ": " + e.Msg }

// Analyze parses the raw file bytes for the given kind ("stl", "obj", "3mf")
// and computes metrics. "step" and unknown kinds return ErrUnsupported —
// STEP stays client-only (no Go OCCT).
func Analyze(kind string, data []byte) (Metrics, error) {
	switch kind {
	case "stl":
		pos, err := parseStl(data)
		if err != nil {
			return Metrics{}, err
		}
		return analyzePositions(pos)
	case "obj":
		pos, err := parseObj(data)
		if err != nil {
			return Metrics{}, err
		}
		return analyzePositions(pos)
	case "3mf":
		parts, err := parse3mfParts(data)
		if err != nil {
			return Metrics{}, err
		}
		// Mirrors useMeshWorker.analyze(): per-piece bboxes when the build
		// has >= 2 items; the geometry math runs on the merged soup.
		var pieces []Piece
		if len(parts) >= 2 {
			pieces = make([]Piece, len(parts))
			for i, p := range parts {
				pieces[i] = Piece{BboxMm: positionsBbox(p)}
			}
		}
		m, err := analyzePositions(mergeParts(parts))
		if err != nil {
			return Metrics{}, err
		}
		m.Pieces = pieces
		return m, nil
	default:
		return Metrics{}, &ParseError{ErrUnsupported, "unsupported format for analysis: " + kind}
	}
}

func mergeParts(parts [][]float32) []float32 {
	if len(parts) == 1 {
		return parts[0]
	}
	total := 0
	for _, p := range parts {
		total += len(p)
	}
	merged := make([]float32, 0, total)
	for _, p := range parts {
		merged = append(merged, p...)
	}
	return merged
}

func positionsBbox(positions []float32) Vec3 {
	minX, minY, minZ := inf, inf, inf
	maxX, maxY, maxZ := -inf, -inf, -inf
	for i := 0; i+2 < len(positions); i += 3 {
		x := float64(positions[i])
		y := float64(positions[i+1])
		z := float64(positions[i+2])
		if x < minX {
			minX = x
		}
		if x > maxX {
			maxX = x
		}
		if y < minY {
			minY = y
		}
		if y > maxY {
			maxY = y
		}
		if z < minZ {
			minZ = z
		}
		if z > maxZ {
			maxZ = z
		}
	}
	return Vec3{X: maxX - minX, Y: maxY - minY, Z: maxZ - minZ}
}
