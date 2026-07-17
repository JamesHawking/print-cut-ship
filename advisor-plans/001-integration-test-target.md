# Plan 001: One command runs the full backend suite including DB/S3 integration tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 64dfb98..HEAD -- backend/Makefile Makefile backend/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `64dfb98`, 2026-07-17

## Why this matters

`make test` (root and `backend/`) runs `go test ./...` with no `TEST_DATABASE_URL`
/ `TEST_S3_ENDPOINT` exported, so every DB- and MinIO-backed integration test
**silently self-skips**: the persistence round-trips, the presigned-upload flow,
and the retention sweep — exactly the layers with no unit coverage. A developer
gets a green suite while the entire storage/persistence integration layer never
executes. The docker-compose services these tests need already exist; the gap is
one Makefile target. Plans 002 and 003 rely on this target for their verification.

## Current state

- `backend/Makefile` — the test and db-up targets today:

  ```make
  db-up:
  	cd .. && docker compose up -d --wait postgres

  ...

  test:
  	go test ./...
  ```

  Note `db-up` here waits **only postgres** (the root Makefile's `db-up` waits
  `postgres minio`). `DATABASE_URL` is defaulted at the top of the file:

  ```make
  DATABASE_URL ?= postgres://dev:dev@localhost:5432/instantquote
  export DATABASE_URL
  ```

- Root `Makefile` — `test:` runs both suites, no TEST_* env either:

  ```make
  test:
  	cd backend && go test ./...
  	cd instant-quote && bun test
  ```

- The gated tests and their skip lines (do not modify these files):
  - `backend/internal/httpapi/persistence_test.go:28-30` — skips unless `TEST_DATABASE_URL`
  - `backend/internal/httpapi/files_test.go` (~line 23) — skips unless both vars
  - `backend/internal/storage/retention_test.go:21-24`:

    ```go
    dbURL := os.Getenv("TEST_DATABASE_URL")
    if dbURL == "" || os.Getenv("TEST_S3_ENDPOINT") == "" {
        t.Skip("TEST_DATABASE_URL and TEST_S3_ENDPOINT required")
    }
    ```

- `docker-compose.yml` (repo root) — services the tests need, both in the
  default profile: `postgres` (postgres:16, port 5432, user/pass/db =
  dev/dev/instantquote) and `minio` (minio/minio, port 9000, root user/pass
  minioadmin/minioadmin).

- `backend/README.md` already documents running one gated suite by hand
  (section "Database", ~line 60):

  ```sh
  TEST_DATABASE_URL=postgres://dev:dev@localhost:5432/instantquote go test ./internal/httpapi/
  ```

- **Convention note**: the gated tests `TRUNCATE` every table in the database
  they point at (see `retention_test.go:34`). The README already points them at
  the local dev database — that is the established convention; the new target
  keeps it but the docs must state the data-loss consequence.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Services up | `docker compose up -d --wait postgres minio` (repo root) | exit 0 |
| Backend build | `cd backend && go build ./...` | exit 0 |
| Backend unit suite | `cd backend && make test` | exit 0, `ok` lines |
| Vet | `cd backend && go vet ./...` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/Makefile`
- `Makefile` (repo root)
- `backend/README.md` (the test-docs sentence only)

**Out of scope** (do NOT touch):
- Any `_test.go` file — the skip-gating stays as is.
- `docker-compose.yml` — services are already correct.
- CI configuration — none exists; plan 03 in `Plans/` owns it.

## Git workflow

- Branch: `advisor/001-integration-test-target` (repo works on `main` with
  descriptive messages like "Backend: Postgres persistence for quotes/step-requests (plan 01)" — match that style).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make backend `db-up` also wait for MinIO

In `backend/Makefile`, change:

```make
db-up:
	cd .. && docker compose up -d --wait postgres
```

to:

```make
db-up:
	cd .. && docker compose up -d --wait postgres minio
```

**Verify**: `make -C backend db-up` → exit 0; `docker compose ps` (repo root)
shows both `postgres` and `minio` healthy.

### Step 2: Add `test-integration` to `backend/Makefile`

Add below the existing `test:` target (and add `test-integration` to the
`.PHONY` line at the top of the file):

```make
# Full suite including the DB/S3-gated integration tests, against the local
# docker-compose services. NOTE: truncates the local dev database.
test-integration: db-up
	TEST_DATABASE_URL=$(DATABASE_URL) TEST_S3_ENDPOINT=localhost:9000 go test ./...
```

**Verify**: `make -C backend test-integration` → exit 0, and the gated tests
actually ran:

```sh
cd backend && TEST_DATABASE_URL=$DATABASE_URL TEST_S3_ENDPOINT=localhost:9000 \
  go test ./internal/storage/ ./internal/httpapi/ -run 'TestRunSweep|TestSubmitQuotePersists' -v 2>&1 | grep -E -- '--- (PASS|SKIP|FAIL)'
```

→ every listed test shows `--- PASS`, none show `--- SKIP`.
(If `DATABASE_URL` is unset in your shell, use `postgres://dev:dev@localhost:5432/instantquote`.)

### Step 3: Add a root passthrough target

In the root `Makefile`, add `test-integration` to `.PHONY` and:

```make
# Backend suite including DB/S3 integration tests (starts compose services).
test-integration:
	$(MAKE) -C backend test-integration
	cd instant-quote && bun test
```

**Verify**: `make test-integration` from the repo root → exit 0, Go suite runs
un-skipped, then the frontend `bun test` suite passes.

### Step 4: Document the target in `backend/README.md`

In the section that currently shows the hand-rolled
`TEST_DATABASE_URL=... go test ./internal/httpapi/` example, add one sentence
before/after it:

> `make test-integration` runs the whole suite with both gates enabled against
> the docker-compose services — note it **truncates the local dev database**.

Keep the existing hand-rolled example (it documents running a single package).

**Verify**: `grep -n "test-integration" backend/README.md` → at least one match.

## Test plan

No new test files — this plan makes existing tests run. The regression test *is*
Step 2's verify: gated tests report `--- PASS`, not `--- SKIP`.

## Done criteria

ALL must hold:

- [ ] `make -C backend test-integration` exits 0
- [ ] Step 2's grep shows `--- PASS` for `TestRunSweep` and `TestSubmitQuotePersists`, zero `--- SKIP`
- [ ] `make test` still works unchanged (unit-only, no compose requirement beyond what it had)
- [ ] `git status` shows only the three in-scope files modified
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The Makefile excerpts above don't match the live files (drifted).
- `docker compose up -d --wait postgres minio` fails (e.g. Docker not running,
  port 5432/9000 occupied) — report the compose error, don't work around it.
- Gated tests FAIL (not skip) once enabled — that's a real regression the
  advisor needs to see, not something to patch in this plan.

## Maintenance notes

- Plan 03 (`Plans/03-deploy-ci.md`) will wire CI; the CI job should call this
  same target so local and CI semantics stay identical.
- Plans 002/003 in this folder use `make -C backend test-integration` as their
  verification gate.
- Future improvement (out of scope, noted): point TEST_DATABASE_URL at a
  separate `instantquote_test` database so the target stops truncating dev data.
