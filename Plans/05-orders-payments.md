# 05 — Orders, checkout & payments

> **Status: ⬜ Not started** (as of 2026-07-16).

> The quote a customer sees becomes a paid order with a legal Polish invoice.
> Scope contract: ROADMAP.md "### 5. Orders, checkout & payments".
> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`): all transaction surface — order creation, Stripe (stripe-go), webhook, Fakturownia, refunds — lives in `backend/`.

## 1. Context

Today the transaction is fake. The Go intake `POST /api/v1/quotes` (`backend/internal/httpapi/handlers.go`) validates the cart, recomputes prices server-side, logs, and returns a `Q-XXXXXXXX` id — no payment, no invoice. `instant-quote/src/components/OrderDialog.tsx` collects an email + EU country and shows a success screen with that id. `OrderPanel.tsx` renders totals and fires the dialog.

The money math is real and calibrated — and now lives in Go: `backend/internal/pricing` (gross, 23% VAT, 30 zł min order, 1 zł fee, 20 zł shipping free ≥500 zł; golden-fixture-pinned) and `backend/internal/leadtime` (Warsaw-clock ship dates). What is missing is everything between "here is your number" and "you have paid and will get an invoice": persisting the order, taking money, reconciling the payment asynchronously, issuing a faktura VAT, and giving the customer (including a guest) a durable status view.

This topic builds that transaction layer. It is the revenue path and a launch blocker: topic 6 (email) fires off its lifecycle transitions, topic 7 (back-office) drives its state machine.

**Invoice-retention carve-out (scope-mandated):** Polish accounting law requires retaining issued invoices ~5 years from the end of the tax year. This retention must survive any GDPR/RODO erasure — this plan owns the *retention marker* on order/invoice rows; plan 09 owns the erasure policy that reads it; plan 02 owns file-blob lifecycle.

## 2. Decisions applied

**From DECISIONS.md (PINNED):**

- **Payments = Stripe** with **P24 + BLIK** (user-locked). Implemented with **stripe-go** per the amendment.
- **Invoicing = Fakturownia API** (legal faktura VAT, GUS NIP lookup, PL+EN templates) — a Go HTTP client; not Stripe invoices.
- **Money** = gross PLN, **integer grosze**; orders **snapshot the full pricing breakdown** at order time.
- **Schema ownership:** plan 01 owns base tables; this plan **extends `orders` via goose migration** and adds `order_items`, `payments`, `invoices` — never redefines. Rate config referenced via the inherited `pricing_config_id`.
- **All backend surface = Go endpoints, OpenAPI-first** (amendment). The Stripe webhook is a chi handler reading the raw body — natural in Go, no framework fight.
- **Background jobs = Coolify tasks running Go subcommands** (plan 03) — used here for invoice-issue retries and abandoned-draft cleanup.
- **IDs:** public `O-XXXXXXXX` + internal UUID; UUIDs never leave the server.

**Topic-local decisions (resolved here):**

| Decision | Choice | Rationale |
|---|---|---|
| Stripe **Checkout** vs **Elements** | **Stripe Checkout** (hosted redirect) at launch | Keeps the app fully out of PCI SAQ scope, gives P24+BLIK+card with zero payment-UI code, fastest path to a working transaction. Elements deferred (topic 14/backlog) if the redirect hurts conversion. |
| Where the payment intent is created | Go handler creates a **Checkout Session** from a *persisted draft order* — never from client-supplied prices | The client cart is untrusted. The draft order copies **server-authored** prices from plan 01's persisted quote; Stripe gets one line item for the authoritative grosze total. |
| Payment→fulfilment trigger | **Webhook only** (`checkout.session.completed` / `payment_intent.succeeded`), never the browser redirect | The redirect can be lost; the webhook is Stripe's durable signal. The redirect page only *reads* status. Critical for P24/BLIK async settlement. |
| Invoice trigger | **Inside webhook processing**, policy-gated: NIP (B2B) → always; B2C → only if `invoice_requested` | Polish law (faktura on request; B2B always). Decoupled by a retry marker so a Fakturownia outage never blocks marking paid. |
| Currency to Stripe | Integer grosze as `unit_amount`, `currency: "pln"` | Storage unit already is grosze = Stripe's PLN minor unit. No conversion, no float. |

## 3. Implementation phases

### Phase A — Order data model (extends plan 01)

**A1. Goose migration `000XX_orders_commerce.sql`.** Plan 01's base `orders` provides (referenced, never redefined): `id`, `short_id` (`O-…`), `quote_id` (notNull FK), nullable `user_id`, `email`, `status` (text, default `'draft'`), `gross_total_grosze`, `vat_grosze`, `pricing_config_id`, timestamps. This plan adds only the delta:

```sql
ALTER TABLE orders ADD COLUMN
  pricing_snapshot jsonb NOT NULL,        -- full OrderTotals frozen at order time
  prices_ex_vat boolean NOT NULL DEFAULT false,
  country text NOT NULL,                  -- EU country enum value
  company_name text,                      -- nullable = B2C
  nip text,                               -- presence ⇒ B2B ⇒ always invoice
  invoice_requested boolean NOT NULL DEFAULT false,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status_token text NOT NULL,             -- opaque tokenized status page
  retention_until date,                   -- set on invoice issue; blocks GDPR erasure
  paid_at timestamptz;

