# Plan 005: Status docs tell the truth; the repo gains a root README, CLAUDE.md, and .env.example

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 64dfb98..HEAD -- Plans/02-file-storage.md Plans/ROADMAP.md backend/README.md`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live files; a mismatch means the docs may have
> been partially corrected already — reconcile rather than blindly apply.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: advisor-plans/001-integration-test-target.md (documents its new target; if 001 hasn't landed, skip that one sentence and say so in your report)
- **Category**: docs / dx
- **Planned at**: commit `64dfb98`, 2026-07-17

## Why this matters

This repo is executed largely by agents working from the `Plans/` corpus, and
the corpus's own status system is now actively wrong: `Plans/02` says "Not
started" though its storage half is shipped and documented; the ROADMAP's
roll-up says "02–16 not started" though 08 is ✅ Done and 13 is 🟨; the
ROADMAP's "current state" paragraph and the backend README still describe a
pre-persistence prototype. An agent told "execute plan 02" would rebuild
shipped code. Separately, there is no root README, no CLAUDE.md anywhere, and
no `.env.example` — every session re-derives the conventions (money-as-grosze,
OpenAPI-first codegen, i18n dictionary gate, generated-file list) from two long
READMEs. Stale-and-wrong status actively misdirects; this plan makes the docs
match reality and gives agents a stable entry point.

## Current state (the wrong lines, verified 2026-07-17)

- `Plans/02-file-storage.md:3`:

  ```
  > **Status: ⬜ Not started** (as of 2026-07-16).
  ```

  Reality: storage half shipped in commit `a5cc39d` ("Backend+frontend: file
  storage — MinIO uploads, MakerWorld tee, sweep (plan 02, storage scope)");
  `backend/README.md` has a "File storage (plan 02)" section; the Go mesh port
  + `VerifyOrderPricing` remain deferred (required before/with plan 05).

- `Plans/ROADMAP.md` (~line 13), the roll-up:

  ```
  ... Current: ✅ **01 Persistence** done ... ⬜ **02–16** not started — with committed groundwork noted in 03 ...
  ```

  Reality: 02 is 🟨 half-done; `Plans/08-i18n.md:3` says "✅ Done (2026-07-16
  ...)"; `Plans/13-seo-content.md:3` says "🟨 Phases 1–2 largely pre-built".

- `Plans/ROADMAP.md` (~line 17), "Current state in one paragraph" still claims:
  "no database ... `submitQuote`/`requestStepQuote` are console-stubs ... all
  copy is English-only in `src/lib/strings.ts` ... Tests (109 passing) cover
  only the pure pricing/mesh/packing libs." All of that is stale: Postgres
  persistence is live, i18n shipped PL+EN dictionaries (`src/lib/strings.ts`
  no longer exists), file storage + login/orders prototype exist.

- `backend/README.md`:
  - ~line 12 documents `air  # hot-reload alternative` — but no `.air.toml`
    exists anywhere and no tooling installs it (first-five-minutes trap).
  - ~lines 104-107:

    ```
    `quotes` and `step-quotes` are still honest stubs (log + generated ID — no
    persistence yet; that's roadmap topic 1), but prices are recomputed
    server-side and never trusted from the client.
    ```

    Reality: both persist since plan 01 (`persistQuote` in
    `internal/httpapi/handlers.go`, sqlc store, migrations).
  - The endpoint list just above (~line 100) is missing `GET /api/v1/orders`,
    `POST /api/v1/files`, and `POST /api/v1/files/{fileId}/confirm` — the
    authoritative list is the paths in `backend/api/openapi.yaml`.

- Missing files (verified absent): root `README.md`, root `CLAUDE.md`,
  `backend/CLAUDE.md`, `instant-quote/CLAUDE.md`, any `.env.example`.

