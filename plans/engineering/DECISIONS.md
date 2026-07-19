# Tech Decisions — canonical record

Locked 2026-07-15. Every plan in this folder builds on these choices — plans must not re-litigate them. If a decision changes, update it here first, then reconcile affected plans.

> **Amendment (2026-07-15, user-locked): Go is the canonical backend.**
> A dedicated Go service (`backend/` at repo root — chi router, OpenAPI-first
> with `oapi-codegen` + `openapi-typescript`/`openapi-fetch` clients) now owns
> all API surface. The pricing engine, ship-date computation, quote intake,
> and the MakerWorld proxy have already moved there (golden-fixture tests
> pin exact price parity with the retired TS engine); TanStack Start is
> frontend-only. The table below reflects the post-pivot choices.
> **Reconciliation status:** plans 01–06 rewritten against this amendment
> and plans 07–16 authored Go-native on 2026-07-15 — no plan re-litigates
> the pivot.

| Area | Decision | Rationale | Alternative considered |
|---|---|---|---|
| Database | PostgreSQL on Coolify | Locked by hosting scope decision; boring, well-supported | Managed Postgres (Neon/Supabase) — rejected to keep everything on Coolify |
| Data access (Go) | sqlc over pgx/v5; migrations via goose (embedded, `api migrate`) | Type-safe Go from hand-written SQL — same spec-first codegen philosophy as oapi-codegen; plain-SQL migrations run by the same binary Coolify deploys | GORM/ent (heavy ORM, opaque SQL); golang-migrate (weaker embed ergonomics); ~~Drizzle~~ (pre-pivot TS choice) |
| Auth | Hand-rolled in Go: **passwordless OTP (email + 6-digit code)** + opaque tokens (hashed) + Postgres sessions, httpOnly cookie — **amended 2026-07-18** from argon2id email+password; the shipped `/login → /orders` UI and "no account, no password" positioning made passwordless the product decision (code IS the verification; no register/reset flows). Opaque hashed session tokens unchanged | No better-auth equivalent in Go; OTP + sessions on vetted primitives is a small, testable surface behind the OpenAPI contract | Go OAuth frameworks (authboss/goth — breadth we deferred); JWTs (revocation pain); ~~email+password argon2id~~ (pre-2026-07-18 choice); ~~better-auth~~ (pre-pivot TS choice) |
| Payments | Stripe — Checkout (hosted redirect) with P24 + BLIK payment methods, behind a provider port (`backend/internal/payments`): plan 05 ships the order flow on a stub provider that mirrors Stripe's session/event semantics (amended 2026-07-19 — Stripe integration deferred to plan 18 so the order flow lands before the account exists); plan 18 drops in the stripe-go implementation with no pipeline changes | **User-locked.** Best DX, hosted surfaces keep the app out of PCI scope, P24+BLIK cover Polish habits | Przelewy24/PayU direct — lower fees, materially worse DX |
| Invoicing | Fakturownia API | Legal faktura VAT with NIP lookup (GUS), mature API, PL+EN invoice templates | wFirma, inFakt, Stripe-generated invoices (not compliant Polish faktura) |
| Email | Resend (resend-go from the backend); templates authored in React Email, **pre-rendered at build time** to Go `html/template` artifacts embedded in the binary (PL/EN) | Managed deliverability; React authoring/preview kept without a Node runtime in the backend container; CI diff-guard keeps artifacts in sync | Postmark/SES (provider); runtime React render (needs Node beside Go); Node render sidecar (extra deploy unit); pure Go templates (loses authoring toolchain) |
| File storage | MinIO on Coolify (S3 API, presigned uploads) | Keeps data on own infra per hosting decision; standard S3 client code so migrating to R2/S3 later is config-only | Cloudflare R2 / AWS S3 — revisit if MinIO ops burden bites; backups must still go off-server |
| Rate limiting / sessions / cache | Redis on Coolify — one shared instance | One decision for three needs (topic 10 rate limits, auth sessions if needed, cache) | In-process stores — lost on restart, break at >1 replica |
| Background jobs | Coolify scheduled tasks running **Go subcommands** (`api retention-sweep`, `api bambu-token-check`, …) in the backend container | Low-frequency cron shapes; the deployed binary already has DB/storage wiring — no extra artifact, no public job endpoints | BullMQ on the shared Redis — adopt only when a real queue need emerges (e.g. slicer-in-the-loop pricing, topic 14); token-guarded HTTP job routes (needless public surface) |
| Error tracking | Sentry SaaS | Must be external to the monitored box; release tagging from CI | GlitchTip self-hosted on Coolify — couples monitoring to the monitored server |
| Analytics | PostHog EU Cloud, cookieless mode | Event taxonomy already exists in `funnel.ts`; EU hosting + cookieless keeps topic-9 consent surface minimal | Self-hosted PostHog (ops burden), Plausible (no funnels) |
| CI/CD | GitHub Actions → Coolify webhook deploy; **two containers** (Go distroless backend + Bun/Nitro frontend), `/api` routed to Go at the proxy; CI gates both toolchains + a `gen-check` for OpenAPI sync | Repo is on GitHub; Coolify webhook deploys; backend Dockerfile already exists; Bun is the frontend dev runtime (Node fallback documented in topic 3) | Coolify build-on-server without CI gates (no red-test blocking); single combined image (couples release cadences) |
| i18n | Typed two-locale dictionary extending existing `src/lib/strings.ts`; `/pl` (default) + `/en` path prefixes with hreflang | Strings already centralized; a typed dictionary is exhaustiveness-checked at compile time; two locales don't justify i18next | i18next/paraglide — framework overhead for 2 locales |
| E2E testing | Playwright | Industry default, first-class GitHub Actions support, trace viewer | Cypress — weaker parallelism/multi-tab story |

## Cross-plan conventions

- **Schema ownership:** plan 01 owns the base tables (users, quotes, orders, files, pricing_config); plans 04/05/07 extend via migrations — never redefine.
- **IDs:** public short IDs (`Q-XXXXXXXX` style, already generated by the prototype) + internal UUIDs.
- **Money:** prices are gross (VAT-inclusive), PLN, stored as integer grosze in the DB; order rows snapshot the full pricing breakdown at order time.
- **API surface:** all new backend endpoints are defined OpenAPI-first in `backend/api/openapi.yaml`; `make gen` regenerates the Go server and the frontend TS client; CI's `gen-check` enforces sync. The frontend never talks to the DB. (Replaces the retired "server functions" convention.)
- **Localization contract:** the backend returns machine codes + params for DFM flags/errors/statuses; the frontend dictionary owns all human copy (exception: emails/invoices render backend-side from the order's persisted locale).
- **Secrets:** Coolify env config only; `.env` for local dev; nothing in the repo.