CREATE TABLE order_items (                -- snapshotted from quote_parts at order time
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  file_name text NOT NULL, file_hash text NOT NULL,
  file_id uuid REFERENCES files(id),
  process text NOT NULL, quantity integer NOT NULL, lead_time text NOT NULL,
  unit_price_grosze integer NOT NULL, line_total_grosze integer NOT NULL,
  part_quote_snapshot jsonb NOT NULL      -- full PartQuote (breakdown, dfmFlags, plates), copied
);

CREATE TABLE payments (                   -- Stripe event ledger, idempotency spine
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  stripe_event_id text UNIQUE,            -- replay protection
  stripe_payment_intent_id text,
  type text NOT NULL,                     -- 'payment' | 'refund'
  amount_grosze integer NOT NULL,
  status text NOT NULL,                   -- 'succeeded' | 'pending' | 'failed'
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  fakturownia_id text, number text, pdf_url text,
  kind text NOT NULL,                     -- 'vat' | 'proforma' | 'correction'
  issued_at timestamptz,
  retention_until date
);
```

> **Snapshot note:** the full per-line breakdown already lives on plan 01's `quotes`/`quote_parts`, but we still copy into `pricing_snapshot` + `order_items` **at order time** — an order must be immutable against later edits/re-pricing of its parent quote or config row.

**A2. Lifecycle state machine.** `backend/internal/orders/status.go` — pure, tested, mirroring the deterministic style of `internal/pricing`:

```
draft ──pay──► paid ──produce──► in_production ──ship──► shipped ──deliver──► delivered
  │               └──refund──► refunded      (any non-terminal) ──cancel──► cancelled
  └──abandon──► (cleanup)
