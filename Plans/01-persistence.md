# Plan 01 — Persistence layer (database + data access)

> **Status: 🔄 In progress** (as of 2026-07-16) — implementation is live in the working tree (uncommitted, under active development in a parallel session: schema/migrations, sqlc store, money package, seed, compose Postgres, docker-compose profile). Verification checklist below not yet passed; not code-reviewed; do not treat as done until committed and verified.

> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`). The data layer lives in `backend/` (Go), not in TanStack server functions.

## 1. Context

The app is a working quoting prototype with **no persistence of any kind**. Everything behind the price is in-memory:

- **Parts live only in React state.** `PartsProvider` (`instant-quote/src/hooks/useParts.tsx`) holds the parts list in a `useReducer`; a page refresh loses every uploaded part, its mesh metrics, and its computed quote.
- **Quote intake endpoints are honest stubs.** The Go backend already owns intake — `POST /api/v1/quotes` and `POST /api/v1/step-quotes` (`backend/internal/httpapi/handlers.go`) validate input, **recompute prices server-side** via `internal/pricing`, mint public IDs, and log — but nothing is written anywhere (`backend/README.md` says so explicitly: "no persistence yet; that's roadmap topic 1").
- **Pricing config is compiled-in.** The engine config lives in `backend/internal/pricing/config.go` (exact port of the retired TS `PRICING`, pinned by golden fixtures). There is no record of *which* config priced a given quote, so a future rate change would silently reprice history.
- **No `DATABASE_URL`, no migrations, no local DB** — backend env is just `PORT` and `BAMBU_CLOUD_TOKEN`.

This topic lays the foundation nearly everything else builds on: quotes/orders that survive a refresh, file-metadata rows for plan 02, a user table for plan 04, an order skeleton for plan 05, admin lookups for plan 07, and a versioned pricing-config table so orders can snapshot the exact numbers that priced them. Nothing here is user-visible; it is the substrate.

## 2. Decisions applied

**Pinned in `DECISIONS.md` (not re-litigated):**

- **PostgreSQL on Coolify** — the target database. Plan 03 provisions the Coolify Postgres resource and injects `DATABASE_URL`; this plan defines the schema, migrations, and the local-dev DB.
- **Go backend owns all data access** (amendment) — no DB client in the frontend, ever. The frontend reads/writes only through the OpenAPI surface.
- **Money as integer grosze** — every monetary column is `integer` (PLN grosze). The Go engine computes PLN floats (`UnitPricePln` etc.); a boundary helper (`internal/money`) converts float PLN → grosze on write (same `round2` half-up semantics as the engine).
- **IDs** — internal `uuid` primary keys + public short IDs. The existing `Q-XXXXXXXX` / `STEP-XXXXXXXX` scheme is preserved and extended to orders (`O-XXXXXXXX`). Internal UUIDs never leave the server.
- **Schema ownership** — this plan owns the base tables (users, quotes, orders, files, pricing_config); plans 04/05/07 extend them via migrations. The skeleton is designed for extension (stable FK targets, nullable seams) but does **not** predefine their columns.

**Topic-local decisions resolved (amendment leaves these to this plan):**

- **Query layer: `sqlc` over `pgx/v5`.** sqlc generates type-safe Go from hand-written SQL — the same spec-first/codegen philosophy the backend already uses for HTTP (`oapi-codegen`); `make gen` grows a second generator. Plain pgx without sqlc was the alternative; rejected because handler code accretes stringly SQL and hand-rolled scanning. No heavyweight ORM (GORM/ent) — contradicts the SQL-transparent intent of the original decision.
- **Migrations: `pressly/goose/v3`, embedded.** SQL migration files in `backend/db/migrations/`, committed; embedded into the binary via `embed.FS` so the same distroless image can run `api migrate` as a Coolify pre-deploy step (no separate tooling in the image). golang-migrate is the alternative; goose wins on embedded-FS ergonomics and plain-SQL files.
- **Persist anonymous quotes? → Yes (schema-level).** `quotes.user_id` and `quotes.email` are both nullable, so a quote can exist with neither a logged-in user nor a captured email. This unblocks quote-links, abandoned-quote follow-up, and funnel analytics later. *Scope boundary:* plan 01 persists a quote at `POST /api/v1/quotes` time (email present). Eager "auto-save on quote_shown before email" is left to plan 14 — the schema is ready for it today.
- **Enum columns as `text` + validation at the API boundary, not Postgres enums.** Process IDs and lead-time IDs are config-driven and plan 14 may add materials; order status is extended by plan 05. `text` + the OpenAPI/Go-side enums avoids a DB migration per new material or state. Source of truth stays `internal/pricing/config.go` + `api/openapi.yaml`.
- **`step_requests` gets its own minimal table.** The STEP manual-quote fallback queue (plan 07 works from it) is a real persisted entity; overloading `quotes` would muddy both. Plan 07 extends it (assignee, sent-quote link).

## 3. Implementation phases

All paths rooted at `backend/` unless noted.

### Phase A — pgx + goose + sqlc wiring and local dev

**New / modified:**
- `go.mod` — add `github.com/jackc/pgx/v5`, `github.com/pressly/goose/v3`; dev tools `sqlc` (installed via `Makefile`, not vendored).
- `internal/db/db.go` — pgx pool constructor: `pgxpool.New(ctx, cfg.DatabaseURL)` with fail-fast validation (missing `DATABASE_URL` = startup error, matching the existing env handling in `cmd/api/main.go`).
- `db/migrations/` — goose SQL migrations (`00001_base_schema.sql`, …), embedded: `//go:embed migrations/*.sql` in a small `internal/db/migrate.go` exposing `Migrate(ctx, pool)`.
- `cmd/api/main.go` — add a `migrate` subcommand (`api migrate` runs goose up and exits; plain `api` serves). Coolify pre-deploy and CI both call the same binary.
- `sqlc.yaml` — engine `postgresql`, queries in `internal/store/queries/*.sql`, generated package `internal/store`.
- `Makefile` — extend `gen` to also run `sqlc generate`; add `migrate-new NAME=...` helper.
- `docker-compose.yml` (repo root or `backend/`) — one `postgres:16` service, volume, port 5432, dev credentials.
- `.env` handling — `DATABASE_URL` documented in `backend/README.md`; local default `postgres://dev:dev@localhost:5432/instantquote`.

