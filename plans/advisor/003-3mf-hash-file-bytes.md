# Plan 003: 3MF uploads hash the file bytes, restoring content-addressing and MakerWorld tee dedup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/advisor/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 64dfb98..HEAD -- instant-quote/src/hooks/useMeshWorker.ts instant-quote/src/workers/mesh.worker.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes dedup keys for 3MF; see Maintenance notes)
- **Depends on**: none (plan 001 recommended first — its target verifies the backend side)
- **Category**: bug
- **Planned at**: commit `64dfb98`, 2026-07-17

## Why this matters

The system is content-addressed: files are stored at `uploads/<sha256>.<ext>`,
deduped by hash, and quote parts are linked to files only when the part's hash
equals the stored file's hash. For STL/OBJ/STEP the hash is SHA-256 of the file
bytes — correct. For **3MF**, the 3MF is parsed on the main thread and only the
flattened vertex positions are sent to the worker, which then hashes *those
positions* instead of the file. Consequences:

1. The backend's MakerWorld tee (`backend/internal/httpapi/handlers.go:565`)
   hashes the **real file bytes** — so the browser's hash for the same 3MF
   never matches, every MakerWorld import re-reserves a new row and re-PUTs up
   to 100 MB the server already stored, and two rows/objects exist per file.
2. For every browser-dropped 3MF, the stored object's key is not the SHA-256 of
   its content — the content-addressing invariant is silently violated.

The fix is small and frontend-only: for the 3MF branch, hash the original
`arrayBuffer` on the main thread and use that as the part hash.

## Current state

- `instant-quote/src/hooks/useMeshWorker.ts:70-107` — `analyze(file)`. The 3MF
  branch sends positions as the worker buffer:

  ```ts
  const arrayBuffer = await file.arrayBuffer()

  let request: WorkerRequest
  let pieces: MeshMetrics['pieces']
  if (kind === '3mf') {
    // Parse 3MF on the main thread, send flattened positions to the worker.
    const parts = parse3mfParts(arrayBuffer)
    if (parts.length >= 2) {
      pieces = parts.map((p) => ({ bboxMm: positionsBbox(p) }))
    }
    const positions = mergePositions(parts)
    request = {
      id,
      format: 'positions',
      buffer: positions.buffer as ArrayBuffer,
      fileName: file.name,
    }
  } else if (kind === 'stl' || kind === 'obj' || kind === 'step') {
    request = { id, format: kind, buffer: arrayBuffer, fileName: file.name }
  }
  ...
  const result = await new Promise<AnalyzeResult>((resolve, reject) => {
    pending.current.set(id, { resolve, reject })
    worker.postMessage(request, { transfer: [request.buffer] })
  })
  if (pieces) result.metrics.pieces = pieces
  return result
  ```

  Note: in the 3MF branch, `positions.buffer` is transferred — `arrayBuffer`
  itself is **not** transferred and stays valid on the main thread. That is
  what makes this fix cheap.

- `instant-quote/src/workers/mesh.worker.ts:24-35` — the worker hashes whatever
  buffer it received (correct for stl/obj/step = raw file bytes; wrong for
  `positions`):

  ```ts
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  }

  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const req = event.data
    try {
      // Hash the original bytes before we transfer/replace anything.
      const hash = await sha256Hex(req.buffer)
  ```

- Downstream consumers of the hash (context only — none of these files change):
  - `instant-quote/src/hooks/useParts.tsx:197-217` — `analyze(file).then(res =>
    dispatch({type:'parsed', hash: res.hash, ...}))` then
    `uploadFile(file, res.hash, kind)`.
  - `instant-quote/src/lib/upload-file.ts:22-23` — sends the hash as `sha256`
    to `POST /api/v1/files`; the backend keys the object as
    `uploads/<sha256>.<kind>` (`backend/internal/storage/storage.go:78`).
  - `backend/internal/httpapi/handlers.go:561-591` (`teeMakerworldFile`) —
    computes `sha256.Sum256(res.Bytes)` over the raw 3MF and dedups on it.
  - `backend/internal/httpapi/handlers.go:447-458` (`persistQuote`) — requires
    the part's hash to equal the stored file's hash before linking.

- The backend validates `sha256` as `^[a-f0-9]{64}$` — the worker's hex
  encoding already satisfies it; keep the same lowercase-hex format.

- Repo conventions: TypeScript, no semicolons per prettier config; tests are
  `bun test` specs colocated under `instant-quote/tests/` (see
  `tests/mesh-volume.test.ts`); fixtures are generated programmatically in
  `tests/fixtures/generate.ts` (exports include `multiItem3mf(...)`).

## Commands you will need

| Purpose | Command (from `instant-quote/`) | Expected on success |
|---------|--------------------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test` | all pass |
| Lint | `bun run lint` | exit 0 |
| Format | `bun run format:check` | exit 0 (run `bun run format` if it fails) |

## Scope

**In scope** (the only files you should modify):
- `instant-quote/src/hooks/useMeshWorker.ts`
- `instant-quote/tests/` — one new spec file (see Test plan)

**Out of scope** (do NOT touch):
- `instant-quote/src/workers/mesh.worker.ts` — its hashing stays correct for
  stl/obj/step; do not change the worker protocol.
- `instant-quote/src/hooks/useParts.tsx`, `src/lib/upload-file.ts` — they
  consume `res.hash` and need no change.
- All backend files — the tee and validation are already correct.
- `parse3mfParts` / `mergePositions` / `analyze` geometry code.

## Git workflow

- Branch: `advisor/003-3mf-hash-file-bytes`; message style matches repo log
  (e.g. "Frontend: 3MF part hash = SHA-256 of file bytes, fixing tee dedup").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a main-thread sha256 helper and export it for tests

In `instant-quote/src/hooks/useMeshWorker.ts`, add (module scope, exported so
the spec can import it):

```ts
// SHA-256 of raw file bytes, lowercase hex — must match what the backend's
// MakerWorld tee computes over the same bytes (content-addressed storage).
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

