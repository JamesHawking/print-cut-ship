-- Auth (roadmap plan 04, amended 2026-07-18 to passwordless OTP).
-- Extends plan 01's users table additively; adds OTP login codes and
-- Postgres-backed sessions. Codes and session tokens are stored SHA-256
-- hashed — the plaintext values only ever exist in memory / the email.

-- +goose Up
ALTER TABLE users
    ADD COLUMN role text NOT NULL DEFAULT 'customer', -- 'customer' | 'admin' (plan 07)
    ADD COLUMN company_name text,                     -- written by plan 05 checkout
    ADD COLUMN nip text;

CREATE TABLE login_codes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL,             -- no FK: email may have no users row yet
    code_hash   text NOT NULL,             -- SHA-256 of the 6-digit code
    expires_at  timestamptz NOT NULL,      -- now() + 10 min (matches UI copy)
    attempts    integer NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email ON login_codes (email);

CREATE TABLE sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   text NOT NULL UNIQUE,
    expires_at   timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE sessions;
DROP TABLE login_codes;
ALTER TABLE users
    DROP COLUMN role,
    DROP COLUMN company_name,
    DROP COLUMN nip;
