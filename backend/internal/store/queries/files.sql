-- name: InsertFile :one
-- storage_key is NULL for browser presigned uploads (set later by confirm) and
-- non-NULL for the MakerWorld server-side tee (stored before the row exists).
INSERT INTO files (file_name, file_size_bytes, kind, hash, source, source_ref, storage_key)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id;

-- name: GetUploadedFileBySha256 :one
SELECT id, kind FROM files
WHERE hash = $1 AND storage_key IS NOT NULL AND deleted_at IS NULL
LIMIT 1;

-- name: GetFileByID :one
SELECT * FROM files WHERE id = $1;

-- name: SetFileStorageKey :exec
UPDATE files SET storage_key = $2 WHERE id = $1;

-- name: SoftDeleteFile :exec
UPDATE files SET deleted_at = now() WHERE id = $1;

-- name: ListStalePendingFiles :many
-- Uploads that reserved a row but never confirmed (no object to remove).
SELECT id FROM files
WHERE storage_key IS NULL AND deleted_at IS NULL AND created_at < $1;

-- name: ListUnreferencedUploadedFiles :many
-- Stored files past the retention window, not referenced by any quote/step row.
SELECT files.id, files.storage_key FROM files
WHERE files.storage_key IS NOT NULL
  AND files.deleted_at IS NULL
  AND files.created_at < $1
  AND NOT EXISTS (SELECT 1 FROM quote_parts WHERE quote_parts.file_id = files.id)
  AND NOT EXISTS (SELECT 1 FROM step_requests WHERE step_requests.file_id = files.id);
