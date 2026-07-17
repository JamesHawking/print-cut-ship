// OBJ parser -> position soup. v/f lines only, fan-triangulates n-gon faces,
// ignores materials/normals/UVs. Port of instant-quote/src/lib/mesh/parse-obj.ts.

package mesh

import (
	"strconv"
	"strings"
)

func parseObj(data []byte) ([]float32, error) {
	text := string(data)
	var verts []float32 // flat x,y,z
	var out []float32

	corrupt := &ParseError{ErrCorrupt, "OBJ face references a missing vertex."}
	vertexAt := func(index int) (v [3]float32, err error) {
		// OBJ indices are 1-based; negative indices are relative to the end.
		count := len(verts) / 3
		i := index - 1
		if index <= 0 {
			i = count + index
		}
		if i < 0 || i >= count {
			return v, corrupt
		}
		return [3]float32{verts[i*3], verts[i*3+1], verts[i*3+2]}, nil
	}

	for line := range strings.SplitSeq(text, "\n") {
		trimmed := strings.TrimSpace(line)
		if len(trimmed) == 0 || strings.HasPrefix(trimmed, "#") {
			continue
		}
		parts := strings.Fields(trimmed)
		switch parts[0] {
		case "v":
			if len(parts) < 4 {
				return nil, &ParseError{ErrCorrupt, "OBJ vertex line is malformed."}
			}
			for _, s := range parts[1:4] {
				f, err := strconv.ParseFloat(s, 64)
				if err != nil {
					return nil, &ParseError{ErrCorrupt, "OBJ vertex line is malformed."}
				}
				verts = append(verts, float32(f))
			}
		case "f":
			// Each token may be "v", "v/vt", "v//vn", "v/vt/vn" — take the v
			// index; unparseable tokens are skipped (TS NaN-filter semantics).
			var idx []int
			for _, tok := range parts[1:] {
				head, _, _ := strings.Cut(tok, "/")
				n, err := strconv.Atoi(head)
				if err != nil {
					continue
				}
				idx = append(idx, n)
			}
			// Fan-triangulate.
			for i := 1; i+1 < len(idx); i++ {
				a, err := vertexAt(idx[0])
				if err != nil {
					return nil, err
				}
				b, err := vertexAt(idx[i])
				if err != nil {
					return nil, err
				}
				c, err := vertexAt(idx[i+1])
				if err != nil {
					return nil, err
				}
				out = append(out, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
			}
		}
	}

	if len(out) == 0 {
		return nil, &ParseError{ErrCorrupt, "OBJ contains no triangles."}
	}
	return out, nil
}
