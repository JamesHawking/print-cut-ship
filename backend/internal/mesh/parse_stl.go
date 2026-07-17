// STL parser (binary + ASCII) -> position soup (9 floats/triangle).
// Port of instant-quote/src/lib/mesh/parse-stl.ts.

package mesh

import (
	"encoding/binary"
	"math"
	"regexp"
	"strconv"
)

func isBinarySTL(data []byte) bool {
	if len(data) < 84 {
		return false
	}
	triCount := binary.LittleEndian.Uint32(data[80:84])
	// The one reliable check: exact expected byte length for binary layout.
	return 84+int(triCount)*50 == len(data)
}

func parseBinarySTL(data []byte) ([]float32, error) {
	triCount := int(binary.LittleEndian.Uint32(data[80:84]))
	if triCount == 0 {
		return nil, &ParseError{ErrEmpty, "STL has no triangles."}
	}
	out := make([]float32, 0, triCount*9)
	offset := 84
	for t := 0; t < triCount; t++ {
		offset += 12 // skip normal
		for v := 0; v < 9; v++ {
			bits := binary.LittleEndian.Uint32(data[offset : offset+4])
			out = append(out, math.Float32frombits(bits))
			offset += 4
		}
		offset += 2 // attribute byte count
	}
	return out, nil
}

var (
	asciiStlGate = regexp.MustCompile(`(?i)facet|vertex`)
	stlVertexRe  = regexp.MustCompile(`vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)`)
)

func parseAsciiSTL(text string) ([]float32, error) {
	matches := stlVertexRe.FindAllStringSubmatch(text, -1)
	coords := make([]float32, 0, len(matches)*3)
	for _, m := range matches {
		for _, s := range m[1:4] {
			// Parse at 64-bit then narrow, matching Float32Array storage of a
			// JS number. Strict: garbage floats are corrupt (TS parseFloat
			// leniency is deliberately not reproduced).
			v, err := strconv.ParseFloat(s, 64)
			if err != nil {
				return nil, &ParseError{ErrCorrupt, "Could not parse ASCII STL triangles."}
			}
			coords = append(coords, float32(v))
		}
	}
	if len(coords) == 0 || len(coords)%9 != 0 {
		return nil, &ParseError{ErrCorrupt, "Could not parse ASCII STL triangles."}
	}
	return coords, nil
}

func parseStl(data []byte) ([]float32, error) {
	if len(data) == 0 {
		return nil, &ParseError{ErrEmpty, "File is empty."}
	}
	if isBinarySTL(data) {
		return parseBinarySTL(data)
	}
	text := string(data)
	if !asciiStlGate.MatchString(text) {
		return nil, &ParseError{ErrCorrupt, "Not a recognizable STL file."}
	}
	return parseAsciiSTL(text)
}
