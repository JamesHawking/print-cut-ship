# 04 — User accounts & authentication

> **Status: ⬜ Not started** (as of 2026-07-16).

> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`): better-auth is **out**; auth lives in the Go service with server-side sessions, consumed by the frontend through the OpenAPI client.

## 1. Context

The app has no notion of a user. The Go intake (`POST /api/v1/quotes`) collects a bare `email` string; there are no accounts, no sessions, no way for a returning customer to see past orders, and no admin identity for the back-office (plan 07) to authorize against. `OrderDialog.tsx` is the only place an email is captured, and `SiteHeader.tsx` has no account entry point.

This topic adds real identity: email+password registration with verification and reset, server-side sessions that survive deploys, an account page with order history, an admin role flag, and B2B fields (company name + NIP) needed for Polish invoicing (plan 05).

**Load-bearing product constraint:** quoting must never be gated behind login. The core promise is "no friction to the number." Guests keep ordering with just an email exactly as they do today; an account is strictly opt-in. A guest order placed against an email can be *claimed* later by registering (and verifying) that same email — the account then absorbs the prior order history.

## 2. Decisions applied

From `Plans/DECISIONS.md` (pinned, incl. amendment):

- **Auth lives in Go** — better-auth (TS) is retired by the amendment. See topic-local decision below for the approach.
- **DB = Postgres via plan 01's store layer** (pgx + sqlc); this plan EXTENDS plan 01's `users` table and adds sibling tables via additive goose migrations — never redefines.
- **Auth emails via Resend (plan 06)** — this plan defines a Go `Sender` port with a console/dev implementation; plan 06 supplies the transport + PL/EN templates without touching auth logic.
- **Redis available but not required** — sessions live in Postgres (that's what makes them survive deploys); Redis as a session read-cache is an optional latency optimization deferred to plan 10.
- **Single origin** (plan 03's `/api` proxy) — cookies flow first-party; no CORS/token gymnastics.

**Topic-local decisions resolved:**

- **Auth approach: hand-rolled email+password on vetted primitives, not a Go auth framework.** `golang.org/x/crypto/argon2` (argon2id) for password hashing, `crypto/rand` 256-bit opaque session tokens stored **hashed** (SHA-256) in Postgres, httpOnly/Secure/SameSite=Lax cookie. *Rationale:* Go has no better-auth equivalent — libraries like authboss/goth solve OAuth breadth we deferred; email+password+sessions is ~500 lines of well-trodden code with fewer moving parts than any framework, and the OpenAPI contract keeps it testable. *Alternative rejected:* JWTs (revocation pain; server-side sessions are strictly simpler at one backend).
- **Where the login UI lives:** dedicated top-level frontend routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`) plus a single account entry point in `SiteHeader`. The quote flow (`/`, `/quote`, `OrderDialog`) is untouched and never redirects to login.
- **Social login at launch:** deferred, email+password only. Adding Google later is an additive OAuth handler in Go (revisit in plan 16).
- **Admin identity:** a plain `role` column (`'customer' | 'admin'`, default `'customer'`) plus a `RequireAdmin` middleware — no admin framework. Plan 07 needs only "is this request an admin."

## 3. Implementation phases

### Phase A — Go auth package + OpenAPI surface

- **New `backend/internal/auth/`** — `password.go` (argon2id hash/verify with sane params), `token.go` (opaque token mint + SHA-256 store-hash), `service.go` (register/login/logout/verify/reset orchestration over the store).
- **Extend `backend/api/openapi.yaml`** (then `make gen`):
  - `POST /api/v1/auth/register` `{ email, password, companyName?, nip? }`
  - `POST /api/v1/auth/login` / `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/verify-email` `{ token }` · `POST /api/v1/auth/resend-verification`
  - `POST /api/v1/auth/forgot-password` `{ email }` · `POST /api/v1/auth/reset-password` `{ token, password }`
  - `GET /api/v1/auth/me` → user or 401 · `PATCH /api/v1/account` (name, companyName, nip)
  - `GET /api/v1/account/orders` (empty list until plan 05)
- **New `backend/internal/httpapi/auth.go`** — handlers; login/register set the session cookie (`Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`). Uniform 401 body via the existing error envelope.
- Config: `SESSION_TTL` (default 30 days, sliding), cookie name `iq_session`.

**Verify:** `make gen` clean; handler unit tests for register→login→me→logout against a test DB; `go vet ./...`.

### Phase B — Schema extensions (additive migration)

