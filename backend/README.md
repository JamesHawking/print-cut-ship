# Instant Quote — Go backend

Canonical backend for the instant-quote app (`../instant-quote` is
frontend-only). Owns pricing, ship dates, quote intake, and the MakerWorld
download proxy. All future API surface (auth, orders, payments, admin) lands
here — see `../Plans/DECISIONS.md`.

## Run

```sh
make dev                    # from the repo root: this API + the frontend together
go run ./cmd/api            # just the API, :8080 (PORT to override)
```

Env:

- `PORT` — listen port, default `8080`
- `BAMBU_CLOUD_TOKEN` — required for `/api/v1/makerworld/fetch` (same token
  as the old `.env` in instant-quote; expires ~90 days)

The frontend dev server proxies `/api` here (Nitro routeRules in
`../instant-quote/vite.config.ts`, target overridable via `API_PROXY`).
In production, route the `/api` path prefix to this service at the reverse
proxy; the Nitro fallback proxy also works if `API_PROXY` is set.

## Database / local dev

Postgres (roadmap plan 01) persists quotes and step-requests. It runs from the
repo-root `docker-compose.yml`; **local dev needs no external config** — the
Makefiles default `DATABASE_URL` to the compose Postgres. Two modes:

```sh
# Mode 1 — native hot-reload loop (default). From the repo root:
make dev              # starts Postgres, migrates+seeds, runs API + frontend

# Just the backend against the compose DB (from backend/):
make dev-setup        # docker compose up postgres + migrate + seed
make run              # serve

# Mode 2 — full stack in containers, no Go/Bun toolchain:
docker compose --profile full up --build
#   → Postgres + auto migrate + auto seed + API on :8080
#   (run the frontend natively with `bun dev`; it proxies /api to :8080)
```

- `DATABASE_URL` — defaulted to `postgres://dev:dev@localhost:5432/instantquote`
  by the Makefiles and wired between compose services automatically. The
  **compiled binary still fails fast** if `DATABASE_URL` is unset in serve mode,
  so production must inject it (Coolify, plan 03) — the default lives only in
  local tooling, never in the binary.
- **Migrations** live in `internal/db/migrations/` (goose SQL, embedded into the
  binary). Create one with `make migrate-new NAME=add_x`; the same binary runs
  them via `api migrate` (Coolify runs this as a pre-deploy step — plan 03).
- **Data access** is sqlc-generated from `internal/store/queries/*.sql` against
  the migration schema; regenerate with `make gen-sqlc` (part of `make gen`).
- Money is stored as integer grosze (`internal/money`); the base schema is owned
  here and extended by later plans (04/05/07) via additive migrations.

Run the DB-backed handler test against a throwaway database:

```sh
TEST_DATABASE_URL=postgres://dev:dev@localhost:5432/instantquote go test ./internal/httpapi/
```

(It is skipped when `TEST_DATABASE_URL` is unset. CI provisions a Postgres
service and runs `api migrate` before tests — plan 03.)

## File storage (plan 02)

Uploaded models live in MinIO (S3-compatible), run from the same compose file.
`make dev` / `make db-up` start it alongside Postgres; `serve` ensures the
bucket at startup, so no manual setup. The browser uploads on drop via a
presigned PUT (`POST /api/v1/files` → PUT to MinIO → `POST /files/{id}/confirm`),
deduped by content hash; MakerWorld downloads are teed into storage server-side.

- S3 env (Makefile/compose defaults for local dev; prod injects via Coolify):
  `S3_ENDPOINT` (default `localhost:9000`), `S3_PUBLIC_ENDPOINT` (browser-facing
  host if it differs from the internal one — set in the compose `full` profile),
  `S3_ACCESS_KEY`/`S3_SECRET_KEY` (default `minioadmin`), `S3_BUCKET` (default
  `instantquote`), `S3_USE_SSL`.
- **Retention sweep:** `make sweep` (or `api sweep`) soft-deletes stale pending
  reservations (>24h) and unreferenced uploaded files past
  `FILE_RETENTION_UNORDERED_DAYS` (default 30), removing their objects. Coolify
  runs this as a scheduled task (plan 03). Referenced/ordered-file retention
  lands with plans 05/14.
- Storage-backed tests need `TEST_S3_ENDPOINT` (e.g. `localhost:9000`) in
  addition to `TEST_DATABASE_URL`; skipped otherwise.

### Mesh recompute (server-side geometry)

`POST /api/v1/quotes` re-parses each part's stored file and recomputes its
geometry in Go (`internal/mesh`) before pricing, so the price rides on bytes
the server holds — not client-submitted metrics (`httpapi.recomputeQuoteParts`,
wired ahead of `priceParts`). Watertight meshes are authoritative; non-watertight
ones keep the client's metrics (the client priced via its convex-hull fallback,
which Go does not port) and log the divergence; a stored-bytes hash mismatch is a
hard 400; storage/parse failures soft-fall-back to client metrics. STEP is not
recomputed (no Go OCCT); the server view is still persisted to `files.metrics`
for admin reconciliation (plan 07). The order-time call site is plan 05's.

**Not bit-exact:** the Go port is idiomatic (`encoding/xml` for 3MF, no hull),
because the server is authoritative — the engines only need tolerance-level
agreement. 3MF parsing caps cumulative decompression (zip-bomb guard, a
server-only exposure). Golden fixtures are generated from the real TS pipeline:

```sh
cd ../instant-quote && bun tests/golden/mesh-generate.ts   # writes backend/internal/mesh/testdata/golden.json
```

Goldens compare at relative 1e-6; hull-fallback cases assert only the
hull-independent fields. Quote-time drift beyond relative 1e-3 is logged.

## API

Spec-first: `api/openapi.yaml` is the contract.

```sh
make gen        # regenerate Go server/types AND the frontend TS client
make test       # go test ./...
```

Endpoints: `POST /api/v1/price`, `GET /api/v1/config`,
`GET /api/v1/ship-dates`, `POST /api/v1/quotes`, `GET /api/v1/quotes/{id}`,
`GET /api/v1/orders`, `POST /api/v1/step-quotes`, `POST /api/v1/files`,
`POST /api/v1/files/{fileId}/confirm`, `POST /api/v1/makerworld/fetch`,
`GET /healthz`.

`quotes` and `step-quotes` persist to Postgres (plan 01): prices are
recomputed server-side from stored file bytes, stored as integer grosze, and
pinned to the active pricing-config snapshot. The client is never trusted for
money.

## Pricing engine and golden fixtures

`internal/pricing` (+ `internal/leadtime`) is an exact port of the original
TypeScript engine — same arithmetic order, and `round2` replicates JS
`Math.round` half-up semantics (`math.Floor(n*100+0.5)/100`). Exactness is
enforced by `testdata/golden.json` fixtures generated from the TS
implementation before it was deleted (1,512 part-quote cases + order totals
+ packing + ship dates).

The fixtures are **frozen artifacts**: the generator
(`instant-quote/tests/golden/generate.ts`) was removed together with the TS
engine — recover both from git history at commit `e3d45ec`-era if fixtures
ever need regenerating. When pricing rules change intentionally, update the
Go engine and its unit tests; golden cases that the change invalidates must
be updated by hand (or the whole file re-derived from a trusted state).

Ship-date labels are canonical here ("Thu 16 Jul", "Sept" for September —
Chrome/V8 Intl parity; JS engines disagree with each other, so the labels
are deliberately not golden-fixtured).

## Deploy

`Dockerfile` builds a static binary on distroless; tzdata is embedded via
`time/tzdata` so Europe/Warsaw works in the minimal image. Health check:
`GET /healthz`.
