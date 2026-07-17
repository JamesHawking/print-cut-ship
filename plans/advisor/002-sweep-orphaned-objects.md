# Plan 002: Retention sweep removes orphaned MinIO objects of unconfirmed uploads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/advisor/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 64dfb98..HEAD -- backend/internal/storage/retention.go backend/internal/store/queries/files.sql backend/internal/storage/retention_test.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/advisor/001-integration-test-target.md (verification gate)
- **Category**: bug
- **Planned at**: commit `64dfb98`, 2026-07-17

## Why this matters

A browser can PUT file bytes to the presigned MinIO URL and then never confirm
(tab closed, network drop, or a size-mismatch 400 from
`ConfirmFileUpload` that deliberately leaves the row pending —
`backend/internal/httpapi/files.go:132-134`). The retention sweep assumes
pending rows have "no object to remove": it soft-deletes the row and **never
deletes the object**, so the object at `uploads/<sha256>.<ext>` is orphaned
forever. Storage grows unboundedly with no reclaim path. The fix: when sweeping
a stale pending row, also best-effort-remove its would-be object.

## Current state

- `backend/internal/storage/retention.go` — the sweep. The stale-pending branch
  (lines 30-39) only soft-deletes:

  ```go
  pendingCutoff := tstamp(now.Add(-stalePendingHours * time.Hour))
  stale, err := st.ListStalePendingFiles(ctx, pendingCutoff)
  if err != nil {
      return err
  }
  for _, id := range stale {
      if err := st.SoftDeleteFile(ctx, id); err != nil {
          return err
      }
  }
  ```

  Contrast the unreferenced-uploaded branch just below (lines 46-59), which
  already does best-effort object removal — this is the pattern to copy:

  ```go
  for _, f := range unref {
      if f.StorageKey != nil {
          if err := strg.Remove(ctx, *f.StorageKey); err != nil {
              // Log and continue: a missing object shouldn't block reclaiming
              // the rest, and the row still gets soft-deleted below.
              logger.Warn("sweep: remove object failed", "err", err, "key", *f.StorageKey)
          }
      }
      if err := st.SoftDeleteFile(ctx, f.ID); err != nil {
          return err
      }
      removed++
  }
  ```

- `backend/internal/store/queries/files.sql:22-25` — the query returns only ids,
  so the sweep can't compute the object key (`uploads/<hash>.<kind>`):

  ```sql
  -- name: ListStalePendingFiles :many
  -- Uploads that reserved a row but never confirmed (no object to remove).
  SELECT id FROM files
  WHERE storage_key IS NULL AND deleted_at IS NULL AND created_at < $1;
  ```

- `backend/internal/storage/storage.go:78-80` — key derivation:

  ```go
  func Key(sha256, ext string) string {
      return "uploads/" + sha256 + "." + ext
  }
  ```

  and `Remove` (line 122) wraps `minio.RemoveObject` — S3 delete of a
  nonexistent key is not an error, so calling it unconditionally is safe.

- `files` table columns (migration `00001_base_schema.sql`): `hash` is
  **nullable** (`*string` in Go), `kind` is NOT NULL (`string`).

- Codegen convention: queries in `backend/internal/store/queries/*.sql` are
  compiled by sqlc via `make -C backend gen-sqlc` into
  `backend/internal/store/files.sql.go` (generated — never hand-edit).
  Multi-column `:many` queries generate a `List...Row` struct.

- Test exemplar: `backend/internal/storage/retention_test.go` — `TestRunSweep`
  seeds four files: (a) old uploaded unreferenced → swept + object removed,
  (b) old uploaded referenced → kept, (c) old pending → swept, (d) fresh → kept.
  Case (c) is seeded via `insert("pending", nil)` with hash = `"pending"`,
  kind = `"3mf"` (the `insert` helper uses the name as the hash). The test is
  gated: skips unless `TEST_DATABASE_URL` and `TEST_S3_ENDPOINT` are set.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Regenerate sqlc | `make -C backend gen-sqlc` | exit 0, `files.sql.go` updated |
| Build | `cd backend && go build ./...` | exit 0 |
| Vet | `cd backend && go vet ./...` | exit 0 |
| Full gated suite | `make -C backend test-integration` | exit 0 (needs plan 001; else export `TEST_DATABASE_URL=postgres://dev:dev@localhost:5432/instantquote TEST_S3_ENDPOINT=localhost:9000` with compose up) |

## Scope

**In scope** (the only files you should modify):
- `backend/internal/store/queries/files.sql`
- `backend/internal/store/files.sql.go` (via `make gen-sqlc` only — never by hand)
- `backend/internal/storage/retention.go`
- `backend/internal/storage/retention_test.go`

**Out of scope** (do NOT touch):
- `backend/internal/httpapi/files.go` — the confirm handler's
  leave-pending-on-mismatch behavior is intentional (the sweep is the reclaim
  path; this plan completes that contract).
