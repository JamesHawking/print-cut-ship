package httpapi

import (
	"errors"
	"net/http"
	"regexp"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/makerworld"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// presignTTL bounds how long the browser has to PUT the file bytes.
const presignTTL = 5 * time.Minute

var sha256Re = regexp.MustCompile(`^[a-f0-9]{64}$`)

// fileKinds is the set of accepted upload kinds; the value doubles as the
// object-key extension (uploads/<sha256>.<kind>).
var fileKinds = map[string]bool{"stl": true, "obj": true, "3mf": true, "step": true}

// CreateFileUpload reserves a file record and returns a presigned PUT URL,
// deduping by content hash so a re-dropped or MakerWorld-teed file skips the
// upload entirely.
func (s *server) CreateFileUpload(w http.ResponseWriter, r *http.Request) {
	var req CreateFileRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !sha256Re.MatchString(req.Sha256) {
		badRequest(w, "sha256 must be 64 lowercase hex chars")
		return
	}
	if req.FileName == "" {
		badRequest(w, "fileName is required")
		return
	}
	if !fileKinds[string(req.Kind)] {
		badRequest(w, "unsupported kind")
		return
	}
	if req.SizeBytes < 1 || req.SizeBytes > makerworld.MaxFileBytes {
		badRequest(w, "sizeBytes out of range")
		return
	}
	if s.cfg.Store == nil || s.cfg.Storage == nil {
		s.cfg.Logger.Warn("storage not configured; cannot reserve upload")
		writeJSON(w, http.StatusServiceUnavailable, ApiError{Error: "storage unavailable"})
		return
	}
	ctx := r.Context()

	// Dedup: an already-stored file with this hash needs no upload.
	if existing, err := s.cfg.Store.GetUploadedFileBySha256(ctx, &req.Sha256); err == nil {
		writeJSON(w, http.StatusOK, CreateFileResponse{FileId: existing.ID, AlreadyStored: true})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.cfg.Logger.Error("dedup lookup failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to reserve upload"})
		return
	}

	sha := req.Sha256
	fileID, err := s.cfg.Store.InsertFile(ctx, store.InsertFileParams{
		FileName:      req.FileName,
		FileSizeBytes: req.SizeBytes,
		Kind:          string(req.Kind),
		Hash:          &sha,
		Source:        "upload",
	})
	if err != nil {
		s.cfg.Logger.Error("reserve file failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to reserve upload"})
		return
	}

	url, err := s.cfg.Storage.PresignPut(ctx, storage.Key(req.Sha256, string(req.Kind)), presignTTL)
	if err != nil {
		s.cfg.Logger.Error("presign failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to reserve upload"})
		return
	}
	writeJSON(w, http.StatusOK, CreateFileResponse{FileId: fileID, UploadUrl: &url, AlreadyStored: false})
}

// ConfirmFileUpload marks a reserved file stored once its object is present and
// the size matches. Idempotent; leaves the row pending on any mismatch so the
// retention sweep reclaims abandoned reservations.
func (s *server) ConfirmFileUpload(w http.ResponseWriter, r *http.Request, fileID openapi_types.UUID) {
	if s.cfg.Store == nil || s.cfg.Storage == nil {
		s.cfg.Logger.Warn("storage not configured; cannot confirm upload")
		writeJSON(w, http.StatusServiceUnavailable, ApiError{Error: "storage unavailable"})
		return
	}
	ctx := r.Context()

	file, err := s.cfg.Store.GetFileByID(ctx, fileID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, ApiError{Error: "file not found"})
			return
		}
		s.cfg.Logger.Error("file lookup failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to confirm upload"})
		return
	}
	if file.StorageKey != nil {
		writeJSON(w, http.StatusOK, ConfirmFileResponse{FileId: fileID, Stored: true})
		return
	}
	if file.Hash == nil {
		badRequest(w, "file has no hash")
		return
	}

	key := storage.Key(*file.Hash, file.Kind)
	size, ok, err := s.cfg.Storage.Stat(ctx, key)
	if err != nil {
		s.cfg.Logger.Error("stat failed", "err", err, "key", key)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to confirm upload"})
		return
	}
	if !ok {
		badRequest(w, "uploaded object not found")
		return
	}
	if size != file.FileSizeBytes {
		badRequest(w, "uploaded size does not match")
		return
	}
	if err := s.cfg.Store.SetFileStorageKey(ctx, store.SetFileStorageKeyParams{ID: fileID, StorageKey: &key}); err != nil {
		s.cfg.Logger.Error("confirm write failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, ApiError{Error: "failed to confirm upload"})
		return
	}
	writeJSON(w, http.StatusOK, ConfirmFileResponse{FileId: fileID, Stored: true})
}