```

`CanTransition(from, to)`, `AssertTransition(from, to)`; every status mutation routes through it. `refunded`/`delivered`/`cancelled` terminal.

**Verify A:** migration clean up on fresh DB; `status_test.go` covers the transition matrix (every legal edge passes; `delivered → paid` throws).

### Phase B — Draft order creation

**B1. `POST /api/v1/orders`** (OpenAPI + `backend/internal/httpapi/orders.go`). Integration shape per plan 01's contract: client persists the quote (`POST /api/v1/quotes` → `Q-…`), then creates the order from it. **The client only ever holds short ids** — the handler takes `quoteShortId` and resolves the UUID server-side.

1. Validate `{ quoteShortId, email, country, companyName?, nip?, invoiceRequested? }` — NIP format check (10-digit + checksum) here; GUS validity is Fakturownia's job.
2. Resolve via `GetQuoteByShortID` → quote + `quote_parts`. **Anti-tamper boundary:** all money is copied from the stored, server-recomputed quote rows (plan 01's Go intake never persisted a client price) — there is no client number to trust.
3. Copy each `quote_parts` row into `order_items` (grosze verbatim + `part_quote_snapshot`), write order-level `pricing_snapshot`.
4. Insert `orders` (status `draft`), inherit `gross_total_grosze`/`vat_grosze`/`pricing_config_id`, mint `O-XXXXXXXX` + random URL-safe `status_token`.
5. Return `{ orderShortId, statusToken }`.

Ordering additionally **gates on stored files**: every part's `file_id` must reference an `uploaded` file (plan 02) — reject otherwise. STEP-backed parts mark the order `manual_verify` (plan 02's recompute boundary).

**B2. Frontend.** `OrderDialog.tsx` gains optional B2B fields (company + NIP, "I need a VAT invoice" checkbox for B2C) and on success proceeds to Phase C checkout (calls the checkout endpoint, redirects to Stripe). The current success screen becomes the post-payment confirmation page (Phase E).

**Verify B:** order created from a persisted quote has `order_items` grosze matching `quote_parts` exactly and `gross_total_grosze` equal to the quote's; a request body carrying doctored prices is structurally ignored (no price fields accepted by the endpoint at all — the OpenAPI schema simply has none).

### Phase C — Stripe integration (stripe-go)

**C1. Checkout session.** `POST /api/v1/orders/{orderShortId}/checkout` — loads the `draft` order (refuse otherwise; return the existing unexpired session if one exists), builds one line item (`unit_amount = gross_total_grosze`, `currency: "pln"`, name "Zamówienie {shortId}"), `payment_method_types: ["card","p24","blik"]`, `success_url` → confirmation page with `statusToken`, `cancel_url` → quote, `client_reference_id = orderShortId`. Persist `stripe_checkout_session_id`; return `{ url }`. Secrets `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` from Coolify env (backend app).

**C2. Webhook.** `POST /api/v1/stripe/webhook` — plain chi handler (registered outside the generated OpenAPI surface if cleaner; it's Stripe's contract, not ours):

```
1. Read raw body + Stripe-Signature header.
2. webhook.ConstructEvent(raw, sig, secret)      // stripe-go; rejects forgeries
3. Idempotency: INSERT payments(stripe_event_id) — unique constraint.
   Conflict → already processed → 200, no-op.
4. Switch event type:
   - checkout.session.completed / payment_intent.succeeded:
       AssertTransition(status, 'paid'); already-paid → no-op 200.
       Set paid_at, payment intent id, status='paid'; record payments row.
       Issue invoice (Phase D) guarded so failure ≠ 5xx.
       Emit lifecycle event → plan 06 (confirmation + receipt email).
   - charge.refunded → Phase E confirmation path.
   - payment_intent.payment_failed → log; order stays draft (customer retries).
