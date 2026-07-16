package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
)

// setupTestStorage builds a storage.Store against TEST_S3_ENDPOINT and ensures
// the bucket. Skips when unset. Content-addressed keys make cross-test object
// collisions harmless (same bytes → same key).
func setupTestStorage(t *testing.T) *storage.Store {
	t.Helper()
	if os.Getenv("TEST_S3_ENDPOINT") == "" {
		t.Skip("TEST_S3_ENDPOINT not set; skipping storage-backed test")
	}
	t.Setenv("S3_ENDPOINT", os.Getenv("TEST_S3_ENDPOINT"))
	strg, err := storage.New()
	if err != nil {
		t.Fatalf("storage: %v", err)
	}
	if err := strg.EnsureBucket(context.Background()); err != nil {
		t.Fatalf("ensure bucket: %v", err)
	}
	return strg
}

func TestFileUploadRoundTrip(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	body := []byte("solid cube\nfacet normal 0 0 0\n") // stand-in STL bytes
	sum := sha256.Sum256(body)
	sha := hex.EncodeToString(sum[:])

	// 1. Reserve → get a presigned URL.
	rec := doJSON(t, h, http.MethodPost, "/api/v1/files",
		fmt.Sprintf(`{"sha256":%q,"fileName":"cube.stl","kind":"stl","sizeBytes":%d}`, sha, len(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("create status %d: %s", rec.Code, rec.Body)
	}
	var created CreateFileResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.AlreadyStored || created.UploadUrl == nil {
		t.Fatalf("expected a fresh reservation with an upload URL, got %+v", created)
	}

	// 2. PUT the bytes to the presigned URL.
	put, err := http.NewRequest(http.MethodPut, *created.UploadUrl, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	putRes, err := http.DefaultClient.Do(put)
	if err != nil {
		t.Fatalf("presigned PUT: %v", err)
	}
	putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		t.Fatalf("presigned PUT status %d", putRes.StatusCode)
	}

	// 3. Confirm → row flips to stored.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/files/"+created.FileId.String()+"/confirm", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("confirm status %d: %s", rec.Code, rec.Body)
	}
	file, err := st.GetFileByID(context.Background(), created.FileId)
	if err != nil {
		t.Fatal(err)
	}
	if file.StorageKey == nil {
		t.Fatal("storage_key still nil after confirm")
	}

	// 4. Dedup: same sha returns the same id, no upload URL.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/files",
		fmt.Sprintf(`{"sha256":%q,"fileName":"cube-again.stl","kind":"stl","sizeBytes":%d}`, sha, len(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("dedup create status %d: %s", rec.Code, rec.Body)
	}
	var dedup CreateFileResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &dedup); err != nil {
		t.Fatal(err)
	}
	if !dedup.AlreadyStored || dedup.UploadUrl != nil || dedup.FileId != created.FileId {
		t.Fatalf("expected dedup onto %s, got %+v", created.FileId, dedup)
	}
}

func TestConfirmSizeMismatchKeepsPending(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	h := testHandler(t, Config{Store: st, Storage: strg, PricingConfigID: cfgID}, nil)

	body := []byte("obj v 0 0 0")
	sum := sha256.Sum256(body)
	sha := hex.EncodeToString(sum[:])

	// Reserve claiming a larger size than we upload.
	rec := doJSON(t, h, http.MethodPost, "/api/v1/files",
		fmt.Sprintf(`{"sha256":%q,"fileName":"m.obj","kind":"obj","sizeBytes":%d}`, sha, len(body)+100))
	if rec.Code != http.StatusOK {
		t.Fatalf("create status %d: %s", rec.Code, rec.Body)
	}
	var created CreateFileResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &created)

	put, _ := http.NewRequest(http.MethodPut, *created.UploadUrl, bytes.NewReader(body))
	putRes, err := http.DefaultClient.Do(put)
	if err != nil {
		t.Fatal(err)
	}
	putRes.Body.Close()

	// Confirm rejects the size mismatch and leaves the row pending.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/files/"+created.FileId.String()+"/confirm", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("confirm status %d, want 400", rec.Code)
	}
	file, err := st.GetFileByID(context.Background(), created.FileId)
	if err != nil {
		t.Fatal(err)
	}
	if file.StorageKey != nil {
		t.Fatal("row should stay pending after a size mismatch")
	}
}