- Env vars scattered across docs (compiled at planning time):
  - backend: `PORT` (default 8080), `DATABASE_URL` (dev default
    `postgres://dev:dev@localhost:5432/instantquote`), `BAMBU_CLOUD_TOKEN`
    (MakerWorld; ~90-day expiry; **backend-owned**), `S3_ENDPOINT`,
    `S3_PUBLIC_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
    `S3_USE_SSL`, `FILE_RETENTION_UNORDERED_DAYS`, plus test-only
    `TEST_DATABASE_URL`, `TEST_S3_ENDPOINT`.
  - frontend: `API_PROXY` (dev proxy target override), `VITE_SITE_URL`
    (canonical origin for SEO).
  - **Never put a real value in any example file** (`Plans/DECISIONS.md`
    records "nothing in the repo" for secrets). Placeholders only.

- Key repo invariants for the CLAUDE.md (all verifiable in the repo):
  - Two sibling projects, not a JS monorepo: `backend/` (Go) is the canonical
    API; `instant-quote/` (TanStack Start + React 19 + Bun) is the frontend.
    `make dev` at root runs both; frontend proxies `/api` via Nitro routeRules.
  - OpenAPI-first: `backend/api/openapi.yaml` is the contract; `make -C backend
    gen` regenerates Go server (`internal/httpapi/gen.go`), TS client types
    (`instant-quote/src/lib/api/schema.d.ts`), sqlc
    (`internal/store/*.sql.go`), and `reference-prices.json`. Generated files
    are never edited by hand.
  - Money is integer grosze in the DB (`internal/money`); prices are always
    recomputed server-side; the pricing engine is pinned by golden fixtures.
  - i18n: `src/lib/i18n/pl.ts` is the source of truth, `en.ts` mirrors it,
    `bun run check-strings` gates hardcoded strings; backend errors return
    machine codes + params, frontend renders localized copy.
  - Plan status banners in `Plans/*.md` are the source of truth for what's
    done, mirrored in `Plans/ROADMAP.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Frontend gates | `cd instant-quote && bun run check-strings && bun run format:check` | exit 0 |
| Backend build (docs shouldn't break it) | `cd backend && go build ./...` | exit 0 |
| Link sanity | `grep -c "strings.ts" Plans/ROADMAP.md` | 0 after Step 2 |

## Scope

**In scope** (the only files you should modify/create):
- `Plans/02-file-storage.md` (status banner only)
- `Plans/ROADMAP.md` (roll-up line + current-state paragraph only)
- `backend/README.md` (air line, stubs paragraph, endpoint list, one
  test-integration sentence)
- `README.md` (create, repo root)
- `CLAUDE.md` (create, repo root)
- `backend/.env.example` (create)
- `instant-quote/.env.example` (create)

**Out of scope** (do NOT touch):
- Any other plan file's banner (01/08/13 banners are already correct).
- `instant-quote/README.md` — accurate enough; don't churn it.
- Any source code.
- `instant-quote/.env` — it exists and contains a real credential; do not read
  it into any committed file, do not move/delete it (a separate finding covers
  relocation+rotation).
- The tracked `.docx/.pptx/.xlsx` files at root — noted in the index as
  unplanned; leave them.

## Git workflow

- Branch: `advisor/005-docs-truth-pass`; message style matches repo log (e.g.
  "Docs: reconcile plan/ROADMAP/README status with shipped code; add root README, CLAUDE.md, .env.examples").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the `Plans/02` banner

Replace line 3 of `Plans/02-file-storage.md` with:

```
> **Status: 🟨 Storage half done** (2026-07-16, commit `a5cc39d`) — MinIO client, presigned upload-on-drop, file↔quote linkage, MakerWorld tee, and retention sweep shipped. The Go mesh port + order-time `VerifyOrderPricing` are **deferred** and required before/with plan 05.
```

**Verify**: `sed -n '3p' Plans/02-file-storage.md` shows the new banner.

### Step 2: Fix the ROADMAP roll-up and current-state paragraph

In `Plans/ROADMAP.md`:

1. In the "Implementation status" line (~13): change the date stamp to
   2026-07-17 and replace the `⬜ **02–16** not started` clause with a truthful
   roll-up: ✅ 01 done · 🟨 02 storage half (mesh port deferred, gates 05) ·
   ✅ 08 done · 🟨 13 phases 1–2 pre-built · ⬜ 03-07, 09-12, 14-16 not
   started (keep the existing groundwork caveats for 03/12).
2. Rewrite the "Current state in one paragraph" (~17) to today's truth. Keep
   the same voice and length. It must now say, at minimum: quotes/step-requests
   **persist to Postgres** (plan 01); files upload on drop to MinIO with a
   MakerWorld tee and retention sweep (plan 02 storage half); full PL+EN i18n
   via `src/lib/i18n` dictionaries (`strings.ts` is gone); SEO/content pages +
   blog shipped; a prototype login/orders flow exists (simulated OTP,
   unauthenticated endpoint, real auth in plans 04/05); still **no** CI/deploy,
   payments, email, or admin.

**Verify**: `grep -n "02–16\|02-16" Plans/ROADMAP.md` → no "not started"
roll-up match; `grep -c "strings.ts" Plans/ROADMAP.md` → 0.

### Step 3: Fix `backend/README.md`

1. Delete the `air` line from the Run block (no `.air.toml` exists; `go run` +
   `make dev` are the documented loop).
2. Replace the stubs paragraph (~104-107) with a truthful one, e.g.:

   ```
   `quotes` and `step-quotes` persist to Postgres (plan 01): prices are
   recomputed server-side, stored as integer grosze, and pinned to the active
   pricing-config snapshot. The client is never trusted for money.
   ```

3. Update the endpoint list to match `backend/api/openapi.yaml` exactly —
   enumerate the paths from that file (it is the contract); at planning time
   the missing ones were `GET /api/v1/orders`, `POST /api/v1/files`,
   `POST /api/v1/files/{fileId}/confirm`.
4. If plan 001 landed: add its one-sentence `make test-integration` mention in
   the test docs (see plan 001 Step 4; skip if already present).

**Verify**: `grep -n "air" backend/README.md` → no hot-reload line;
`grep -c "orders" backend/README.md` → ≥1 in the endpoint list;
`grep -n "honest stubs" backend/README.md` → no match.

### Step 4: Create the root `README.md`

Short — ~30 lines. Contents: one-paragraph product description (instant
3D-printing quotes, PL/EN, PLN, EU shipping; prototype heading toward
production per `Plans/ROADMAP.md`); the repo map (`backend/` Go API ·
`instant-quote/` frontend · `Plans/` roadmap corpus · `seo_prompts/` content
briefs); quickstart:

```sh
docker compose up -d            # postgres + minio
make dev                        # Go API :8080 + frontend :3000
make test                       # both unit suites
make test-integration           # + DB/S3 integration tests (plan 001)
```

and pointers to `backend/README.md`, `instant-quote/README.md`,
`Plans/ROADMAP.md`. No duplication of their content — links only.

**Verify**: `test -f README.md && head -5 README.md` → file exists with title.

### Step 5: Create the root `CLAUDE.md`

Content: the invariants block from "Current state" above, written as directives
for an agent, in this shape (~40 lines):

- Repo map + "start at README.md; plan status banners in `Plans/*.md` are the
  source of truth — read the banner before executing any plan."
- **Never hand-edit generated files** (list them: `backend/internal/httpapi/gen.go`,
  `backend/internal/store/*.sql.go`, `instant-quote/src/lib/api/schema.d.ts`,
  `instant-quote/src/routeTree.gen.ts`, `instant-quote/src/content/reference-prices.json`) —
  change the source (`api/openapi.yaml`, `queries/*.sql`, route files, pricing
  engine) and run `make -C backend gen`.
- Money: integer grosze, server-side recompute, golden fixtures pin the engine.
- i18n: `pl.ts` source of truth, `en.ts` mirrors, `bun run check-strings` gates.
- Verification commands per project (the tables from plans 001/003).

**Verify**: `test -f CLAUDE.md && grep -c "gen.go" CLAUDE.md` → ≥1.

### Step 6: Create both `.env.example` files

`backend/.env.example` — every backend var from "Current state", placeholder
values, one comment each, marked required/optional (only `DATABASE_URL` is
required for serve, and local tooling defaults it; `BAMBU_CLOUD_TOKEN` optional
— MakerWorld degrades gracefully; `S3_*` default to the compose MinIO).
`instant-quote/.env.example` — `API_PROXY` and `VITE_SITE_URL` with comments.
**Placeholders only — no real values anywhere.**

**Verify**: `grep -rn "minioadmin\|dev:dev" backend/.env.example` → only as
documented *defaults in comments* if at all (these are public compose dev
values, acceptable); `grep -c "=" backend/.env.example` → ≥10. Confirm no
64-char-plus token-looking strings: `grep -E "[A-Za-z0-9_-]{40,}" backend/.env.example instant-quote/.env.example` → no matches.

## Test plan

Docs-only; the gates are the greps above plus:
`cd instant-quote && bun run format:check` (prettier formats `.md` — run
`bun run format` if it rewrites the new files) and
`cd backend && go build ./...` (nothing code-side touched).

## Done criteria

ALL must hold:

- [ ] All Step 1-3 greps pass
- [ ] Root `README.md`, root `CLAUDE.md`, both `.env.example` files exist
- [ ] No secret values in any created file (Step 6 grep clean)
- [ ] `bun run format:check` and `go build ./...` exit 0
- [ ] `git status` shows only in-scope files
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The stale lines quoted in "Current state" are no longer present (someone
  already fixed them — reconcile, don't duplicate).
- You find yourself wanting to change a plan file's *content* beyond the
  status banner — plan bodies are decision records; out of scope.
- Any ambiguity about whether a feature is actually shipped: check
  `git log --oneline` for the commit named in this plan rather than guessing.

## Maintenance notes

- Whenever a plan lands, its banner AND the ROADMAP roll-up must both change —
  that rule is stated in ROADMAP.md itself; CLAUDE.md now points agents at it.
- The `.env.example` files must gain a line whenever a new env var is read in
  `backend/cmd/api/main.go` or `internal/storage/storage.go` — reviewer
  checklist item.
- Deferred deliberately: relocating/rotating the credential in
  `instant-quote/.env` (separate security finding); removing the tracked
  office binaries at root.
