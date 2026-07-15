# 07 — Back-office admin

## 1. Context

There is no way to run the business. Orders (once plans 01/05 land) would sit in Postgres with no UI to see them; the model files customers pay to have printed (plan 02) have no download path; order statuses can only change via SQL; pricing lives compiled into `backend/internal/pricing/config.go`, so every rate change is a deploy; and STEP manual-quote requests (`step_requests`) land in a table nobody reads.

This topic delivers the operator surface: an orders board driving the plan 05 state machine (each transition firing plan 06 emails), per-order model download, customer lookup with the GDPR hooks plan 09 needs, a DB-backed versioned pricing-config editor, tracking-number entry, a daily ops view built on the lead-time engine's ship dates, and the manual STEP-quote queue.

## 2. Decisions applied

**Pinned (DECISIONS.md incl. amendment):** Go backend owns all admin API surface (`/api/v1/admin/*`, guarded by plan 04's `RequireAdmin`); frontend is TanStack routes; Postgres via plan 01's store; schema extensions via additive goose migrations (plans 04/05/07 extend); jobs = Coolify tasks.

**Topic-local decisions:**

- **In-app admin (`/admin/*` routes in the TanStack app), not a separate app.** One deploy, one design system, shared generated API client. The API guard (`RequireAdmin` middleware on `/api/v1/admin/*`) is the real boundary — the routes are just UI. *Rejected:* separate admin app (second deploy artifact for a one-operator business).
- **Pricing config edit surface = rates and fees only, not formula structure.** The editor produces a new `pricing_config_snapshots` row (never mutates); the Go engine loads the **active snapshot at startup and on change** (see Phase C). Formula changes (new terms, new processes' math) remain code + golden-fixture updates (plan 14's territory).
- **Ops view = "ship today" derived, not stored.** Ship dates recompute from `order_items.lead_time` + `paid_at` via `internal/leadtime` — no denormalized ship-date column to drift.

## 3. Implementation phases

### Phase A — Admin API skeleton + guard wiring

- Extend `backend/api/openapi.yaml` with the `/api/v1/admin/*` group (tagged `admin`, marked security-required); `make gen`.
- `backend/internal/httpapi/admin.go` — chi subrouter mounted with plan 04's `RequireAdmin`.
- Endpoints (first cut): `GET /admin/orders` (filter by status, paginate), `GET /admin/orders/{shortId}` (full detail incl. items, payments, invoices, email log), `POST /admin/orders/{shortId}/transition` `{ to, trackingNumber? }`, `GET /admin/orders/{shortId}/files/{fileId}` (download), `GET /admin/customers?email=`, `GET /admin/step-requests`, `POST /admin/step-requests/{shortId}/close`.
- **Verify:** handler tests — customer session → 403 on every admin route; admin session → 200; `gen-check` green.

### Phase B — Orders board + lifecycle transitions (frontend + wiring)

- Frontend routes `instant-quote/src/routes/admin/index.tsx` (board: columns or filterable table by status, showing shortId, customer email, gross total, ship-by date, flags like `manual_verify`) and `admin/orders.$shortId.tsx` (detail: items with DFM flags, pricing snapshot breakdown, payments/invoice records, email log, action buttons).
- Transition button calls `POST …/transition`; the Go handler routes through plan 05's `AssertTransition`, persists, and fires the matching plan 06 email (`StatusChange`/`Shipped`). Entering a tracking number is the `shipped` transition's required field.
- Refund button calls plan 05's refund endpoint (confirmation dialog; irreversible).
- **Verify:** with seeded test orders, walk `paid → in_production → shipped` (tracking number) `→ delivered` entirely in the UI; each step sends exactly one correctly-localized email to the seed inbox; an illegal transition button is disabled and the API rejects it anyway.

### Phase C — Pricing-config editor (DB-backed, versioned)

- `GET /admin/pricing-config` (active + history), `POST /admin/pricing-config` (new snapshot from an edited copy; flips `is_active` transactionally).
- Editable fields: material rates, machine rates, fees (order fee, extra-plate fee), min order, shipping threshold/price, lead-time multipliers, discount tiers. The JSON schema of editable fields is derived from the Go config struct — reject unknown keys.
- **Engine pickup:** the Go server holds the active config behind an atomic pointer; `POST` swaps it in-process and persists. New quotes price against the new snapshot; existing quotes/orders keep their `pricing_config_id` reference. (Multi-replica note: single replica at launch; if replicas ever exist, a small poll-on-interval fallback covers propagation.)
- Frontend `admin/pricing.tsx` — form over the editable fields, diff-vs-active preview, history list.
- **Verify:** change the PETG rate in the UI → a fresh quote reflects it with **no deploy**; a pre-change order re-read shows original totals; `pricing_config_snapshots` has a new row and exactly one `is_active`.

### Phase D — Customer lookup + GDPR hooks

- `GET /admin/customers?email=` — orders, quotes, files, email log by email (guest orders included — email is the join key).
- Stub endpoints wired for plan 09: `POST /admin/customers/export` (JSON bundle of everything keyed to an email) and `POST /admin/customers/erase` (dry-run mode first: reports what would be deleted vs retained per the `retention_until` carve-out). Plan 09 finishes policy + legal review; the plumbing lands here.
- **Verify:** lookup by a seeded guest email returns their order trail; export produces a complete JSON; erase dry-run correctly lists invoice-bearing rows as retained.

### Phase E — Daily ops view + STEP queue

- `GET /admin/ops/today` — paid orders whose recomputed ship-by date (leadtime engine, `paid_at` as anchor) is today or overdue; surfaced as the admin landing widget ("what must ship today").
- STEP queue UI (`admin/step-requests.tsx`) over the Phase A endpoints — list `new` requests, download the file (plan 02), a "mark quoted / close" action; "send custom quote" is a mailto with prefilled subject at launch (a real custom-quote flow is backlog).
- **Verify:** a paid order with an economy lead time shows the correct ship-by; a STEP request moves new → quoted → closed.

## 4. Dependencies

- **Requires:** 01 (tables/store), 04 (`RequireAdmin` + roles), 05 (state machine, refund, snapshots), 06 (transition emails), 02 (file download). Phase A/C can start once 01+04 exist.
- **Unblocks:** launch (you cannot fulfil orders without it); plan 09's export/erase implementation.
- **Coordinates:** 08 (admin UI may stay EN-only at launch — one-operator tool; decide there), 11 (admin actions worth breadcrumbing), 14 (config editor is the surface its calibration work lands on).

## 5. Verification

- [ ] A test order goes paid → shipped **entirely in the UI**, including model download and tracking-number email.
- [ ] A pricing rate change takes effect for new quotes without a deploy; old orders unaffected; exactly one active snapshot.
- [ ] Non-admin sessions get 403 on every `/api/v1/admin/*` route and the `/admin` UI redirects them.
- [ ] Customer lookup, export JSON, and erase dry-run behave per Phase D.
- [ ] Ops view lists exactly the orders due today/overdue against fixture clock data.
- [ ] STEP queue round-trips; `manual_verify` orders (plan 02's STEP seam) are visibly flagged on the board.
- [ ] `gen-check`, `go test ./...`, frontend typecheck/lint/test all green.

## 6. Risks & open questions

- **Config-struct ↔ editor drift.** The editable-fields schema must be generated or golden-tested against the Go config struct, or the editor silently drops new fields plan 14 adds.
- **In-process config swap vs replicas.** Fine at one replica; document the poll fallback before ever scaling out.
- **Admin i18n scope.** Recommend EN-only admin at launch (operator tool); confirm in plan 08 so its "no hardcoded strings" check can exempt `/admin`.
- **Erase semantics.** Dry-run ships here but real deletion order (files → logs → rows vs anonymization) is plan 09's legal call — don't enable the destructive path until 09 signs off.
- **Open:** order search (by email/shortId) probably wants an index on `orders.email` — add in this plan's migration if lookup is slow on seeded data.
