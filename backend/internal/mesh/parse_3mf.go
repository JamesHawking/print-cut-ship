// 3MF parser, including the *production extension* (Bambu Studio, OrcaSlicer,
// PrusaSlicer, Fusion 360) where a build item references a components object
// whose parts live in separate `.model` files inside the zip, addressed by
// `p:path`. Cross-part references are resolved and everything flattens to one
// world-space triangle soup per top-level build item (= one physical piece).
//
// Port of instant-quote/src/lib/mesh/parse-3mf.ts, but idiomatic: a streaming
// encoding/xml token scanner instead of the client's regex scanner. Behavior
// on well-formed files is pinned by golden fixtures; malformed-file
// classification may differ (both engines call it "corrupt").

package mesh

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"regexp"
	"strconv"
	"strings"
)

// maxDecompressedBytes caps the cumulative decompressed size read out of one
// 3MF archive. Uploads are already capped at 100 MB compressed; this guards
// the server against zip bombs (a browser-only concern the TS engine never
// had). Var, not const, so tests can lower it.
var maxDecompressedBytes = int64(512 << 20)

// A 3MF transform: 4 rows of 3 (row-vector convention). A point p maps to
// world as [x y z 1] * M, i.e. x' = x*m0 + y*m3 + z*m6 + m9, etc.
type mat [12]float64

var identityMat = mat{1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0}

type component struct {
	path      string // "" = same model part
	objectID  string
	transform mat
}

type objectDef struct {
	verts      []float32 // flat x,y,z
	tris       []uint32
	components []component
}

type modelPart map[string]*objectDef

type buildItem struct {
	objectID  string
	transform mat
}

func corrupt3mf() error {
	return &ParseError{ErrCorrupt, "Could not read the 3MF file."}
}

func parseTransform(s string) mat {
	if s == "" {
		return identityMat
	}
	fields := strings.Fields(s)
	if len(fields) != 12 {
		return identityMat
	}
	var m mat
	for i, f := range fields {
		v, err := strconv.ParseFloat(f, 64)
		if err != nil {
			return identityMat
		}
		m[i] = v
	}
	return m
}

// Compose so a point maps as p * a * b (apply `a` first, then `b`).
func multiplyMat(a, b mat) mat {
	var r mat
	for i := 0; i < 4; i++ {
		a0, a1, a2 := a[i*3], a[i*3+1], a[i*3+2]
		for j := 0; j < 3; j++ {
			v := a0*b[j] + a1*b[3+j] + a2*b[6+j]
			if i == 3 {
				v += b[9+j]
			}
			r[i*3+j] = v
		}
	}
	return r
}

// attrVal returns an unprefixed attribute by name ("" when absent).
func attrVal(e xml.StartElement, name string) string {
	for _, a := range e.Attr {
		if a.Name.Local == name && a.Name.Space == "" {
			return a.Value
		}
	}
	return ""
}

// attrValAnyNS matches by local name regardless of namespace prefix — the
// production extension writes `p:path`, and the prefix is arbitrary.
func attrValAnyNS(e xml.StartElement, name string) string {
	for _, a := range e.Attr {
		if a.Name.Local == name {
			return a.Value
		}
	}
	return ""
}

// parseModelFile scans one .model XML document into its object definitions
// and (for the root model) its build items.
func parseModelFile(data []byte) (modelPart, []buildItem, error) {
	part := modelPart{}
	var items []buildItem

	dec := xml.NewDecoder(bytes.NewReader(data))
	var cur *objectDef
	var curID string
	inMesh := false
	inBuild := false

	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, corrupt3mf()
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "object":
				if id := attrVal(t, "id"); id != "" {
					cur = &objectDef{}
					curID = id
				} else {
					cur = nil
				}
			case "mesh":
				if cur != nil {
					inMesh = true
				}
			case "vertex":
				if cur != nil && inMesh {
					for _, name := range [3]string{"x", "y", "z"} {
						v, err := strconv.ParseFloat(attrVal(t, name), 64)
						if err != nil {
							return nil, nil, corrupt3mf()
						}
						cur.verts = append(cur.verts, float32(v))
					}
				}
			case "triangle":
				if cur != nil && inMesh {
					for _, name := range [3]string{"v1", "v2", "v3"} {
						v, err := strconv.ParseUint(attrVal(t, name), 10, 32)
						if err != nil {
							return nil, nil, corrupt3mf()
						}
						cur.tris = append(cur.tris, uint32(v))
					}
				}
			case "component":
				if cur != nil {
					objectid := attrVal(t, "objectid")
					if objectid == "" {
						continue
					}
					cur.components = append(cur.components, component{
						objectID:  objectid,
						path:      attrValAnyNS(t, "path"),
						transform: parseTransform(attrVal(t, "transform")),
					})
				}
			case "build":
				inBuild = true
			case "item":
				if inBuild {
					objectid := attrVal(t, "objectid")
					if objectid == "" {
						continue
					}
					items = append(items, buildItem{
						objectID:  objectid,
						transform: parseTransform(attrVal(t, "transform")),
					})
				}
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "object":
				if cur != nil && curID != "" {
					part[curID] = cur
				}
				cur = nil
				curID = ""
			case "mesh":
				inMesh = false
			case "build":
				inBuild = false
			}
		}
	}
	return part, items, nil
}

