# 10 — Security hardening

## 1. Context

The app is about to face the internet with money and personal data behind it, and today it has: **no rate limiting** anywhere (the MakerWorld proxy will download 100 MB files for anyone who asks — an SSRF-adjacent, bandwidth-amplifying endpoint), **no security headers** (no CSP despite a WASM + web-worker + WebGL client surface, no HSTS), **no server-side upload validation**, secrets in local `.env`s, and a Bambu bearer token that expires (~90 days) against undocumented APIs with no expiry monitoring. Auth (04) and payments (05) will add login and webhook surfaces that need their own hardening.

With the Go pivot, all backend hardening lands in one place: chi middleware and handler-level validation in `backend/`, plus headers at the edge and a locked-down frontend CSP.

## 2. Decisions applied

**Pinned (DECISIONS.md):** Redis on Coolify backs rate limiting (shared instance); Sentry SaaS; secrets in Coolify env only; jobs via Coolify tasks (`api bambu-token-check`); Stripe hosted Checkout keeps card data entirely off-origin (PCI SAQ A posture).

**Topic-local decisions:**

- **Rate-limit middleware in Go, Redis-backed, sliding window per IP+route class.** Route classes with distinct budgets: `makerworld/fetch` (strictest — e.g. 5/hour/IP), `files` create+confirm (upload abuse), `auth/login|register|forgot` (credential stuffing), `orders`+`quotes` intake, everything else generous. In-process fallback if Redis is down (fail-open with alert, not fail-closed — availability over strictness for a shop).
- **Headers split by surface:** HSTS/frame-ancestors/nosniff set at the Coolify/Traefik edge for both services; **CSP is owned by the frontend document** (it needs page-level nonces and the WASM/worker allowances) — `script-src 'self' 'wasm-unsafe-eval'` (occt WASM), `worker-src 'self' blob:`, `connect-src 'self' https://*.posthog.com https://*.sentry.io`, `img-src 'self' data: blob:`, `frame-ancestors 'none'`. No third-party script tags exist today — keep it that way.
- **External pentest: recommended but user's call** (cost/benefit framed in §6); a self-run checklist + scanner pass is the launch minimum.

## 3. Implementation phases

### Phase A — Rate limiting (Go + Redis)

