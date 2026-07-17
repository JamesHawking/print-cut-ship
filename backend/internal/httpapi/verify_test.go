package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"testing"

	"github.com/google/uuid"

	"github.com/JamesHawking/print-cut-ship/backend/internal/mesh"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// cubeBinaryStl builds a binary STL of a [0,s]^3 cube with outward-wound
// triangles (12 tris). |signed volume| = s^3 mm^3. Mirrors the TS fixture.
func cubeBinaryStl(s float32) []byte {
	corners := [8][3]float32{
		{0, 0, 0}, {s, 0, 0}, {s, s, 0}, {0, s, 0},
		{0, 0, s}, {s, 0, s}, {s, s, s}, {0, s, s},
	}
	faces := [6][4]int{
		{0, 1, 2, 3}, {4, 5, 6, 7}, {0, 1, 5, 4},
		{3, 2, 6, 7}, {0, 3, 7, 4}, {1, 2, 6, 5},
	}
	center := [3]float32{s / 2, s / 2, s / 2}
	sub := func(a, b [3]float32) [3]float32 { return [3]float32{a[0] - b[0], a[1] - b[1], a[2] - b[2]} }
	cross := func(a, b [3]float32) [3]float32 {
		return [3]float32{a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]}
	}
	dot := func(a, b [3]float32) float32 { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2] }

	var tris [][3]float32
	push := func(a, b, c [3]float32) {
		n := cross(sub(b, a), sub(c, a))
		if dot(n, sub(a, center)) >= 0 {
			tris = append(tris, a, b, c)
		} else {
			tris = append(tris, a, c, b)
		}
	}
	for _, f := range faces {
		push(corners[f[0]], corners[f[1]], corners[f[2]])
		push(corners[f[0]], corners[f[2]], corners[f[3]])
	}

	triCount := len(tris) / 3
	buf := make([]byte, 84+triCount*50)
	binary.LittleEndian.PutUint32(buf[80:84], uint32(triCount))
	off := 84
	for t := 0; t < triCount; t++ {
		off += 12 // zero normal
		for v := 0; v < 3; v++ {
			for k := 0; k < 3; k++ {
				binary.LittleEndian.PutUint32(buf[off:off+4], math.Float32bits(tris[t*3+v][k]))
				off += 4
			}
		}
		off += 2 // attribute
	}
	return buf
}

// openBoxBinaryStl drops the last 2 triangles of the cube (top face) -> an
// open, non-watertight mesh. Mirrors the TS fixture.
func openBoxBinaryStl(s float32) []byte {
	full := cubeBinaryStl(s)
	triCount := binary.LittleEndian.Uint32(full[80:84]) - 2
	buf := make([]byte, 84+int(triCount)*50)
	copy(buf, full[:84+int(triCount)*50])
	binary.LittleEndian.PutUint32(buf[80:84], triCount)
	return buf
}

// goldenCaseBytes returns the decoded bytes of a named 3mf case from the mesh
// package's golden fixtures, keeping the multi-item 3MF single-sourced.
func goldenCaseBytes(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile("../mesh/testdata/golden.json")
	if err != nil {
		t.Fatalf("read mesh golden: %v", err)
	}
	var g struct {
		Metrics []struct {
			Name    string `json:"name"`
			DataB64 string `json:"dataB64"`
		} `json:"metrics"`
	}
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parse mesh golden: %v", err)
	}
	for _, m := range g.Metrics {
		if m.Name == name {
			data, err := base64.StdEncoding.DecodeString(m.DataB64)
			if err != nil {
				t.Fatalf("decode %s: %v", name, err)
			}
			return data
		}
	}
	t.Fatalf("golden case %q not found", name)
	return nil
}

// storeFile puts bytes into storage under their content-addressed key and
// inserts a matching files row, returning the file id. When storageKey is
// given it overrides the object key written to the row (for tamper/miss tests).
func storeFile(t *testing.T, st *store.Store, strg *storage.Store, kind string, data []byte, hashOverride, keyOverride string) string {
	t.Helper()
	ctx := context.Background()
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])
	key := storage.Key(sha, kind)
	if err := strg.Put(ctx, key, bytes.NewReader(data), int64(len(data)), "application/octet-stream"); err != nil {
		t.Fatalf("put object: %v", err)
	}
	rowHash := sha
	if hashOverride != "" {
		rowHash = hashOverride
	}
	rowKey := key
	if keyOverride != "" {
		rowKey = keyOverride
	}
	id, err := st.InsertFile(ctx, store.InsertFileParams{
		FileName: "part." + kind, FileSizeBytes: int64(len(data)), Kind: kind,
		Hash: &rowHash, Source: "upload", StorageKey: &rowKey,
	})
	if err != nil {
		t.Fatalf("insert file: %v", err)
	}
	return id.String()
}

