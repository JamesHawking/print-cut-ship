# 03 — Deployment, CI/CD, and environments

> **Status: ⬜ Not started** (as of 2026-07-16) — groundwork exists: production Dockerfile (backend/) and local docker-compose Postgres predate this plan; CI, Coolify wiring, and staging are untouched.

> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`). The deploy unit is now **two containers** — the Go API (`backend/`) and the TanStack frontend (`instant-quote/`) — with `/api` routed to Go at the proxy.

## 1. Context

The product is now two services, and neither ships anywhere:

- **Frontend** — TanStack Start + React 19 + Nitro (developed on Bun) in `instant-quote/`. `bun run build` emits a Nitro `node-server` bundle to `.output/` (nitro-nightly `3.0.1-…` — pre-release, runtime choice needs verifying, not assuming). No container image is built for it.
- **Backend** — Go service in `backend/` (chi + oapi-codegen). It **already has** a working multi-stage `Dockerfile` (static binary on distroless, tzdata embedded for Europe/Warsaw) and a `GET /healthz` endpoint. Nothing builds or deploys it either.
- **No CI.** No `.github/` anywhere. 109 frontend unit tests + Go tests (`go test ./...`, incl. 1,512-case pricing golden fixtures) run only by hand — a red change can merge unnoticed.
- **No environments, no secrets management.** Env is `BAMBU_CLOUD_TOKEN` in local `.env`s (the token now belongs to the **backend**). No staging, no production, no backup story.
- **No job runner.** Retention deletion (02), abandoned-quote emails (01/06), and Bambu-token-expiry checks (10) assume a scheduled execution mechanism that doesn't exist.
- **Dev proxy exists, prod routing doesn't.** In dev, Nitro routeRules in `instant-quote/vite.config.ts` proxy `/api` to the Go service (target overridable via `API_PROXY`). Production needs the same split at the reverse proxy.

This plan builds the delivery substrate: both images, the Coolify resource graph (two apps + Postgres + MinIO + Redis, staging and production), `/api` path routing, GitHub Actions CI gating both toolchains, webhook deploys, secrets, a rehearsed backup/restore, and the scheduled-job runner later plans plug into.

Repo shape: not a JS monorepo — `instant-quote/` and `backend/` are sibling projects with their own toolchains. Workflow files live at repo root `.github/`; Docker build contexts are per-service.

## 2. Decisions applied

**From `plans/engineering/DECISIONS.md` (pinned):**

- **CI/CD:** GitHub Actions → Coolify webhook deploy. Per the amendment: **two containers**, reverse proxy routes `/api` to Go. The frontend Dockerfile is Bun-runtime with a documented Node fallback; the backend Dockerfile already exists (distroless).
- **Error tracking:** Sentry SaaS, release tags from CI — supplied to **both** builds (frontend `VITE_SENTRY_RELEASE` build arg; backend `-ldflags "-X main.release=$SHA"`). Plan 11 finishes SDK wiring.
- **Database:** Postgres on Coolify — provisioned here; schema/migrations are plan 01's (`api migrate` subcommand). The Coolify **pre-deployment command on the backend app** runs it.
- **File storage:** MinIO on Coolify — provisioned here; buckets/client are plan 02's. MinIO shares the host, so it is **not** the DB-backup destination.
- **Redis on Coolify** — one per environment; consumed by plans 04/10 (Go side).
- **Background jobs:** Coolify scheduled tasks at launch — the runner mechanism is owned here; jobs themselves are **Go subcommands** (plans 01/02 already define `api migrate|seed|retention-sweep`).

**Topic-local decisions resolved:**

- **Single vs separate staging server → single Coolify server, two environments** (`staging`, `production`) in one project, mirrored resources, separate DBs. A second VPS doubles cost pre-revenue for no isolation that matters; migration later is a resource move.
- **`/api` routing → at the Coolify proxy (Traefik path rule), Nitro fallback documented.** Coolify fronts apps with Traefik; a path-prefix rule sends `https://domain/api/*` to the backend container and everything else to the frontend. Fallback (if the Traefik rule fights Coolify's config model): set `API_PROXY` on the frontend and let Nitro's routeRules proxy `/api` server-side — works today in dev, costs an extra hop. Decide at Phase C against the running Coolify version; both end states present the same single origin to the browser (no CORS surface — deliberate).
- **Backup destination → off-server Cloudflare R2** (S3-compatible, zero egress, EU option; Coolify scheduled Postgres backup supports S3 targets). Backblaze B2 acceptable equivalent.
- **Frontend production runtime → Bun running the Nitro `node-server` output** (`bun run .output/server/index.mjs`), Node kept as a one-line fallback; Phase B verifies before committing.

## 3. Implementation phases

### Phase A — Health endpoints

