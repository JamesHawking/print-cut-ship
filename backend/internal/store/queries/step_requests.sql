-- name: InsertStepRequest :one
INSERT INTO step_requests (short_id, email, file_name, file_size_bytes, file_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, short_id;

-- name: GetStepRequestByShortID :one
SELECT * FROM step_requests WHERE short_id = $1;

-- name: ListStepRequests :many
-- STEP manual-quote queue (plan 07), newest first, optionally by status.
SELECT * FROM step_requests
WHERE (sqlc.narg(status)::text IS NULL OR status = sqlc.narg(status)::text)
ORDER BY created_at DESC
LIMIT 200;

-- name: UpdateStepRequestStatus :execrows
-- Closed is terminal: the guard makes any transition out of 'closed' a 0-row
-- no-op, which the handler maps to 409 step_request_wrong_state.
UPDATE step_requests SET status = $2
WHERE short_id = $1 AND status <> 'closed';