- `backend/internal/ratelimit/` — sliding-window limiter over Redis (`redis/go-redis`), keyed `route-class:ip`, honoring `X-Forwarded-For` from the trusted proxy only. Chi middleware applying per-class budgets; 429 with `Retry-After` and a machine code (plan 08).
- Per-IP upload byte caps (daily) on `POST /files` (plan 02's endpoints) — cheap abuse control.
- **Verify:** a load script (`backend/scripts/ratelimit_test.sh` or Go test with miniredis) demonstrates 429 on budget exhaustion per class, isolation between IPs, and fail-open behavior with Redis stopped (warning logged).

### Phase B — Security headers + CSP

- Edge headers (plan 03's Traefik/Coolify config): `Strict-Transport-Security` (start 1 week, ratchet to 6 months + preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo off).
- Frontend CSP per the decision above, delivered as a meta/header from the Nitro server; verify the WebGL/worker/WASM quote flow still works under it (this is the fiddly part — the occt WASM fetch, the mesh worker `blob:`/module worker, R3F).
- Backend responses: `Cache-Control: no-store` on any authenticated/admin endpoint.
- **Verify:** Mozilla Observatory / securityheaders.com A-grade on staging; the full upload→quote→3D-preview flow works with CSP enforced (no console violations); a deliberate inline-script injection is blocked.

### Phase C — Upload & input validation (Go)

- Content validation on `files` confirm (plan 02 seam): magic-byte sniff per declared kind (STL binary/ASCII heuristics, OBJ text, 3MF = ZIP local-file header, STEP ISO-10303 header); reject mismatches.
- **Zip-bomb guard for 3MF:** cap compressed size (already 100 MB), cap decompressed-total and per-entry size + entry count in `internal/mesh/parse_3mf.go` before inflating; parser fuzz-resilience — add `go-fuzz`/`testing.F` fuzz targets for all three parsers with a corpus from the test fixtures.
- Sanity bounds at quote intake (metrics ranges: volume vs bbox vs the H2S envelope) — rejects absurd client metrics cheaply pre-order (order-time authoritative recompute is plan 02's).
- **Verify:** a renamed `.exe`→`.stl` is rejected on confirm; a crafted 3MF with a 10 GB inflation target is rejected fast without memory spike; fuzzers run clean for a CI-budgeted time.

### Phase D — Secrets, Bambu token, dependency audit

- Rotation runbook finalized (with plan 03): every secret's location, rotation procedure, blast radius. `BAMBU_CLOUD_TOKEN`: `api bambu-token-check` subcommand (plan 03 runner, daily) calls a cheap authenticated MakerWorld endpoint; on 401/expiry-window → alert via plan 11. **Graceful degradation exists already** (`mwNotConfigured`-style error → the paste-URL card degrades); verify the path renders a helpful message rather than a broken flow.
- Dependency audit in CI (plan 03's workflow): `govulncheck ./...` (backend) + `bun audit` / osv-scanner (frontend), non-blocking warn at first, blocking after triage practice settles.
- **Verify:** token-check alert fires against a revoked test token; CI shows both audit steps running.

### Phase E — Auth hardening (lands with/after plan 04)

- Login/register/forgot throttling via Phase A's `auth` class + per-account (not just per-IP) counters in Redis; uniform errors (no user enumeration — plan 04 already specifies); argon2id params reviewed (memory/time cost against the container's memory budget); session cookie audit (`HttpOnly`, `Secure`, `SameSite=Lax`, rotation on privilege change — re-mint session on login); password policy (min 10 chars, compromised-password check via k-anonymity HIBP API optional at launch).
- **Verify:** brute-force script against login hits per-account lockout before per-IP; session id changes across login; cookie flags asserted in an integration test.

## 4. Dependencies

- **Requires:** 03 (edge/Traefik for headers, Redis, CI for audits, job runner), 02 (upload seam for Phase C), 04 (Phase E timing), 05 (webhook exists — its signature verification is specified in 05; this plan just checklists it).
- **Blocks:** launch.
- **Coordinates:** 11 (alert routes for token expiry, rate-limit anomalies, audit findings), 12 (fuzz targets live in the test suite).

## 5. Verification (the launch security checklist)

- [ ] Headers verified via scanner (A grade) on staging; CSP enforced with the full 3D quote flow working.
- [ ] Rate limits demonstrated per class with a load script; Redis-down = fail-open + alert.
- [ ] Price-tamper test rejected (plan 02's recompute — rechecked here as part of the checklist).
- [ ] Oversized/malformed/mistyped uploads rejected server-side; 3MF zip-bomb rejected without OOM.
- [ ] Stripe webhook: bad signature 400 (plan 05 test re-run under this checklist).
- [ ] Bambu token monitoring alerts on expiry window; MakerWorld feature degrades gracefully when dead.
- [ ] Login throttling + session/cookie audit green (Phase E tests).
- [ ] `govulncheck` + frontend audit in CI; no known-critical findings open.
- [ ] Secrets runbook exists; `git grep` finds no secret material.

## 6. Risks & open questions

- **CSP vs the WASM/worker surface** is the likeliest breakage: `wasm-unsafe-eval` requirements differ across browsers, and Vite's worker chunking can emit `blob:` workers. Budget real cross-browser verification time (Chrome/Firefox/Safari) — a broken CSP silently kills the core product flow.
- **Fail-open rate limiting** trades abuse resistance for availability; acceptable at launch scale, revisit with volume.
- **MakerWorld proxy remains fundamentally SSRF-shaped** — it fetches from Bambu's CDN by construction; the mitigation is strict input validation of the design-URL parse (already structured), response-size caps, and the tight rate class. It never fetches arbitrary user URLs — keep it that way.
- **External pentest (user decision):** a short engagement (2–4 person-days, typical small-shop scope) before first real orders would primarily de-risk the auth + payment + upload seams. Recommended once 04/05 are code-complete on staging; not a hard launch gate if the checklist above is green.
- **Open:** admin surface network posture — consider IP-allowlisting `/api/v1/admin/*` + `/admin` at the edge as cheap defense-in-depth for a one-operator shop.