- `backend/internal/storage/storage.go` — `Key`/`Remove` are correct as is.
- Migrations — no schema change is needed.

## Git workflow

- Branch: `advisor/002-sweep-orphaned-objects`; message style matches repo log
  (e.g. "Backend: retention sweep removes orphaned objects of stale pendings").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Return hash + kind from `ListStalePendingFiles`

In `backend/internal/store/queries/files.sql`, change the query to:

```sql
-- name: ListStalePendingFiles :many
-- Uploads that reserved a row but never confirmed. hash+kind let the sweep
-- remove the object a browser may have PUT without confirming.
SELECT id, hash, kind FROM files
WHERE storage_key IS NULL AND deleted_at IS NULL AND created_at < $1;
```

Then regenerate: `make -C backend gen-sqlc`.

**Verify**: `grep -n "ListStalePendingFilesRow" backend/internal/store/files.sql.go`
→ a generated row struct with `ID`, `Hash *string`, `Kind string` exists.
`cd backend && go build ./...` → **fails** (retention.go still ranges over ids) —
expected; fixed in Step 2.

### Step 2: Remove the object before soft-deleting the row

In `backend/internal/storage/retention.go`, replace the stale-pending loop with
(match the comment style of the unref branch below it):

```go
for _, f := range stale {
    if f.Hash != nil {
        // The browser may have PUT the bytes without ever confirming; delete
        // the would-be object. Best-effort: S3 delete of a missing key is a
        // no-op, and a transient failure shouldn't block reclaiming the rest.
        key := Key(*f.Hash, f.Kind)
        if err := strg.Remove(ctx, key); err != nil {
            logger.Warn("sweep: remove pending object failed", "err", err, "key", key)
        }
    }
    if err := st.SoftDeleteFile(ctx, f.ID); err != nil {
        return err
    }
}
```

(`Key` is package-local — `retention.go` is already in package `storage`.)

**Verify**: `cd backend && go build ./... && go vet ./...` → exit 0.

### Step 3: Extend `TestRunSweep` to pin the new behavior

In `backend/internal/storage/retention_test.go`, extend case (c): before the
sweep runs, PUT an object at the stale pending's derived key, and after the
sweep assert it is gone. Concretely, after the existing `pending := insert("pending", nil)`
/ `backdate(pending)` lines add:

```go
// The browser PUT bytes but never confirmed — the sweep must reclaim the object.
pendingKey := storage.Key("pending", "3mf")
if err := strg.Put(ctx, pendingKey, bytes.NewReader([]byte("xyz")), 3, "model/3mf"); err != nil {
    t.Fatalf("put pending: %v", err)
}
```

and after the existing `if !deleted(pending)` assertion add:

```go
if _, ok, _ := strg.Stat(ctx, pendingKey); ok {
    t.Error("orphaned pending object should be removed")
}
```

(The `insert` helper sets hash = the name, so `"pending"`/`"3mf"` matches the
key the sweep derives.)

**Verify**: `make -C backend test-integration` → exit 0;
`go test ./internal/storage/ -run TestRunSweep -v` (with both TEST_* vars set)
→ `--- PASS: TestRunSweep`.

## Test plan

- Extended `TestRunSweep` (Step 3) covers: orphaned-object removal (the bug),
  plus the pre-existing cases (a)(b)(d) and the idempotent re-run must all
  still pass unchanged.
- No new test file; model additions on the existing helpers (`insert`,
  `backdate`, `strg.Put`, `strg.Stat`).

## Done criteria

ALL must hold:

- [ ] `make -C backend gen-sqlc` produces no further diff (idempotent)
- [ ] `cd backend && go build ./... && go vet ./...` exit 0
- [ ] `make -C backend test-integration` exits 0, `TestRunSweep` PASSes (not SKIP)
- [ ] `git status` shows only the four in-scope files modified
- [ ] `plans/advisor/README.md` status row updated

## STOP conditions

Stop and report back if:

- The retention.go / files.sql excerpts don't match the live code (drifted).
- After Step 1, the generated struct's field types differ from `Hash *string` /
  `Kind string` (schema drifted — someone changed nullability).
- `TestRunSweep` fails on a pre-existing assertion (cases a/b/d) — that's a
  regression outside this plan's scope.

## Maintenance notes

- The mesh-recompute follow-up (deferred half of `plans/engineering/02-file-storage.md`)
  will add content verification at confirm time; it does not change this
  reclaim path.
- Reviewer should scrutinize: the object key is *derived* (`Key(hash, kind)`),
  not read from `storage_key` (NULL for pendings by definition) — that
  asymmetry is correct and worth a comment, which Step 2 includes.
- Deferred (why): batching the row-by-row `SoftDeleteFile` loop — the sweep is
  a daily background job; N round-trips are acceptable at current scale.
