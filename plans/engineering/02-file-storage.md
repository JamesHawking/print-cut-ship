# Plan 02 — File storage for uploaded models

> **Status: ✅ Done with notes** (2026-07-17). Storage client, presigned upload
> endpoints, upload-confirm, file↔quote linkage, MakerWorld tee, and the
> retention sweep shipped earlier; the deferred security-critical half landed
> 2026-07-17: server-side geometry recompute (`internal/mesh` + Go port of the
> client pipeline) wired into `POST /quotes` as `httpapi.recomputeQuoteParts`,
> so the price is computed from stored bytes. **Notes:** (1) recompute is
> _tolerance-based authoritative_, not the brief's bit-exact `VerifyOrderPricing`
> — the server is authoritative, so no convex-hull port and non-watertight
> meshes defer to client metrics + a flag (see `backend/README.md` mesh section
> and `research/competitors/seekmake-public-api.md` for the rationale);
> (2) placed in `httpapi/verify.go` (not `internal/orders`) — plan 05 extracts
> the order-time call site mechanically; (3) STEP `manual_verify` remains
> plans 05/07 as designed; (4) the `files.kind` migration comment (`'mesh'|'step'`)
> is stale vs the actual `stl/obj/3mf/step` — no comment-only migration; fix in
> the next real files migration.

> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`). Storage client, upload endpoints, recompute, and retention all live in `backend/` (Go); the browser talks to them through the OpenAPI client.

## 1. Context

Today every uploaded model is parsed **client-side and never persisted**. The intake pipeline in `instant-quote/src/hooks/useParts.tsx` hands each `File` to `useMeshWorker` (`instant-quote/src/hooks/useMeshWorker.ts`), which runs a web worker (`instant-quote/src/workers/mesh.worker.ts`) parsing STL/OBJ/STEP (STEP via a ~10 MB `occt-import-js` WASM) and 3MF (main thread, `src/lib/mesh/parse-3mf.ts`), then computes geometry via `src/lib/mesh/analyze.ts`. The resulting `MeshMetrics`, positions, and hash live **only in React state**. A refresh loses everything.

The one time bytes touch a server is the MakerWorld path: the Go proxy (`backend/internal/makerworld/makerworld.go`, `POST /api/v1/makerworld/fetch`) downloads the 3MF, **streams it to the browser, and discards it**.

Why this is a problem for a real shop:

- **Production can't print what it can't see.** When an order lands, the admin (plan 07) needs the actual geometry file, but it's gone when the tab closes.
- **Money rides on client-computed geometry.** The Go intake (`POST /api/v1/quotes`) already recomputes *prices* server-side, but from **client-submitted metrics** (volume/area) — a hostile client can still fabricate small volumes. There is no server-side geometry to check against.
- **The privacy promise will become false.** The Hero copy in `instant-quote/src/lib/strings.ts` reads *"Private — files never leave your session unless you order."* Once files upload on drop, that line must change (owned by plans 13/09).

This plan adds MinIO object storage, a presigned-upload path, linkage of stored files to quote/order records, a scheduled retention sweep, and — the security-critical piece — a **server-side re-parse + re-price in Go** so the price a customer pays is computed from geometry the server actually holds.

## 2. Decisions applied

**Pinned in `DECISIONS.md`:**

- **MinIO on Coolify, S3 API, presigned uploads** — standard S3 client code; later move to R2/S3 is config-only. Backups off-server (plan 03).
- **Go backend owns all API surface** (amendment) — storage endpoints, recompute, and the retention job are Go; no storage credentials ever reach the frontend beyond short-TTL presigned URLs.
- **Background jobs = Coolify scheduled tasks** — this plan ships the sweep as an `api` subcommand; plan 03 owns the runner.
- **Schema ownership = plan 01 owns `files`** — this plan populates it and requested its columns (hash, storage_key, status, metrics, expires_at, deleted_at — already in plan 01's migration sketch).
- **Money = integer grosze; orders snapshot the breakdown** (plan 05). The recompute here produces the numbers that snapshot captures.

**Topic-local decisions resolved:**

1. **Recompute pricing-relevant metrics server-side — YES, at order time, in Go.** The quote price derives from `volumeCm3`/`surfaceAreaCm2`; trusting the client for money is untenable. Recompute at **order submission** (the money moment; file guaranteed uploaded by then) rather than per-quote. This requires porting mesh parsing + analysis to Go (`internal/mesh`) for STL/OBJ/3MF — mechanical ports (binary STL via `encoding/binary`, OBJ line parsing, 3MF via `archive/zip` + `encoding/xml`, signed-tet-volume analyze), pinned by fixtures generated from the existing TS tests (same pattern as the pricing golden fixtures). **STEP is excluded from auto-recompute at launch** (OCCT has no practical Go port): STEP-backed orders are flagged `manual_verify` for plan 07's admin review before production, with tight sanity bounds at intake. Revisit in plan 16 (STEP hardening).
2. **Upload timing = on drop (background, non-blocking), not on order.** The roadmap's retention policy distinguishes *unordered uploads* from *ordered files*, which only makes sense if files exist before an order; upload-on-drop also gives abandoned-quote follow-up (06) and quote links (14) real geometry. The cost — files leaving the session pre-order — is exactly why the Hero/privacy copy must change (13/09). *Rejected:* upload-only-at-order (erases the unordered retention class).
3. **Storage keys = content-addressed by SHA-256** (`uploads/<sha256>.<ext>`). The worker already computes SHA-256 (`Part.hash`); keying on it gives free dedup and idempotent PUTs. The client hash is trusted *only for the key* — the order-time recompute re-hashes stored bytes, so a lie is caught where it matters.
4. **S3 client = `minio-go` (official MinIO Go SDK).** First-party against the chosen server, handles path-style + SigV4 + presign natively, no AWS SDK weight. Isolated in `internal/storage`; swapping to aws-sdk-go-v2 later is localized.
5. **MakerWorld files are stored server-side at fetch time (tee), not re-uploaded by the browser.** The Go proxy already holds the bytes — hash + PUT to MinIO + insert the `files` row inside the fetch handler, returning `x-mw-file-id` alongside the existing `x-mw-filename`. Saves a 100 MB round-trip per import. (The pre-pivot plan re-uploaded from the browser for uniformity; with the proxy and storage in the same process, the tee is strictly better.)

## 3. Implementation phases

### Phase A — Storage client & config (Go)

**New `backend/internal/storage/storage.go`** — thin wrapper over `minio-go`:

```go
// Env (Coolify; local via docker-compose MinIO):
//   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
type Store struct{ ... }
func (s *Store) Key(sha256, ext string) string
func (s *Store) PresignPut(ctx, key, contentType string, maxBytes int64) (url string, err error) // ~5 min TTL
func (s *Store) Head(ctx, key string) (size int64, ok bool, err error)
func (s *Store) Get(ctx, key string) (io.ReadCloser, error)            // recompute + admin download
func (s *Store) Put(ctx, key string, r io.Reader, size int64) error    // MakerWorld tee
func (s *Store) Delete(ctx, key string) error
```

**Local dev:** add a `minio` service to the docker-compose from plan 01. Document `S3_*` in `backend/README.md`.

**Verify:** a Go test (skipped without `TEST_S3_ENDPOINT`) presigns a PUT, uploads via `http.Client`, `Head` sizes match, `Get` round-trips bytes.

### Phase B — Upload endpoints (OpenAPI + handlers)

**Extend `backend/api/openapi.yaml`** (then `make gen` for Go server + TS client):

- `POST /api/v1/files` — body `{ sha256, fileName, kind: stl|obj|3mf|step, sizeBytes }` (sizeBytes ≤ the existing 100 MB cap). Reserves a `files` row (`status='pending'`), returns `{ fileId, uploadUrl?, alreadyStored }` — dedup: if a row with this sha256 is already `uploaded`, return its id with `alreadyStored: true` and no URL.
- `POST /api/v1/files/{fileId}/confirm` — after the browser PUT: handler `Head`s the object; size match → `status='uploaded'`, else `failed`.

**New `backend/internal/httpapi/files.go`** implementing both against `internal/store` (sqlc queries `InsertFile`, `GetFileBySha256`, `SetFileStatus` in `internal/store/queries/files.sql`).

**Verify:** handler tests against test DB + MinIO — create → PUT → confirm flips to `uploaded`; duplicate sha256 returns `alreadyStored: true` with no URL.

### Phase C — Wire the browser intake

**Modify `instant-quote/src/hooks/useParts.tsx`:**

- Extend `Part`: `fileId?: string`, `uploadStatus?: 'uploading' | 'stored' | 'failed'`.
- After `analyze(file)` resolves (hash + kind + size known), kick off a **background** upload that never blocks `quote_shown`: `POST /files` via the generated openapi-fetch client → if not `alreadyStored`, `fetch(uploadUrl, { method: 'PUT', body: file })` → `POST /files/{id}/confirm` → dispatch `fileId`.
- Reducer actions `upload_started`/`uploaded`/`upload_failed` mirroring the existing `parsed`/`failed` shape. Upload failure is **non-fatal to the quote** (price still shows); it only blocks *ordering* (plan 05 gates on a stored `fileId`). Soft toast on failure.
- Funnel events for upload start/success/failure (existing taxonomy in `src/lib/funnel.ts`).

**MakerWorld path (Go tee):** modify the `makerworld/fetch` handler to hash the downloaded bytes, `Put` to MinIO, insert the `files` row (`source='makerworld'`, `source_ref`), and return `x-mw-file-id`; `useParts` attaches it to the part instead of re-uploading.

**Verify:** run the app (`instant-quote:verify` skill), drop an STL: network shows presigned PUT (200), part carries `fileId`, object visible in MinIO console after tab close. Paste a MakerWorld URL: part gets a `fileId` with **no** browser PUT.

### Phase D — Server-side recompute (the price-tamper guard)

**New `backend/internal/mesh/`** — Go port of the DOM-free pipeline:

- `parse_stl.go` (binary + ASCII, content-detected like the TS parser), `parse_obj.go`, `parse_3mf.go` (`archive/zip` + `encoding/xml`, multi-item aware for the multi-plate path), `analyze.go` (single-pass signed-tet volume, surface area, bbox — same math as `instant-quote/src/lib/mesh/analyze.ts`).
- Fixtures: generate position-soup + expected-metrics fixtures from the existing TS test suite (`instant-quote/tests/mesh-volume.test.ts` fixtures) before any refactor — same frozen-golden pattern as `internal/pricing/testdata/golden.json`.

**New `backend/internal/orders/verify.go`** — called in-process by plan 05's order creation (not a public endpoint):

```go
// For each ordered part: storage.Get(file.storage_key) -> mesh.Recompute ->
// pricing.ComputePartQuote -> pricing.ComputeOrderTotals across parts.
// Exact integer-grosze comparison after round2. STEP parts skip geometry
// recompute and mark the order manual_verify.
func VerifyOrderPricing(ctx, parts, clientTotals) (VerifyResult, error)
```

On success, recomputed metrics are written to `files.metrics` and become the numbers plan 05 snapshots. Any deviation beyond rounding → `price_mismatch`; stored-bytes hash ≠ claimed hash → `hash_mismatch`.

**Verify:** integration test — store a real STL, submit an order with `grossTotal` halved → `price_mismatch` with the honest total returned; honest total → ok and `files.metrics` populated; 3MF multi-item fixture recomputes `pieceCount`/`plates` consistently with the client.

### Phase E — Retention sweep

**New `api retention-sweep` subcommand** (`cmd/api/main.go` + `internal/storage/retention.go`), invoked by plan 03's Coolify scheduled task:

- **Unordered uploads:** `uploaded`, unreferenced by any order, older than `FILE_RETENTION_UNORDERED_DAYS` (default 30) → delete object + `status='deleted'`.
- **Ordered files:** older than `FILE_RETENTION_ORDERED_DAYS` (default 365 post-fulfilment) → delete + mark. **Invoice PDFs are out of scope** — the ~5-year invoice retention (plans 05/09) covers invoices, not model geometry.
- Idempotent; logs counts (plan 11 observability).

**Verify:** seed a backdated unordered file + a recent one; run the sweep; old object gone and row `deleted`, recent untouched; re-run is a no-op.

## 4. Dependencies

**Must land first:**
- **Plan 01** — `files` table + quote/order FK seams; store layer. Phase A and the pure `internal/mesh` port can proceed in parallel; B–E integrate against 01.
- **Plan 03** — Coolify MinIO resource, prod `S3_*` secrets, scheduled-task runner. Local dev is self-contained.

**Unblocks:**
- **Plan 05** — orders reference stored `fileId`s and call `VerifyOrderPricing` pre-payment; recomputed metrics feed the snapshot.
- **Plan 07** — per-order model download streams `storage.Get` through an admin Go endpoint.

**Coordinate (non-blocking):**
- **Plans 13/09** — Hero privacy line + privacy policy must disclose upload storage and retention windows. **Do not ship this to production before that copy lands** (or gate behind a flag).
- **Plan 10** — quote-time sanity bounds on client metrics, upload content validation (magic bytes, 3MF zip-bomb guard), and rate limits on `POST /files` live in 10; **order-time correctness lives here**.

## 5. Verification (executable checklist)

1. **Round-trip storage:** Go test — presign PUT → upload → Head size match → Get bytes identical.
2. **Upload on drop:** drive the app; presigned PUT succeeds, part gains `fileId`, object in bucket.
3. **Survives browser close:** after (2), close tab; `storage.Get(storage_key)` still returns bytes (proxy for plan 07's admin download).
4. **Dedup:** same file twice → second `POST /files` returns `alreadyStored: true`, no PUT.
5. **MakerWorld tee:** paste a URL → part has `fileId`, no browser PUT, `files.source='makerworld'`.
6. **Price-tamper test:** halved `grossTotal` → `price_mismatch` + honest total; honest → ok + metrics stored.
7. **Hash-tamper test:** `fileId` whose stored bytes hash differently → `hash_mismatch`.
8. **STEP path:** STEP-backed order is created but flagged `manual_verify`; admin queue (07) sees it.
9. **Retention:** backdated unordered file deleted; recent + ordered files survive; idempotent.
10. **Missing-file guard:** ordering a part with `status != 'uploaded'` is rejected before payment.
11. `go test ./...` green including new mesh fixtures; frontend `bun test` untouched and green.

## 6. Risks & open questions

- **Go mesh-port fidelity.** The analyze math must match the TS worker bit-for-bit where it feeds pricing (volume/area feed `round2` money math). Mitigation: fixture-pin against the TS test corpus before wiring; any float divergence beyond grosze rounding fails the golden test. 3MF transform flattening (world matrices) is the fiddliest part — port `parse-3mf.ts`'s flattening with its own fixtures.
- **STEP has no Go recompute.** OCCT bindings in Go are impractical at launch. Accepted: STEP orders are `manual_verify` (admin confirms geometry/price before production). Tight intake sanity bounds (plan 10) limit abuse. Revisit: server-side occt via a sidecar or WASM runtime is a plan 16 candidate.
- **Large-file recompute cost.** 100 MB meshes re-parsed at order creation add latency/memory. Mitigation: stream from MinIO, cap concurrency (semaphore in the handler), and if heavy, hold orders in a `verifying` state processed by a scheduled sweep — still cron-shaped, no queue infra.
- **Privacy-copy timing.** Upload-on-drop makes the Hero line false the moment it ships. Sequencing rule: this plan's Phase C does not deploy to production ahead of the 13/09 copy changes (flag-gate if needed).
- **Presigned-PUT hash trust.** A client can upload bytes that don't match the claimed key; the order-time re-hash catches it where it matters. Worst case is a wasted object, which retention reclaims.
- **Open question (with plan 01):** file→order linkage stays as FKs from order-item rows to `files` (a file can back multiple parts/quotes via dedup) — confirmed against plan 01's schema sketch; plan 05 must include `file_id` on `order_items`.