(This intentionally mirrors the worker's helper; the worker module can't be
imported from the main thread because it registers `self.onmessage`.)

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Override the hash for the 3MF branch

In `analyze()`, inside the `if (kind === '3mf')` branch, compute the file-bytes
hash **before** building the request (the buffer is still whole there):

```ts
if (kind === '3mf') {
  // Parse 3MF on the main thread, send flattened positions to the worker.
  // Hash the ORIGINAL file bytes here — the worker only sees positions, and
  // the backend (MakerWorld tee, content-addressed keys) hashes file bytes.
  fileHash = await sha256Hex(arrayBuffer)
  ...
```

declaring `let fileHash: string | undefined` next to `let pieces`, and after
the worker promise resolves, override:

```ts
if (pieces) result.metrics.pieces = pieces
if (fileHash) result.hash = fileHash
return result
```

(If `AnalyzeResult.hash` is a readonly type, build a new object
`{ ...result, hash: fileHash }` instead — check the type definition in the same
file/`src/lib/mesh/types.ts`.)

**Verify**: `bun run typecheck && bun run lint` → exit 0.

### Step 3: Pin the invariant with a spec

Create `instant-quote/tests/file-hash.test.ts`:

- Generate a multi-item 3MF fixture via `multiItem3mf(...)` from
  `tests/fixtures/generate.ts` (see `tests/mesh-volume.test.ts` for its
  existing usage/arguments).
- Compute `await sha256Hex(fixtureBuffer)` (import from
  `#/hooks/useMeshWorker` — note the repo's `#/*` import alias maps to `./src/*`;
  check how other specs import from src and match).
- Assert it equals an independent hash of the same bytes, e.g. via Bun's
  `new Bun.CryptoHasher('sha256')` or Node's `crypto.createHash('sha256')`,
  hex-encoded. This pins "hash = file bytes, not positions": also assert it
  does **not** equal `sha256Hex(mergePositions(parse3mfParts(buffer)).buffer)`
  (the old, wrong value).
- Add a known-vector sanity case: `sha256Hex(new TextEncoder().encode('abc').buffer)`
  → `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.

**Verify**: `bun test tests/file-hash.test.ts` → all pass; `bun test` → whole
suite passes.

### Step 4: Manual end-to-end check (optional but recommended)

If a local stack is available (`make dev` at repo root, compose services up):
drop any `.3mf` file, and compare the `sha256` field in the `POST /api/v1/files`
request (browser network tab) against `shasum -a 256 <file>` — they must match.
If a `BAMBU_CLOUD_TOKEN` is configured, paste a MakerWorld URL twice: the second
import must show `alreadyStored: true` with **no** presigned PUT.

**Verify**: hashes match; no PUT on the deduped path.

## Test plan

- New `instant-quote/tests/file-hash.test.ts` (Step 3): known-vector case,
  fixture-bytes case, and the not-equal-to-positions-hash regression case.
- Existing `bun test` suite must stay green — especially
  `tests/mesh-volume.test.ts` (geometry values are untouched by this change).

## Done criteria

ALL must hold:

- [ ] `bun run typecheck`, `bun run lint`, `bun run format:check` exit 0
- [ ] `bun test` exits 0 including ≥3 new assertions in `tests/file-hash.test.ts`
- [ ] The 3MF branch of `analyze()` derives `hash` from `arrayBuffer`, not from
      the worker's positions hash (confirm by reading the final diff)
- [ ] STL/OBJ/STEP behavior unchanged (no diff outside the 3MF branch + helper)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/advisor/README.md` status row updated

## STOP conditions

Stop and report back if:

- The `analyze()` excerpt doesn't match the live code (drifted).
- `AnalyzeResult`/`WorkerResponse` typing makes the hash override require
  changing the worker protocol — that contradicts the out-of-scope boundary;
  report instead of widening scope.
- Existing mesh tests fail after the change — the change must not touch
  geometry.

## Maintenance notes

- **Dedup-key migration**: any 3MF rows already in the local dev DB are keyed
  by the old positions-hash and will simply never dedup-match again; the
  retention sweep reclaims them (unreferenced) after the window. No production
  deployment exists (plans/engineering/03 unstarted), so no data migration is needed — but
  if this lands *after* a production launch, revisit.
- The deferred mesh-recompute work (`plans/engineering/02-file-storage.md`, before plan 05)
  will re-hash stored bytes server-side at order time; with this fix, its hash
  comparison becomes meaningful for 3MF.
- Reviewer should scrutinize: the hash is computed **before**
  `worker.postMessage` transfers `positions.buffer` — `arrayBuffer` is never
  transferred in the 3MF branch, so there's no detached-buffer hazard; confirm
  that ordering survived review.