- **Backend:** `GET /healthz` already exists (`backend/internal/httpapi/router.go`) — liveness only, no external calls. Add `GET /healthz/ready` that pings Postgres (pool from plan 01) — used by deploy smoke tests, not the container probe.
- **Frontend:** add a liveness route **not under `/api`** (which routes to Go in prod): `instant-quote/src/routes/health.ts` serving `GET /health` → `200 { status, release, uptimeMs }`, `release` from `VITE_SENTRY_RELEASE`. (Confirm the server-route API — `createServerFileRoute` — against the installed nightly.)

**Verify:** `go run ./cmd/api` + `curl :8080/healthz` → 200; `bun run dev` + `curl :3000/health` → 200.

### Phase B — Container images

- **Backend:** `backend/Dockerfile` exists — extend with a build arg for the release SHA (`-ldflags`), confirm `PORT` env honored, healthcheck documented (`/healthz`). Build context `backend/`.
- **Frontend:** new `instant-quote/Dockerfile`, multi-stage on `oven/bun:1.3` → `oven/bun:1.3-slim`, frozen lockfile, `ARG VITE_SENTRY_RELEASE`, copies only `.output/`, `CMD ["bun", "run", ".output/server/index.mjs"]`, `EXPOSE 3000`. Plus `.dockerignore` (`node_modules`, `.output`, `.env`, `.tanstack`, `tests`, `.git`). **Node fallback documented in README:** swap runtime stage to `node:22-slim` + `CMD ["node", ...]` — two lines.

**Verify:** `docker build` + `run` each image locally; frontend serves `/health` and the landing page; backend serves `/healthz` and `POST /api/v1/price` round-trips. This gates the Bun/Nitro-nightly risk before any deploy.

### Phase C — Coolify resource graph

One project `instant-quote`; environments `staging` and `production`. Per environment:

