// Geometry analysis from a position soup (9 floats/triangle, mm units).
// Single pass for signed volume, surface area, bbox, triangle count.
// Port of instant-quote/src/lib/mesh/analyze.ts — WITHOUT the convex-hull
// fallback: when a mesh is not watertight the TS client substitutes its hull
// volume, but here Watertight=false is reported and the caller decides.

package mesh

import "math"

const inf = math.MaxFloat64

func analyzePositions(positions []float32) (Metrics, error) {
	triangleCount := len(positions) / 9
	if triangleCount == 0 {
		return Metrics{}, &ParseError{ErrEmpty, "Mesh has no triangles."}
	}

	var signedVol6 float64 // 6x signed volume, mm^3
	var area2 float64      // 2x area, mm^2
	minX, minY, minZ := inf, inf, inf
	maxX, maxY, maxZ := -inf, -inf, -inf

	for i := 0; i < triangleCount*9; i += 9 {
		ax := float64(positions[i])
		ay := float64(positions[i+1])
		az := float64(positions[i+2])
		bx := float64(positions[i+3])
		by := float64(positions[i+4])
		bz := float64(positions[i+5])
		cx := float64(positions[i+6])
		cy := float64(positions[i+7])
		cz := float64(positions[i+8])

		// Signed volume: dot(a, cross(b, c))
		crx := by*cz - bz*cy
		cry := bz*cx - bx*cz
		crz := bx*cy - by*cx
		signedVol6 += ax*crx + ay*cry + az*crz

		// Area: |cross(b-a, c-a)| / 2
		e1x := bx - ax
		e1y := by - ay
		e1z := bz - az
		e2x := cx - ax
		e2y := cy - ay
		e2z := cz - az
		nx := e1y*e2z - e1z*e2y
		ny := e1z*e2x - e1x*e2z
		nz := e1x*e2y - e1y*e2x
		area2 += math.Sqrt(nx*nx + ny*ny + nz*nz)

		for _, p := range [3][3]float64{{ax, ay, az}, {bx, by, bz}, {cx, cy, cz}} {
			if p[0] < minX {
				minX = p[0]
			}
			if p[0] > maxX {
				maxX = p[0]
			}
			if p[1] < minY {
				minY = p[1]
			}
			if p[1] > maxY {
				maxY = p[1]
			}
			if p[2] < minZ {
				minZ = p[2]
			}
			if p[2] > maxZ {
				maxZ = p[2]
			}
		}
	}

	bboxMm := Vec3{X: maxX - minX, Y: maxY - minY, Z: maxZ - minZ}
	bboxVolumeCm3 := (bboxMm.X * bboxMm.Y * bboxMm.Z) / 1000

	signedVolumeCm3 := signedVol6 / 6 / 1000
	absVolumeCm3 := math.Abs(signedVolumeCm3)

	// Watertight test: positive signed volume within the bounding box, and —
	// for meshes small enough to check cheaply — every edge shared by exactly
	// two triangles (2-manifold, i.e. actually closed). Skip the edge check on
	// very large meshes for performance.
	signOk := signedVolumeCm3 > 0 && absVolumeCm3 <= bboxVolumeCm3*1.001
	manifold := triangleCount >= 200_000 || isEdgeManifold(positions, triangleCount)
	watertight := signOk && manifold

	return Metrics{
		VolumeCm3:          absVolumeCm3,
		RawSignedVolumeCm3: signedVolumeCm3,
		SurfaceAreaCm2:     area2 / 2 / 100,
		BboxMm:             bboxMm,
		TriangleCount:      triangleCount,
		Watertight:         watertight,
		UsedHullFallback:   false, // Go has no hull fallback
	}, nil
}

// isEdgeManifold reports whether every edge is shared by exactly two triangles
// (closed 2-manifold). Vertices are quantized to 1e-4 mm before comparison.
func isEdgeManifold(positions []float32, triangleCount int) bool {
	type key [3]int64
	vertexID := map[key]int{}
	idOf := func(i int) int {
		k := key{
			int64(math.Round(float64(positions[i]) * 1e4)),
			int64(math.Round(float64(positions[i+1]) * 1e4)),
			int64(math.Round(float64(positions[i+2]) * 1e4)),
		}
		id, ok := vertexID[k]
		if !ok {
			id = len(vertexID)
			vertexID[k] = id
		}
		return id
	}

	edgeCount := map[[2]int]int{}
	bump := func(u, v int) {
		if u > v {
			u, v = v, u
		}
		edgeCount[[2]int{u, v}]++
	}

	for t := 0; t < triangleCount; t++ {
		i := t * 9
		a := idOf(i)
		b := idOf(i + 3)
		c := idOf(i + 6)
		bump(a, b)
		bump(b, c)
		bump(c, a)
	}

	for _, count := range edgeCount {
		if count != 2 {
			return false
		}
	}
	return true
}
