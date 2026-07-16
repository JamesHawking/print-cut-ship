-- name: InsertStepRequest :one
INSERT INTO step_requests (short_id, email, file_name, file_size_bytes, file_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, short_id;

-- name: GetStepRequestByShortID :one
SELECT * FROM step_requests WHERE short_id = $1;
