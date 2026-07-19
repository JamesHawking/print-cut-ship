-- name: CreateLoginCode :one
INSERT INTO login_codes (email, code_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: GetLatestLoginCode :one
-- The newest unconsumed code for the email (any expiry) — the only one
-- verify-code will accept. Expiry is checked in Go so the handler can
-- distinguish code_expired from code_invalid.
SELECT * FROM login_codes
WHERE email = $1 AND consumed_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- name: BumpLoginCodeAttempts :exec
UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1;

-- name: ConsumeLoginCode :exec
UPDATE login_codes SET consumed_at = now() WHERE id = $1;

-- name: InvalidateLoginCodesForEmail :exec
-- RequestCode consumes every still-active code for the email before minting
-- a new one (single active code per email).
UPDATE login_codes SET consumed_at = now()
WHERE email = $1 AND consumed_at IS NULL;

-- name: CountRecentLoginCodesForEmail :one
-- Resend throttle input: codes minted in the trailing window (≤5/hour cap).
SELECT count(*)::int FROM login_codes
WHERE email = $1 AND created_at > $2;

-- name: UpsertUserByEmail :one
-- Identity anchor, created on successful verify (never on code request).
INSERT INTO users (email)
VALUES ($1)
ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
RETURNING id, role;

-- name: CreateSession :one
INSERT INTO sessions (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: GetSessionByTokenHash :one
SELECT s.id AS session_id, s.expires_at, s.last_seen_at,
       u.id AS user_id, u.email, u.role
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > now();

-- name: TouchSession :exec
-- Sliding refresh, throttled ~1/hour by the caller.
UPDATE sessions SET last_seen_at = now(), expires_at = $2 WHERE id = $1;

-- name: DeleteSessionByTokenHash :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= now();

-- name: DeleteExpiredLoginCodes :exec
DELETE FROM login_codes WHERE expires_at <= now();

-- name: SetUserRoleByEmail :execrows
-- api promote-admin: the only role-escalation path (SQL-only by design; the
-- 0-rows case means the email has never verified a login code).
UPDATE users SET role = $2, updated_at = now() WHERE email = $1;