// submitQuoteWithFile posts a one-part quote referencing fileID with the given
// client-claimed metrics JSON and returns the recorder.
func submitQuoteWithFile(t *testing.T, h http.Handler, fileID, hash, metricsJSON string) *struct {
	code int
	body []byte
} {
	t.Helper()
	body := fmt.Sprintf(`{"email":"jan@example.com","country":"PL","parts":[{"fileId":%q,"fileName":"part.stl","hash":%q,"metrics":%s,"process":"pla","quantity":1,"leadTime":"standard"}]}`,
		fileID, hash, metricsJSON)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body)
	return &struct {
		code int
		body []byte
	}{rec.Code, rec.Body.Bytes()}
}

func fileMetrics(t *testing.T, st *store.Store, fileID string) *mesh.Metrics {
	t.Helper()
	id, err := uuid.Parse(fileID)
	if err != nil {
		t.Fatalf("parse id: %v", err)
	}
	f, err := st.GetFileByID(context.Background(), id)
	if err != nil {
		t.Fatalf("get file: %v", err)
	}
	if len(f.Metrics) == 0 {
		return nil
	}
	var m mesh.Metrics
	if err := json.Unmarshal(f.Metrics, &m); err != nil {
		t.Fatalf("unmarshal metrics: %v", err)
	}
	return &m
}

func firstQuotePartBillable(t *testing.T, st *store.Store, shortID string) float64 {
	t.Helper()
	ctx := context.Background()
	q, err := st.GetQuoteByShortID(ctx, shortID)
	if err != nil {
		t.Fatalf("get quote: %v", err)
	}
	parts, err := st.GetQuotePartsByQuoteID(ctx, q.ID)
	if err != nil {
		t.Fatalf("get parts: %v", err)
	}
	if len(parts) != 1 || parts[0].BillableVolumeCm3 == nil {
		t.Fatalf("expected 1 part with billable volume, got %+v", parts)
	}
	return *parts[0].BillableVolumeCm3
}

func TestRecomputeOverridesFabricatedMetrics(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := cubeBinaryStl(10) // 1 cm^3
	fileID := storeFile(t, st, strg, "stl", data, "", "")
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])

	// Client claims a tiny fabricated volume.
	res := submitQuoteWithFile(t, h, fileID, sha,
		`{"volumeCm3":0.001,"surfaceAreaCm2":0.06,"bboxMm":{"x":1,"y":1,"z":1},"usedHullFallback":false}`)
	if res.code != http.StatusOK {
		t.Fatalf("status %d: %s", res.code, res.body)
	}
	var out SubmitQuoteResponse
	if err := json.Unmarshal(res.body, &out); err != nil {
		t.Fatal(err)
	}
	if billable := firstQuotePartBillable(t, st, out.QuoteId); math.Abs(billable-1) > 1e-3 {
		t.Errorf("billable volume %.4f cm^3, want ~1 (server recompute should override 0.001)", billable)
	}
	m := fileMetrics(t, st, fileID)
	if m == nil || math.Abs(m.VolumeCm3-1) > 1e-3 || m.TriangleCount != 12 {
		t.Errorf("persisted file metrics wrong: %+v", m)
	}
}

func TestRecomputeRejectsTamperedBytes(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := cubeBinaryStl(10)
	// Row hash differs from the actual stored object's sha.
	bogus := hex.EncodeToString(make([]byte, 32))
	fileID := storeFile(t, st, strg, "stl", data, bogus, "")

	res := submitQuoteWithFile(t, h, fileID, bogus,
		`{"volumeCm3":1,"surfaceAreaCm2":6,"bboxMm":{"x":10,"y":10,"z":10},"usedHullFallback":false}`)
	if res.code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400: %s", res.code, res.body)
	}
	if !bytes.Contains(res.body, []byte("quote_file_invalid")) {
		t.Errorf("expected quote_file_invalid, got %s", res.body)
	}
}