Goose migration `000XX_auth.sql` owned here (plan 01's `users` stays the FK target):

```sql
ALTER TABLE users
  ADD COLUMN password_hash text,             -- null = no password set (guest-claimed shell)
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN role text NOT NULL DEFAULT 'customer',
  ADD COLUMN company_name text,
  ADD COLUMN nip text;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_tokens (                    -- verification + reset, single-use
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,                      -- 'verify_email' | 'reset_password'
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,            -- 24h verify / 1h reset
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

NIP stored raw; validated at the API boundary (10 digits + weighted checksum) in Go.

**Verify:** migration up clean on a dev DB; sqlc queries (`internal/store/queries/auth.sql`) round-trip a user with `role='admin'`.

### Phase C — Session middleware + guards

- **New `backend/internal/httpapi/session.go`** — chi middleware: read cookie → hash → look up unexpired session → attach user to context; sliding refresh of `last_seen_at`/`expires_at` (throttled to ~1/hour). Helpers `CurrentUser(ctx)`, `RequireUser`, `RequireAdmin` (401/403) — the guards plan 07 mounts on `/api/v1/admin/*`.
- Mount the middleware globally in `router.go` (cheap when no cookie); guards only on protected routes. Quote/price endpoints stay guard-free.

**Verify:** table-driven middleware tests — no cookie, garbage cookie, expired session, valid session, admin vs customer on a guarded route.

### Phase D — Frontend auth routes + account UI

- New routes under `instant-quote/src/routes/`: `login.tsx`, `register.tsx` (optional company + NIP), `forgot-password.tsx`, `reset-password.tsx` (token from query), `verify-email.tsx` (token from query), `account.tsx` (profile + order history; empty state until plan 05). All talk to the generated openapi-fetch client; session state via a small `useSession` hook wrapping `GET /auth/me` in TanStack Query.
- `account.tsx` protection is a client redirect on 401 (`/login?redirect=/account`) — the real gate is the API's 401, not the route.
- `instant-quote/src/components/SiteHeader.tsx` — "Account"/"Sign in" link on both `landing` and `quote` variants; the only quote-surface change, never a redirect.
- Copy through `src/lib/strings.ts` (plan 08 translates); API error codes map to localized messages per plan 08's machine-code contract.

**Verify:** in-browser register → console-logged verification link → verify → sign in → account renders; sign out; `/account` bounces to login when signed out.

### Phase E — Email port (bridge to plan 06)

- **New `backend/internal/email/email.go`** — `type Sender interface { Send(ctx, Msg) error }` + `ConsoleSender` dev impl. Auth flows (verify/reset) render minimal text bodies through it. Plan 06 swaps in the Resend implementation + real templates without touching `internal/auth`.

**Verify:** signup and reset emit log lines containing usable links (`APP_BASE_URL` + token).

### Phase F — Guest-order claiming

- `internal/auth/service.go`: on successful email verification, `ClaimGuestOrders(ctx, userID, email)` — `UPDATE orders SET user_id = $1 WHERE email = $2 AND user_id IS NULL` (sqlc query; orders table is plan 01's skeleton, extended by 05). Only a **verified** owner absorbs orders — prevents claiming by guessing an email.
- Quote/order intake handlers stamp `user_id` when a session exists, else leave null (guest). One-line change per handler.

**Verify:** guest order with email X (once plan 05 lands; until then, store-level test against the skeleton `orders` table) → register + verify X → order listed by `GET /account/orders`; verified user Y sees nothing of X's.

## 4. Dependencies

- **Requires plan 01 first** — `users` table, store layer, migration tooling. Phase A's pure crypto code can start any time; B–F integrate against 01.
- **Soft dep on plan 05** — order history + claim flow touch `orders`; the mechanism ships here against 01's skeleton.
- **Soft dep on plan 06** — Phase E port; 06 supplies transport/templates (PL/EN).
- **Unblocks plan 07** — `RequireAdmin` + `role`. **Unblocks parts of 05** — user attribution, B2B NIP defaults for invoicing.
- **Hands off to plan 10** — login throttling (Redis), password policy depth, session-fixation review, cookie hardening audit.
- **Hands off to plan 08** — all auth copy + error-code translations.

## 5. Verification (executable checklist)

- [ ] **Register + verify:** new email → verification link → `email_verified=true`, signed in.
- [ ] **Login:** verified credentials succeed; unverified login refused with resend affordance; wrong password → uniform 401 (no user-enumeration difference).
- [ ] **Reset:** request → token → new password works, old rejected, token single-use.
- [ ] **Guest order claim:** guest order (email X) → register+verify X → order in account history; user Y can't see it.
- [ ] **Sessions survive deploys:** sign in, restart the backend container, reload → still signed in (Postgres-backed).
- [ ] **Quoting stays anonymous:** upload → quote → order path completes with no session, no login redirect.
- [ ] **Admin flag:** `role='admin'` passes `RequireAdmin`; customer → 403.
- [ ] **B2B fields:** register/account persist `company_name`+`nip`; invalid NIP checksum rejected server-side.
- [ ] **Automated:** migration clean; Go handler tests for the full flow; middleware table tests; `gen-check` green (OpenAPI + regenerated clients committed). Playwright e2e of register→verify→login→reset lands in plan 12.

## 6. Risks & open questions

- **Rolling our own auth.** The perennial risk. Contained by: argon2id + crypto/rand only (no home-grown crypto), tokens stored hashed, single-use + TTL'd, uniform error responses, and plan 10's hardening pass (throttling, policy) before launch. The OpenAPI contract makes every flow integration-testable.
- **users-table seam with plan 01:** low now — 01 keeps `users` minimal and this plan's migration is purely additive. Confirm 01's migration numbering before writing `000XX_auth.sql`.
- **Claim-before-orders-exist:** claim flow can't fully e2e until plan 05; ship with store-level tests against 01's skeleton `orders`.
- **Cookie scope vs the `/api` proxy:** cookie is set by the backend but must be sent on same-origin page loads — `Path=/`, first-party origin via plan 03's routing makes this a non-issue; verify explicitly on staging (cookie present after login, sent to `/api/*`).
- **Email deliverability window:** until plan 06 lands, verification links only exist in logs — fine for dev/staging, blocks production launch (already a launch gate via 06).
- **Open:** expose "download my data / delete account" on the account page now? Recommend stubbing the entry point here, implementing in plan 09.