5. Return 200 fast once persisted; heavy work must be retry-safe.
```

The unique `payments.stripe_event_id` is the idempotency spine — Stripe *will* redeliver.

**Verify C:** `stripe listen --forward-to localhost:8080/api/v1/stripe/webhook` + test-mode Checkout → `draft → paid` with `paid_at`; replaying the event leaves exactly one `payments` row, no double fulfilment; bad signature → 400, no DB write.

### Phase D — Fakturownia invoice generation

**D1.** `backend/internal/invoicing/fakturownia.go` — `IssueInvoice(ctx, orderID)`:

- Policy gate: NIP present (B2B, always) or `invoice_requested` (B2C opt-in); otherwise skip.
- Map the frozen snapshot → Fakturownia payload: buyer (company + NIP or private person), positions from `order_items` (name, qty, gross unit, 23% VAT), `kind: vat`, PL/EN template per the order's locale (plan 08 persists it). Amounts straight from grosze — no re-pricing.
- HTTP client with `FAKTUROWNIA_API_TOKEN` + `FAKTUROWNIA_DOMAIN`; store `invoices` row.
- **Set `orders.retention_until` + `invoices.retention_until`** = end of issue tax year + 5 years — the plan 09 carve-out marker.
- Mirror the PDF into MinIO (plan 02) so retention doesn't depend on Fakturownia hosting.

**D2. Retry.** Decoupled from paid: `api retry-invoices` subcommand (plan 03's Coolify task, daily/hourly) re-attempts paid, invoice-eligible, un-invoiced orders.

**Verify D:** paid NIP order → faktura with PDF + `retention_until` ≈ +5y; B2C without opt-in → none; Fakturownia forced down at payment → order still `paid`, cron invoices later.

### Phase E — Refund flow, confirmation & status page

**E1. Refund (admin-triggered).** `POST /api/v1/admin/orders/{shortId}/refund` (guarded by plan 04's `RequireAdmin`; UI in plan 07): `AssertTransition(status, 'refunded')`, create the Stripe refund, record a `payments` refund row; the `charge.refunded` webhook **confirms** and flips status (request/confirm split, same webhook-is-truth rule). Issue a Fakturownia **correction invoice** (faktura korygująca) when an original exists; never delete the original (retention).

**E2. Confirmation page** (frontend, `success_url` target): reads the order by `statusToken` via `GET /api/v1/orders/track/{statusToken}`; shows number, snapshot breakdown, ship-date. **Shows "payment processing" until the webhook lands** — never asserts paid from the redirect (P24/BLIK settle async).

**E3. Tokenized public status page.** `instant-quote/src/routes/order.$statusToken.tsx` + the same `GET /orders/track/{statusToken}` endpoint returning a *redacted* view (no internal ids, no raw Stripe objects). Auth = possession of the unguessable token; no login (guest promise).

**Verify E:** admin refund round-trips (refund → webhook → `refunded` → correction invoice, original retained); status URL renders for a guest, 404s on a wrong token.

## 4. Dependencies

**Requires:**
- **01 (persistence)** — base tables + the persisted-quote contract (`GetQuoteByShortID`, server-authored prices). Hard blocker for every phase.
- **02 (file storage)** — `order_items.file_id` gate, invoice PDF mirroring, STEP `manual_verify` seam.
- **04 (auth)** — order attribution to accounts + `RequireAdmin` for refunds. **Guest path needs only 01 + 02.**

**Coordinate:** **09** (erasure reads `retention_until`), **08** (order/invoice locale — persist a `locale` on orders for 06/08; add to the A1 migration: `locale text NOT NULL DEFAULT 'pl'`).

**Unblocks:** **06** (lifecycle transitions are the email triggers), **07** (drives the state machine, calls refund), **launch**.

## 5. Verification (executable checklist)

- [ ] **Test-mode payment → paid order with snapshot** (quote → dialog → Checkout with test card + P24 test flow → webhook → `paid`, snapshot matches quote, `order_items` present).
- [ ] **Snapshot immutability:** flip a pricing value in the Go config after payment; re-read order → unchanged totals.
- [ ] **Price-tamper immunity:** the order endpoint accepts no price fields (OpenAPI schema check) and totals always equal the persisted quote's.
- [ ] **Webhook replay:** `stripe events resend` → one `payments` row, one invoice, one email, status `paid`.
- [ ] **Webhook forgery:** invalid signature → 400, no writes.
- [ ] **Invoice policy:** NIP → faktura + retention date; B2C no-opt-in → none; B2C opt-in → faktura.
- [ ] **Invoice retry:** Fakturownia down at pay time → still `paid`; `api retry-invoices` completes it.
- [ ] **Refund round-trip** incl. correction invoice, original retained.
- [ ] **Guest status page:** token renders live status; wrong token 404s; payload redacted.
- [ ] **State machine:** `status_test.go` green — legal edges pass, illegal throw.
- [ ] **Money integrity:** no float money columns; grosze everywhere; conversion only at the pricing-engine boundary and display.

## 6. Risks & open questions

- **Contracts with plan 01 — RESOLVED (pre-pivot, carried over):** base `orders` shape confirmed; quote persistence owned by 01; `createDraftOrder`-equivalent takes `quoteShortId`, UUIDs server-only. The Go transposition preserves all three.
- **Single Stripe line vs itemization.** One aggregate line keeps our snapshot authoritative (order-level fee/min-order/shipping don't map to per-item lines). The itemized faktura is the legal breakdown; acceptable. Revisit if a Stripe-native itemized receipt is wanted.
- **P24/BLIK async settlement.** Redirect may land before `payment_intent.succeeded` — the confirmation page's "processing" state is mandatory UX, not polish.
- **Correction-invoice payload.** Faktura korygująca semantics against Fakturownia's API are the least-certain integration point — validate in the sandbox early in Phase D.
- **Retention clock.** "~5 years" = end of issue tax year + 5 (Polish practice) — confirm the precise rule with plan 09/accountant before hard-coding.
- **Abandoned drafts.** Never-paid drafts accumulate; an `api abandoned-orders-sweep` (plan 03 runner) should expire them — but never delete rows with a `payments` row. Low priority.
- **Refund vs production.** Full-refund path only; partial refunds/restocking out of scope (topic 15/backlog). Refund does not auto-stop production — manual admin action.