func TestRecompute3mfPieces(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := goldenCaseBytes(t, "multi-item 3mf s=10 count=3 spacing=20 (pieces)")
	fileID := storeFile(t, st, strg, "3mf", data, "", "")
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])

	res := submitQuoteWithFile(t, h, fileID, sha,
		`{"volumeCm3":3,"surfaceAreaCm2":18,"bboxMm":{"x":50,"y":10,"z":10},"usedHullFallback":false,"pieces":[{"bboxMm":{"x":10,"y":10,"z":10}},{"bboxMm":{"x":10,"y":10,"z":10}},{"bboxMm":{"x":10,"y":10,"z":10}}]}`)
	if res.code != http.StatusOK {
		t.Fatalf("status %d: %s", res.code, res.body)
	}
	m := fileMetrics(t, st, fileID)
	if m == nil || len(m.Pieces) != 3 {
		t.Fatalf("expected 3 recomputed pieces, got %+v", m)
	}
}

func TestRecomputeSoftFallbackOnMissingObject(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := cubeBinaryStl(10)
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])
	// Row points at an object key that was never written.
	fileID := storeFile(t, st, strg, "stl", data, sha, "uploads/"+sha+"-missing.stl")

	res := submitQuoteWithFile(t, h, fileID, sha,
		`{"volumeCm3":2,"surfaceAreaCm2":9.6,"bboxMm":{"x":20,"y":20,"z":20},"usedHullFallback":false}`)
	if res.code != http.StatusOK {
		t.Fatalf("status %d: %s (soft fallback expected)", res.code, res.body)
	}
	var out SubmitQuoteResponse
	_ = json.Unmarshal(res.body, &out)
	// Client metrics (volume 2) kept, since the object couldn't be read.
	if billable := firstQuotePartBillable(t, st, out.QuoteId); math.Abs(billable-2) > 1e-3 {
		t.Errorf("billable %.4f, want ~2 (client metrics kept on soft fallback)", billable)
	}
	if m := fileMetrics(t, st, fileID); m != nil {
		t.Errorf("no metrics should be written on soft fallback, got %+v", m)
	}
}

func TestRecomputeSkipsStep(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := []byte("ISO-10303-21;\nHEADER;\nENDSEC;\n") // stand-in STEP bytes
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])
	fileID := storeFile(t, st, strg, "step", data, sha, "")

	res := submitQuoteWithFile(t, h, fileID, sha,
		`{"volumeCm3":5,"surfaceAreaCm2":15,"bboxMm":{"x":30,"y":20,"z":10},"usedHullFallback":false}`)
	if res.code != http.StatusOK {
		t.Fatalf("status %d: %s", res.code, res.body)
	}
	var out SubmitQuoteResponse
	_ = json.Unmarshal(res.body, &out)
	if billable := firstQuotePartBillable(t, st, out.QuoteId); math.Abs(billable-5) > 1e-3 {
		t.Errorf("billable %.4f, want ~5 (STEP is not recomputed)", billable)
	}
	if m := fileMetrics(t, st, fileID); m != nil {
		t.Errorf("STEP files should not get server metrics, got %+v", m)
	}
}

func TestRecomputeNonWatertightDefersToClient(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	data := openBoxBinaryStl(10) // not watertight
	fileID := storeFile(t, st, strg, "stl", data, "", "")
	sum := sha256.Sum256(data)
	sha := hex.EncodeToString(sum[:])

	// Client claims a hull-derived volume (what its fallback would produce).
	res := submitQuoteWithFile(t, h, fileID, sha,
		`{"volumeCm3":1,"surfaceAreaCm2":5,"bboxMm":{"x":10,"y":10,"z":10},"usedHullFallback":true}`)
	if res.code != http.StatusOK {
		t.Fatalf("status %d: %s", res.code, res.body)
	}
	var out SubmitQuoteResponse
	_ = json.Unmarshal(res.body, &out)
	if billable := firstQuotePartBillable(t, st, out.QuoteId); math.Abs(billable-1) > 1e-3 {
		t.Errorf("billable %.4f, want ~1 (client metrics kept for non-watertight)", billable)
	}
	m := fileMetrics(t, st, fileID)
	if m == nil || m.Watertight {
		t.Errorf("expected persisted metrics with watertight=false, got %+v", m)
	}
}
