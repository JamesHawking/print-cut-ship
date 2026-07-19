# 18 — Stripe payments & Fakturownia invoicing

> **Status: ⬜ Not started** (as of 2026-07-19). Blocked on: plan 05 (builds the seams), Stripe account onboarding, Fakturownia account.

> The payment-provider port built in plan 05 gets its real implementation:
> Stripe Checkout for money movement, Fakturownia for legal faktura VAT.
> Split out of plan 05 on 2026-07-19 (see its amendment) so the order flow
> could ship and be exercised end-to-end before the external accounts exist.

## 1. Context

Plan 05 ships orders on a stub provider behind `backend/internal/payments`:

- `Provider` interface: `CreateCheckoutSession(ctx, order) → {ID, URL, ExpiresAt}`, `Refund(ctx, paymentRef, amountGrosze) → refundRef`.
- `ProcessEvent` pipeline — idempotent (unique `payments.provider_event_id`), applies `checkout.session.completed` / `charge.refunded` / `payment_intent.payment_failed` to the order state machine. **This plan does not touch the pipeline** — it only feeds it real Stripe events.
- Stub-only surface to retire in prod: `POST /api/v1/payments/stub/complete` (conditionally registered), `/$locale/pay/$sessionId` fake-checkout page.
- Invoice seam: `invoices` table, `internal/invoicing.ShouldIssue` policy (NIP ⇒ always, B2C ⇒ opt-in), `api retry-invoices` listing eligible orders as a no-op, `retention_until` columns unset.

Business prerequisites (ROADMAP tracker): Stripe account activated with **P24 + BLIK** enabled; Fakturownia account + API token; business entity registered (gates both).

## 2. Scope

### Phase A — Stripe provider (stripe-go)

- `backend/internal/payments/stripe.go` implementing `Provider`:
  - `CreateCheckoutSession`: one line item (`unit_amount = gross_total_grosze`, `currency: "pln"`, name `Zamówienie {shortId}`), `payment_method_types: ["card","p24","blik"]`, `success_url` / `cancel_url` from `PUBLIC_BASE_URL`, `client_reference_id = orderShortId`. Integer grosze = Stripe PLN minor unit — no conversion.
  - `Refund`: `refund.New` against the stored `payment_ref`.
- Webhook: `POST /api/v1/stripe/webhook` — plain chi route (raw body), `webhook.ConstructEvent(raw, sig, STRIPE_WEBHOOK_SECRET)`, then map event type → existing `ProcessEvent`. Signature failure → 400, no DB write. Registered regardless of provider (harmless without secrets? — no: register only when `PAYMENTS_PROVIDER=stripe`, matching the stub's conditional pattern).
- Env/config: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ `.env.example` placeholders same commit); `PAYMENTS_PROVIDER=stripe` fails fast at boot when keys are missing. `stripe` never in the repo — Coolify env only.
- Retire the stub in prod: decide at implementation time whether `stub` remains selectable outside dev (default: keep for CI/E2E, log a loud warning when selected).

**Verify A:** `stripe listen --forward-to` + test-mode Checkout (card *and* P24 test flow) → `draft → paid` with `paid_at`; `stripe events resend` replay → exactly one `payments` row, no double fulfilment; forged signature → 400, no writes; refund from the admin endpoint round-trips via the real `charge.refunded` webhook.

### Phase B — Fakturownia client

- `backend/internal/invoicing/fakturownia.go`: `IssueInvoice(ctx, orderID)` behind the existing policy gate — buyer (company+NIP+address for B2B, private person otherwise), positions from `order_items` (gross unit grosze, 23% VAT), `kind: vat`, PL/EN template from `orders.locale`. `FAKTUROWNIA_API_TOKEN` + `FAKTUROWNIA_DOMAIN` env (+ `.env.example`).
- On issue: store `invoices` row; set `orders.retention_until` + `invoices.retention_until` = end of issue tax year + 5 years (confirm exact rule with accountant / plan 09 before hard-coding); mirror the PDF into MinIO so retention doesn't depend on Fakturownia hosting.
- Wire issuance into the paid transition (inside `ProcessEvent`, guarded so a Fakturownia outage never fails the webhook — the retry marker is the `invoices`-row absence); activate `api retry-invoices` to actually re-attempt (Coolify scheduled task per plan 03).
- Refund → **faktura korygująca** (correction invoice) when an original exists; never delete the original (retention). Validate correction semantics in the Fakturownia sandbox first — least-certain integration point (carried over from 05 §6).

**Verify B:** paid NIP order → faktura + PDF in MinIO + retention ≈ +5y; B2C without opt-in → none; Fakturownia forced down at pay time → order still `paid`, `api retry-invoices` completes it later; refund → correction invoice, original retained.

## 3. Out of scope (stays as built in 05)

Order model/state machine, checkout endpoint semantics (session reuse), the event pipeline and its idempotency, confirmation/status pages, the admin refund endpoint contract. Elements/embedded checkout (redirect is the launch UX; revisit only if conversion data says so — plan 14/backlog). Partial refunds.

## 4. Dependencies

**Requires:** 05 (all seams), Stripe account with P24+BLIK, Fakturownia account. **Coordinate:** 06 (confirmation/receipt emails fire off the same transitions — test with real events), 09 (erasure reads `retention_until`), 10 (webhook endpoint is public surface — rate-limit/alert), 03 (Coolify env + scheduled task for retry-invoices). **Unblocks:** launch (real money), 12 (E2E against Stripe test mode).

## 5. Verification (carried over from 05 §5 — the items needing real Stripe/Fakturownia)

- [ ] Test-mode payment (card + P24) → `paid` order, snapshot matches quote.
- [ ] Webhook replay → one `payments` row, one invoice, no double fulfilment.
- [ ] Webhook forgery → 400, no writes.
- [ ] Invoice policy: NIP ⇒ faktura + retention; B2C no-opt-in ⇒ none; opt-in ⇒ faktura.
- [ ] Invoice retry after Fakturownia outage.
- [ ] Refund round-trip incl. correction invoice, original retained.
- [ ] `PAYMENTS_PROVIDER=stripe` with missing keys → boot fails fast; stub unreachable in prod config.
