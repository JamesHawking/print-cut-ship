# 12 — Test & quality expansion

## 1. Context

Coverage today is deep but narrow. **Frontend:** 109 unit tests (`instant-quote/tests/`) on the pure libs — mesh parsing/analysis, packing, MakerWorld URL parsing, STEP quoting — all `bun test`, zero component/route/E2E coverage. **Backend:** Go tests including the crown jewel — `backend/internal/pricing/golden_test.go` with 1,512 part-quote golden cases (+ order totals, packing, ship dates) frozen from the retired TS engine, plus handler and leadtime tests. A local `instant-quote:verify` skill covers manual browser passes.

What nothing covers: the money path end-to-end (upload → quote → checkout → paid order → admin), webhook robustness (replay/out-of-order/forgery), DB-backed handler behavior, or any browser-level regression. Every Phase 1 topic (04–07) lands new surface that must arrive with its tests — this plan sets the harness early so they have somewhere to land.

## 2. Decisions applied

**Pinned (DECISIONS.md):** Playwright for E2E. Go backend owns API testing (`httptest` + real Postgres); the OpenAPI spec is the contract (`gen-check` already guards codegen sync per plan 03).

**Topic-local decisions:**

- **E2E environment: ephemeral, in CI, against docker-composed services** (frontend + backend + Postgres + MinIO + Stripe CLI in listen mode), not against staging. *Rationale:* deterministic, parallelizable, no shared-state flake; staging keeps a **smoke** subset only (plan 03's deploy pipeline already polls health + config endpoints — extend with one Playwright smoke spec). *Alternative rejected:* staging-only E2E (slow feedback, data pollution, serial).
- **DB isolation: one Postgres, per-test-run schema-fresh via migrations, per-test truncation.** `TRUNCATE ... CASCADE` between tests over per-test databases — simpler, fast enough at this table count.
- **Contract testing = response validation against the OpenAPI schema** in Go handler tests (middleware asserting responses match `api/openapi.yaml`) — cheaper than a separate contract suite and catches drift the moment a handler diverges from the spec.
- **Component tests only where logic lives** (OrderDialog validation flow, ConfigPanel quantity/lead-time wiring) via vitest-style `bun test` + testing-library; presentational components are covered by E2E incidentally. The 3D viewer stays a **manual checklist item** (WebGL/rAF headless limitation — known, documented in memory).

## 3. Implementation phases

### Phase A — Go integration-test harness

- `backend/internal/httpapi/testutil_test.go` — spin helper: migrate a dedicated test DB (`TEST_DATABASE_URL`), construct the server with real store + fake `Sender`/storage (in-memory MinIO stub or dockerized MinIO), return an `httptest.Server`. Truncate-between-tests helper.
- OpenAPI response-validation middleware for tests (validate every test response against the spec).
- Convert plan 01/02's DB-backed handler tests onto the harness; CI (plan 03) gains the Postgres service container + `api migrate` step.
- **Verify:** `go test ./...` green locally with dockerized Postgres and in CI; a handler returning an undocumented field fails validation.

### Phase B — Payment-path tests (Go)

- Webhook suite against the Phase A harness with stripe-go's test helpers (signed payloads with the test webhook secret):
  - happy path `checkout.session.completed` → `paid` + one `payments` row;
  - **replay** (same event id) → no-op;
  - **out-of-order** (`payment_intent.succeeded` after manual `paid`) → idempotent;
  - **forged signature** → 400, no writes;
  - Fakturownia-down → order paid, invoice absent, `api retry-invoices` completes it (fake Fakturownia server).
- Order-creation suite: draft copies quote prices exactly; missing/`pending` file rejected; acknowledgements required (plan 09's fields).
- **Verify:** the suite fails if the unique constraint on `stripe_event_id` is dropped (mutation check — proves the test bites).

### Phase C — Playwright E2E (golden paths)

- `e2e/` at repo root: docker-compose test stack + Playwright config (Chromium primary; WebKit/Firefox weekly job).
- Specs: **golden path** (upload fixture STL → quote appears < 5 s → configure → order dialog → acknowledgements → Stripe test Checkout (P24 test method included) → confirmation "processing" → webhook (Stripe CLI forward) → confirmation "paid" → admin board shows the order → transition to shipped with tracking → email log rows exist); **MakerWorld path** (mock the Bambu upstream — never hit the real API in CI — paste URL → multi-plate quote); **i18n path** (PL journey asserts Polish strings, EN likewise); **guest status page** (token URL renders; wrong token 404s).
- Test-data seams: `api seed` for config; mailpit or `email_log` polling for email assertions.
- **Verify:** suite green in CI on every merge (plan 03's workflow gains the `e2e` job); a deliberately broken pricing change (edit a Go rate without updating goldens) is caught **before** deploy by the golden suite, and a broken checkout wire is caught by E2E.

### Phase D — Frontend component tests + golden-fixture policy

- Component tests: OrderDialog (validation, acknowledgement gating, B2B fields), ConfigPanel (config changes re-quote), PartsList error states. Happy-dom/jsdom under `bun test`.
- **Golden-fixture lifecycle policy documented** (`backend/internal/pricing/README` note): goldens are frozen artifacts pinning TS-parity; when pricing rules change *intentionally* (plan 14), update engine + unit tests, regenerate affected golden cases by hand or from a trusted state, and record the change in the plan-14 calibration log. The parity suite is **retired only when** a deliberate pricing change makes TS-parity meaningless — until then it guards refactors.
- Mesh-port fixtures (plan 02's `internal/mesh`) join the same pattern.
- **Verify:** component suite green; the golden policy note exists and plan 14 links to it.

## 4. Dependencies

- **Requires:** 03 (CI, service containers, e2e job slot). Grows alongside 01/02/04–07 — each lands its surface's tests on this harness (their `Verify` sections already assume it).
- **Blocks:** nothing, but every Phase-1 topic's "done when" rides on this being ready early. **Build Phase A immediately after plan 01.**
- **Coordinates:** 10 (fuzz targets live in the Go suite), 09 (acknowledgement tests), 08 (i18n E2E spec).

## 5. Verification

- [ ] Golden-path E2E green in CI on every merge; runtime < 10 min.
- [ ] A deliberately broken pricing change is caught before deploy (golden suite red).
- [ ] Webhook replay/out-of-order/forgery suite green; mutation check proves idempotency constraint is load-bearing.
- [ ] Handler responses schema-validated against OpenAPI in every integration test.
- [ ] PL + EN journeys asserted end-to-end.
- [ ] 3D viewer manual checklist documented in the `verify` skill (explicitly not automated).
- [ ] Staging smoke spec runs post-deploy (plan 03 pipeline).

## 6. Risks & open questions

- **E2E flake** is the classic failure mode: Stripe CLI webhook timing and MinIO startup races need generous polling assertions, not sleeps. Budget stabilization time; quarantine-and-fix policy from day one (a flaky suite gets ignored, which is worse than no suite).
- **Compose stack drift vs production:** the test stack must track plan 03's real topology (proxy routing `/api`) or E2E passes while prod 404s — reuse the same compose base file.
- **Golden regeneration discipline:** the TS generator is deleted (recoverable at commit `e3d45ec`-era per `backend/README.md`); hand-editing 1,512 cases is error-prone — plan 14 changes should regenerate programmatically from a trusted engine state, never hand-edit.
- **Mock-vs-real MakerWorld:** CI must mock Bambu (undocumented API, token expiry, external flake); a scheduled weekly *live* canary against the real API (non-blocking) keeps the mock honest — pairs with plan 10's token check.
- **Open:** cross-browser depth — Chromium-only per merge is pragmatic; is weekly WebKit enough given the WebGL-heavy client? Revisit after the first Safari-specific bug.