// rootModelPath resolves the primary model part via _rels/.rels, mirroring the
// TS parser: first Relationship whose Type ends with "3dmodel" wins.
func rootModelPath(relsData []byte) string {
	dec := xml.NewDecoder(bytes.NewReader(relsData))
	for {
		tok, err := dec.Token()
		if err != nil {
			return ""
		}
		if t, ok := tok.(xml.StartElement); ok && t.Name.Local == "Relationship" {
			target := attrVal(t, "Target")
			typ := attrVal(t, "Type")
			if target != "" && strings.HasSuffix(strings.ToLower(typ), "3dmodel") {
				return strings.TrimLeft(target, "/")
			}
		}
	}
}

var modelFileRe = regexp.MustCompile(`(?i)^3D/.*\.model$`)

// parse3mfParts parses a .3mf archive into one flattened position soup per
// top-level build item (world-space, 9 floats/tri).
func parse3mfParts(data []byte) ([][]float32, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, corrupt3mf()
	}

	files := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		files[strings.TrimLeft(f.Name, "/")] = f
	}
	budget := maxDecompressedBytes
	readEntry := func(name string) ([]byte, error) {
		f, ok := files[strings.TrimLeft(name, "/")]
		if !ok {
			return nil, nil
		}
		rc, err := f.Open()
		if err != nil {
			return nil, corrupt3mf()
		}
		defer rc.Close()
		buf, err := io.ReadAll(io.LimitReader(rc, budget+1))
		if err != nil {
			return nil, corrupt3mf()
		}
		if int64(len(buf)) > budget {
			return nil, &ParseError{ErrCorrupt, "3MF decompressed size exceeds the safety cap."}
		}
		budget -= int64(len(buf))
		return buf, nil
	}

	// Locate the primary model part via _rels/.rels, else fall back.
	rootPath := "3D/3dmodel.model"
	if rels, err := readEntry("_rels/.rels"); err != nil {
		return nil, err
	} else if rels != nil {
		if p := rootModelPath(rels); p != "" {
			rootPath = p
		}
	}
	if _, ok := files[rootPath]; !ok {
		for _, f := range zr.File {
			name := strings.TrimLeft(f.Name, "/")
			if modelFileRe.MatchString(name) {
				rootPath = name
				break
			}
		}
	}

	partCache := map[string]modelPart{}
	rootItems := []buildItem(nil)
	getPart := func(path string) (modelPart, error) {
		norm := strings.TrimLeft(path, "/")
		if cached, ok := partCache[norm]; ok {
			return cached, nil
		}
		data, err := readEntry(norm)
		if err != nil {
			return nil, err
		}
		if data == nil {
			return nil, nil // missing part: skip, like the TS parser
		}
		part, items, err := parseModelFile(data)
		if err != nil {
			return nil, err
		}
		if norm == rootPath {
			rootItems = items
		}
		partCache[norm] = part
		return part, nil
	}

	if part, err := getPart(rootPath); err != nil {
		return nil, err
	} else if part == nil {
		return nil, corrupt3mf()
	}

	var chunks [][]float32
	var emitObject func(partPath, objectID string, matrix mat, depth int) error
	emitObject = func(partPath, objectID string, matrix mat, depth int) error {
		if depth > 50 {
			return nil
		}
		part, err := getPart(partPath)
		if err != nil {
			return err
		}
		if part == nil {
			return nil
		}
		def, ok := part[objectID]
		if !ok {
			return nil
		}
		if len(def.tris) > 0 && len(def.verts) > 0 {
			v := def.verts
			out := make([]float32, 0, len(def.tris)*3)
			for _, ti := range def.tris {
				vi := int(ti) * 3
				if vi+2 >= len(v) {
					return &ParseError{ErrCorrupt, "3MF triangle references a missing vertex."}
				}
				x := float64(v[vi])
				y := float64(v[vi+1])
				z := float64(v[vi+2])
				out = append(out,
					float32(x*matrix[0]+y*matrix[3]+z*matrix[6]+matrix[9]),
					float32(x*matrix[1]+y*matrix[4]+z*matrix[7]+matrix[10]),
					float32(x*matrix[2]+y*matrix[5]+z*matrix[8]+matrix[11]),
				)
			}
			chunks = append(chunks, out)
			return nil
		}
		for _, c := range def.components {
			childPath := partPath
			if c.path != "" {
				childPath = c.path
			}
			if err := emitObject(childPath, c.objectID, multiplyMat(c.transform, matrix), depth+1); err != nil {
				return err
			}
		}
		return nil
	}

	var parts [][]float32
	for _, item := range rootItems {
		chunks = nil
		if err := emitObject(rootPath, item.objectID, item.transform, 0); err != nil {
			return nil, err
		}
		merged := mergeParts(chunks)
		if len(merged) > 0 {
			parts = append(parts, merged)
		}
	}

	if len(parts) == 0 {
		return nil, &ParseError{ErrEmpty, "3MF contains no printable geometry."}
	}
	return parts, nil
}