1. **Two applications** from the GitHub repo, build pack Dockerfile: frontend (base dir `/instant-quote`, port 3000, health `GET /health`) and backend (base dir `/backend`, port 8080, health `GET /healthz`). Auto-deploy on push **off** (CI-driven, Phase E).
2. **Routing:** one domain per environment (prod apex + `staging.`), Coolify-managed TLS. Traefik path rule: `/api` (and `/healthz` stays internal) → backend; everything else → frontend. Fallback: `API_PROXY=http://<backend-internal>:8080` on the frontend app + Nitro proxy (README already documents this seam).
3. **Postgres** per environment; connection string exposed to the **backend** as `DATABASE_URL`.
4. **MinIO** per environment; `S3_*` env on the backend (plan 02).
5. **Redis** per environment; `REDIS_URL` on the backend (plans 04/10).
6. **Pre-deployment command** on the backend app: `/api migrate` (the binary's subcommand, plan 01) so migrations apply before cutover.
7. `BAMBU_CLOUD_TOKEN` moves to the **backend** app env (the Go proxy owns it now).

**Verify:** both staging apps healthy; `https://staging.<domain>/` serves the landing page; `https://staging.<domain>/api/v1/config` returns the catalog JSON from Go over the same origin.

### Phase D — CI (PR gate, both toolchains)

`.github/workflows/ci.yml` on PRs + pushes to `main`, two jobs (path-filtered to skip unneeded work, but both **required checks**):

```yaml
jobs:
  frontend:            # working-directory: instant-quote
    steps: setup-bun (pin 1.3.x) → bun install --frozen-lockfile
           → bun run typecheck → bun run lint → bun test → bun run build
  backend:             # working-directory: backend
    steps: setup-go (pin from go.mod) → go vet ./... → go test ./...
           → go build ./cmd/api
           # later (plan 01): postgres service container + `api migrate` before tests
           # later (plan 12): golden-parity + E2E jobs attach here
```

Also: a `gen-check` step in the backend job runs `make gen` and fails on diff — keeps `api/openapi.yaml`, the Go server, and the frontend TS client in lockstep (the OpenAPI-first contract is only real if CI enforces it).

Branch protection: both jobs required on `main`.

**Verify:** a PR breaking a Go golden fixture or a frontend pricing test shows the respective job red and merge blocked; an OpenAPI edit without regenerated client fails `gen-check`.

### Phase E — CD (staging auto-deploy, one-action promotion)

- **Staging** — `.github/workflows/deploy-staging.yml` on `workflow_run` of green CI on `main`: trigger Coolify deploy for **both** app UUIDs (curl `api/v1/deploy?uuid=…` + bearer token), then smoke test: poll `https://staging…/health` **and** `https://staging…/api/v1/config`, assert the reported release SHAs match `github.sha`.
- **Production** — `deploy-production.yml` via `workflow_dispatch` with a `production` GitHub Environment + required reviewer. Same steps against prod UUIDs. Deploy **backend first, then frontend** (the generated TS client may depend on new endpoints; the reverse order can 404).
- Sentry release creation step per service (placeholder here; plan 11 fills in `sentry-cli` + sourcemaps).

**Verify:** merge → staging carries the new SHA on both services; production dispatch (after approval) promotes the same SHA; smoke tests pass.

### Phase F — Secrets management

- **Coolify env (per environment):** backend — `DATABASE_URL`, `S3_*`, `REDIS_URL`, `BAMBU_CLOUD_TOKEN`, `SENTRY_DSN`, later `STRIPE_*`/`RESEND_*`/`FAKTUROWNIA_*` (plans 05/06); frontend — `VITE_SENTRY_RELEASE`, public keys only (PostHog key), optionally `API_PROXY`.
- **GitHub:** `secrets.COOLIFY_TOKEN`; `vars.COOLIFY_URL`, four app UUIDs, staging/production URLs.
- **Rotation runbook** (`plans/engineering/runbooks/secrets.md` or backend README): where each secret lives, how to rotate the Coolify token and `BAMBU_CLOUD_TOKEN` (~90-day expiry; monitoring job is plan 10's, procedure documented here).

**Verify:** `git grep` finds no secret values in tracked files; both staging apps boot entirely from Coolify env.

### Phase G — Background-job / scheduled-task runner

Jobs are **subcommands of the Go binary**, run by Coolify scheduled tasks **inside the backend container** (Coolify tasks execute a command in the app container). This reuses the wired pool/storage clients, needs no extra artifact, no public endpoint, and no trigger token.

- Convention: `api <job>` subcommands in `cmd/api/main.go` (pattern established by plan 01's `migrate`/`seed`). This plan ships a no-op `api ping-job` proving the path; later plans add:
  - `api retention-sweep` (plan 02) — daily.
  - `api abandoned-quote-sweep` (plans 01/06) — daily.
  - `api bambu-token-check` (plan 10) — daily, warns via plan 11 alerting.
- Contract for job authors: **idempotent** (tasks can double-fire), exit non-zero on failure (Coolify surfaces it), log counts to stdout (plan 11 scrapes).
- Alternatives recorded, not adopted: token-guarded HTTP job routes (needless public surface once tasks can exec in-container); BullMQ (only if a real queue emerges, e.g. plan 14 slicer-in-the-loop).

**Verify:** a staging scheduled task running `api ping-job` every minute shows green executions in Coolify's task log; a failing job (forced non-zero exit) is visibly red.

## 4. Dependencies

- **Blocks the start:** nothing — Phases A/B/D can begin now.
- **Consumes (external prerequisite):** domain purchase + DNS (Phase C).
- **Interlocks with plan 01:** Postgres resource + `DATABASE_URL` here; schema/migrate subcommand there; they meet at the pre-deploy hook and the CI Postgres service.
- **Interlocks with plan 02:** MinIO resource here; buckets/client/sweep there.
- **Unblocks:** everything user-facing (04–09, 13); the job runner (02/06/10); CI hosting for plan 12; release tags + health endpoints for plan 11; Redis for 04/10.

## 5. Verification (done-when checklist)

1. **Staging auto-deploys on merge** — both services report the merged SHA; smoke tests green.
2. **Promotion is one action** — production dispatch + approval deploys the same SHA, backend-first ordering respected.
3. **DB restore rehearsed** — Coolify Postgres backup lands in R2; restore into a throwaway Postgres; verify a known record; runbook records steps + timing.
4. **CI blocks red merges** — failing Go golden test or frontend pricing test disables merge; `gen-check` catches unregenerated OpenAPI clients.
5. **Containers healthy** — local `docker run` of both images serves health + a real endpoint; Coolify probes green.
6. **Single-origin routing works** — `https://<domain>/api/v1/config` (Go) and `/` (frontend) on one origin, no CORS headers needed anywhere.
7. **Secrets out of repo** — `git grep` clean; apps boot from Coolify env only.
8. **Job runner works** — scheduled `api ping-job` green on schedule; forced failure is red in the task log.

## 6. Risks & open questions

- **Nitro 3 nightly under Bun** (frontend). Pin the nitro version; the Phase B build/run gate catches breakage; Node fallback is two lines. The Go backend is immune (its own static binary).
- **Traefik path-rule ergonomics in Coolify.** Path-prefix routing of one domain to two Coolify apps is the intended design but the config surface varies by Coolify version — confirm at Phase C; the `API_PROXY` Nitro fallback is the tested escape hatch (it's how dev works today).
- **Deploy ordering.** Backend-first is convention, not enforcement; a frontend needing a not-yet-deployed endpoint 404s. Mitigation: additive-first API evolution (OpenAPI `gen-check` makes contract drift visible in PR review).
- **Migrations at deploy time.** `api migrate` pre-deploy assumes backward-compatible (expand/contract) migrations while the old container drains — flag as discipline for plan 01; long/locking migrations need a maintenance window.
- **Single-server blast radius.** Staging + production + data stores on one host; the off-server R2 backup is the backstop; second server is the escalation once revenue justifies.
- **Two-artifact drift.** Frontend TS client is generated from the backend's OpenAPI spec (`make gen`); CI's `gen-check` is the guard. Never hand-edit the generated client.