**Verify:** `docker compose up -d && go run ./cmd/api migrate` runs clean on an empty DB and is a no-op on re-run; `make gen` regenerates sqlc output; `go build ./...` passes.

### Phase B — Base schema (migration 00001)

Schema sketch (SQL, goose migration). Conventions: `id uuid primary key default gen_random_uuid()`, `created_at/updated_at timestamptz not null default now()`, `short_id text unique` where public.

```sql
-- versioned snapshots of the whole pricing config
CREATE TABLE pricing_config_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,                    -- e.g. "2026-07-15 launch"
  config jsonb NOT NULL,                  -- serialized internal/pricing config
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- plan 07 owns the editor (new snapshot, flip is_active); plan 01 seeds row 1

-- minimal skeleton; plan 04 (Go auth) adds password/verification/role columns
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- metadata rows; plan 02 wires MinIO + fills storage_key/metrics
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),      -- nullable (anonymous)
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL,
  kind text NOT NULL,                     -- 'mesh' | 'step'
  hash text,                              -- content hash (dedupe; worker already computes SHA-256)
  storage_key text,                       -- S3 object key — null until plan 02
  metrics jsonb,                          -- server-recomputed MeshMetrics (plan 02)
  source text NOT NULL DEFAULT 'upload',  -- 'upload' | 'makerworld'
  source_ref jsonb,                       -- MakerWorld {designId, ...}
  expires_at timestamptz,                 -- retention (plan 02 job)
  deleted_at timestamptz,                 -- soft-delete
  created_at timestamptz NOT NULL DEFAULT now()
);

-- persisted quote + order-level totals snapshot (all money integer grosze)
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,          -- Q-XXXXXXXX
  user_id uuid REFERENCES users(id),      -- nullable (anonymous)
  email text,
  country text,                           -- EU country code
  status text NOT NULL DEFAULT 'submitted',  -- submitted | expired | ordered
  pricing_config_id uuid NOT NULL REFERENCES pricing_config_snapshots(id),
  parts_subtotal_grosze integer NOT NULL,
  min_order_topup_grosze integer NOT NULL,
  order_fee_grosze integer NOT NULL,
  shipping_grosze integer NOT NULL,
  net_total_grosze integer NOT NULL,
  vat_grosze integer NOT NULL,
  gross_total_grosze integer NOT NULL,
  free_shipping boolean NOT NULL,
  min_order_applied boolean NOT NULL,
  expires_at timestamptz,                 -- 14-day validity (plan 14)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- one row per part (mirrors PartQuote)
CREATE TABLE quote_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_id uuid REFERENCES files(id),      -- nullable until plan 02 stores files
  file_name text NOT NULL,
  hash text NOT NULL,
  process text NOT NULL,
  quantity integer NOT NULL,
  lead_time text NOT NULL,
  unit_price_grosze integer NOT NULL,
  line_total_grosze integer NOT NULL,
  billable_volume_cm3 double precision,
  piece_count integer,                    -- multi-plate 3MF only
  plates integer,
  breakdown jsonb,                        -- BreakdownLine[]
  dfm_flags jsonb,                        -- DfmFlag[]
  created_at timestamptz NOT NULL DEFAULT now()
);

-- skeleton only; plan 05 owns lifecycle/payment/invoice/shipping
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,          -- O-XXXXXXXX
  quote_id uuid NOT NULL REFERENCES quotes(id),
  user_id uuid REFERENCES users(id),      -- nullable (guest checkout)
  email text NOT NULL,                    -- guest-claimable later (plan 04)
  status text NOT NULL DEFAULT 'draft',   -- plan 05 defines the full state machine
  gross_total_grosze integer NOT NULL,    -- snapshot; never mutated by config changes
  vat_grosze integer NOT NULL,
  pricing_config_id uuid NOT NULL REFERENCES pricing_config_snapshots(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- plan 05 adds order_items, payment/invoice refs, lifecycle timestamps, shipping.
-- Plan 01 only guarantees table + short id + quote FK + money snapshot. No order
-- is created in plan 01 (checkout is plan 05).

-- requestStepQuote persistence; plan 07 extends (assignee, sent quote)
CREATE TABLE step_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,          -- STEP-XXXXXXXX
  email text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL,
  file_id uuid REFERENCES files(id),
  status text NOT NULL DEFAULT 'new',     -- new | quoted | closed
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Verify:** `go run ./cmd/api migrate` applies migration 00001 to the local DB; `goose status` clean; re-run no-op.

### Phase C — Store layer + wire the intake handlers

**New:**
- `internal/store/queries/quotes.sql` — `InsertQuote`, `InsertQuotePart`, `GetQuoteByShortID` (+ a tx wrapper in `internal/store/store.go`: `CreateQuote(ctx, quote, parts)` inserts quote + N parts atomically).
- `internal/store/queries/step_requests.sql` — `InsertStepRequest`, `GetStepRequestByShortID`.
- `internal/store/queries/pricing_config.sql` — `GetActivePricingConfig` (the `is_active` snapshot; intake attaches its id to quotes).
- `internal/money/money.go` — `ToGrosze(pln float64) int32` / `FromGrosze(g int32) float64`, replicating the engine's `round2` half-up semantics.

**Modified — `internal/httpapi/handlers.go`:**
- `POST /api/v1/quotes` handler: the handler **already recomputes prices server-side** from submitted metrics (never trusts client prices — `backend/README.md`); now it also fetches the active pricing-config snapshot, converts the recomputed totals to grosze, and calls `store.CreateQuote`. Keeps minting `Q-XXXXXXXX`; the OpenAPI response shape (`{ quoteId }`) is unchanged, so **no `api/openapi.yaml` change and no frontend change**.
- `POST /api/v1/step-quotes` handler: persist via `InsertStepRequest`; response `{ requestId }` unchanged.
- `internal/httpapi/router.go` / `cmd/api/main.go` — inject the pgx pool + store into the server struct (it already carries `makerworldClient` and `priceCfg`).

**Quote-persist contract for plan 05 (coordination).** Plan 05's `createDraftOrder` FKs to a persisted quote. Quote persistence is **owned here**:
- `store.CreateQuote` is the single writer of `quotes` + `quote_parts`; returns `{ id uuid, shortId "Q-…" }`.
- The client only ever holds the **short id**. Plan 05's order-creation endpoint accepts `quoteShortId` and resolves to the UUID server-side via `GetQuoteByShortID` — internal UUIDs never leave the server.
- Because the Go intake recomputes every price before persisting, the persisted quote rows are **server-authored** — plan 05 copies prices from the quote row at draft-order time, which makes client-side price tampering structurally impossible without re-running the mesh pipeline (full geometry re-validation from the stored file remains plan 02's job).

**Verify:** with local DB up, `curl -X POST localhost:8080/api/v1/quotes` (payload per `api/openapi.yaml`) lands rows in `quotes` + `quote_parts`; read back by short ID; same for `step-quotes`. `go test ./...` green (golden fixtures untouched); handler tests in `internal/httpapi/handlers_test.go` extended with a DB-backed happy path (skip if no `TEST_DATABASE_URL`).

### Phase D — Seed, CI hook, README, Coolify contract

**New / modified:**
- `cmd/api/main.go` — `seed` subcommand: serialize the current `internal/pricing` config to jsonb, insert as the initial active `pricing_config_snapshots` row. Idempotent (skip if an active snapshot exists).
- `backend/README.md` — "Database / local dev" section: compose up, `api migrate`, `api seed`, `DATABASE_URL`, migration workflow (new goose file per change, committed).
- **CI contract (owned by plan 03, specified here):** pipeline spins a Postgres service, runs `api migrate` before `go test ./...`, fails on migration error. Plan 01 provides the embedded migrations; plan 03 wires the runner.
- **Coolify contract (owned by plan 03):** `DATABASE_URL` injected from the Coolify Postgres resource; `api migrate` runs as the pre-deploy/release step before the service starts.

**Verify:** full done-when checklist (section 5).

## 4. Dependencies

- **Depends on:** nothing to write the schema and local-dev flow. Two seams complete under **plan 03**: the Coolify Postgres resource + `DATABASE_URL`, and running `api migrate` in CI/deploy. Plan 01 verifies end-to-end locally against docker-compose Postgres first.
- **Blocks / unblocks:**
  - **02 (file storage)** — fills `files.storage_key`/`files.metrics`, links `quote_parts.file_id`/`step_requests.file_id`, runs retention against `files.expires_at`/`deleted_at`.
  - **04 (auth)** — extends `users` (password hash, verification, role) via migration; FK target `users.id` is stable.
  - **05 (orders/payments)** — extends `orders` (order_items, payment/invoice refs, lifecycle), creates real orders from persisted quotes via the shortId contract above.
  - **06 (email)** — adds an email-log table; reads quotes/orders to send.
  - **07 (admin)** — reads all tables; owns the pricing-config editor (new snapshot + flip `is_active`) and the `step_requests` queue.

## 5. Verification

Expanding the brief's "done when":

- [ ] `docker compose up -d && go run ./cmd/api migrate` clean on a fresh DB; re-run is a no-op (`goose status` confirms).
- [ ] `make gen` regenerates sqlc code with no diff when queries are unchanged.
- [ ] `go run ./cmd/api seed` inserts exactly one active `pricing_config_snapshots` row mirroring the Go engine config; idempotent.
- [ ] `POST /api/v1/quotes` persists a `quotes` row + one `quote_parts` row per part, money in grosze, `pricing_config_id` FK set, prices server-recomputed; read-back by `Q-XXXXXXXX`. Response shape unchanged (no frontend change needed).
- [ ] `POST /api/v1/step-quotes` persists a `step_requests` row; read-back by `STEP-XXXXXXXX`.
- [ ] An anonymous quote (no user, no email… where the API allows) persists — nullable FKs confirmed.
- [ ] `go test ./...` green including golden fixtures; `go vet ./...` clean; frontend untouched (`bun test` still green).
- [ ] CI runs `api migrate` against a Postgres service and blocks on failure (verified once plan 03 wires it).
- [ ] `api migrate` runs on Coolify deploy against the provisioned Postgres (verified with plan 03).
- [ ] `backend/README.md` documents the full local-dev setup.

## 6. Risks & open questions

- **users-table seam with plan 04 (Go auth).** Plan 01 keeps `users` deliberately minimal (id, email, timestamps) so plan 04 can add password/verification/role columns or sibling tables via migration without touching FK targets. Plan 04 decides the exact auth schema before its first migration.
- **Geometry re-validation boundary.** Go intake recomputes *prices from submitted metrics*, but does not re-validate the mesh geometry itself (volume/area could be fabricated client-side). That defense — server-side re-parse of the stored file — is explicitly plan 02. Plan 01's persistence of server-recomputed prices narrows the gap; plan 02 closes it.
- **`ON DELETE` semantics vs invoice retention.** `quote_parts` cascades from quotes; `orders` never cascades. Polish ~5-year invoice retention (plans 05/09) must survive GDPR deletion — soft-delete (`deleted_at`) on `files`, carve-outs designed in 02/05/09, not here.
- **Opaque `jsonb` config snapshots.** If the config shape changes (plan 14), old snapshots stay readable as historical records but may not deserialize into the new Go struct. Acceptable — snapshots are audit artifacts, not re-executed. Plan 14 versions the shape if it ever needs to re-run old configs.
- **sqlc + pgx version drift.** Pin sqlc in the Makefile (`go run github.com/sqlc-dev/sqlc/cmd/sqlc@vX.Y.Z`) so `make gen` is reproducible in CI, mirroring how oapi-codegen is invoked.
