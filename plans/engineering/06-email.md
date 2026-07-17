# Plan 06 — Transactional email (+ customer support channel)

> **Status: ⬜ Not started** (as of 2026-07-16).

> Reconciled 2026-07-15 to the Go-canonical backend (see amendment in `DECISIONS.md`): all sending happens from the Go service. Templates are authored with React Email but **pre-rendered to Go-templated HTML at build time** — see the topic-local decision below (the DECISIONS.md email row's "React Email" phrasing is amended accordingly).

## 1. Context

The shop currently cannot talk to its customers. The Go intake endpoints (`POST /api/v1/quotes`, `/step-quotes`) log and return an ID; nothing is emailed. The order-success copy already lies — `strings.order.successBody` says *"We emailed a confirmation"* (`instant-quote/src/lib/strings.ts`) but no mail is ever sent. There is no provider, no templates, no record of what was sent to whom, and no way for a customer to reach a human about an order.

This topic makes the shop send the mail every commerce and auth flow implies:

- **Order confirmation** (order placed / awaiting payment)
- **Payment receipt** (fired from plan 05's Stripe webhook)
- **Status change** (in-production, delayed, cancelled/refunded — plan 07 admin transitions)
- **Shipped with tracking** (tracking number entered in admin)
- **Auth verification & password reset** (consumed by plan 04's Go auth via its `Sender` port)

Plus the support scope: a **monitored support inbox** (`support@<domain>`) set as `reply-to` on every transactional message, and a **contact point on the site**. Without a reply-to a human reads, transactional mail is a dead-end and replies to `noreply@` bounce silently.

## 2. Decisions applied

**From DECISIONS.md (PINNED):**

- **Email = Resend** (managed deliverability). Per the amendment, sending happens **from Go** — the official `resend-go` SDK (thin HTTP client).
- **i18n = typed two-locale dictionary; `/pl` default + `/en`.** Email copy is i18n surface shared with plan 08; each send takes an explicit locale.
- **Schema ownership:** plan 01 owns base tables; this plan adds `email_log` via its own goose migration.
- **Background jobs = Coolify tasks running Go subcommands** (plan 03) — abandoned-quote follow-up, if enabled, is a subcommand calling this plan's send function.
- **Secrets:** `RESEND_API_KEY` + addresses in Coolify env (backend app); nothing in the repo.

**Topic-local decisions (resolved here):**

- **Template strategy: React Email authoring → build-time pre-render → Go `html/template` execution.** Templates are authored as React Email components (`instant-quote/src/emails/`) for the component ergonomics and local preview, then a build script (`bun run emails:build`) renders each template × locale to HTML files **containing Go-template placeholders** (`{{.OrderShortID}}`, `{{.GrossTotal}}`, `{{range .Items}}…`), committed under `backend/internal/email/templates/`. Go embeds them (`embed.FS`) and interpolates at send time. *Rationale:* zero runtime Node dependency in the backend (the distroless image stays a static binary), React tooling kept for design/preview, and a CI `gen-check`-style diff guard keeps the rendered artifacts in sync. *Alternatives rejected:* runtime `@react-email/render` (needs Node in or beside the backend container), a Node render sidecar (a whole extra deploy unit for six templates), pure Go templates (loses the authoring/preview toolchain and design-system reuse).
- **From/reply-to convention:** order mail from `orders@<domain>`, auth mail from `no-reply@<domain>`, **every** message `reply-to: support@<domain>` — a customer hitting "reply" on any mail reaches a monitored human inbox.
- **Locale selection:** every send takes `locale: 'pl' | 'en'`. Order mail uses `orders.locale` (plan 05's migration persists it from the path locale at order time); auth mail uses the user's locale (plan 04 — **flagged**: add a `locale` column in plan 04's migration or default from the request path); fallback `pl`.
- **Idempotency:** every send passes a `dedupeKey` (e.g. `payment_receipt:<orderId>`); the Go send wrapper checks `email_log` for a prior success before sending, so a Stripe webhook replay cannot double-send. Email-layer complement to plan 05's `stripe_event_id` spine.
- **Failure handling:** a failed send logs `status='failed'` + provider error and never propagates into the caller's transaction — an order must not roll back because mail bounced. Alerting on failures is plan 11's job.
- **Contact point:** launch with `mailto:support@<domain>` in the footer + a `/kontakt` · `/contact` page (response-time expectation stated). A hosted contact form is deferred post-launch — mailto satisfies "reachable human" without new spam surface.

## 3. Implementation phases

### Phase 1 — Go send wrapper + Resend client

- `backend/internal/email/resend.go` — `ResendSender` implementing plan 04's `Sender` interface via `resend-go`; no-op-with-warning when `RESEND_API_KEY` is absent (local dev degradation, same pattern as the MakerWorld token).
- `backend/internal/email/send.go` — `SendTransactional(ctx, {To, Template, Locale, DedupeKey, Data})`: (a) check `email_log` for prior success on `DedupeKey`, (b) execute the embedded template for the locale, (c) send with from/reply-to from env (`EMAIL_FROM_ORDERS`, `EMAIL_FROM_AUTH`, `EMAIL_REPLY_TO`), (d) write an `email_log` row (`sent`/`failed`, Resend message id), (e) swallow + log errors.
- **Verify:** a Go test (Resend test key or mocked transport) sends a stub template; `email_log` row appears; second call with the same `DedupeKey` is skipped.

### Phase 2 — `email_log` table (goose migration)

```sql
CREATE TABLE email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text UNIQUE,
  to_addr text NOT NULL,
  template text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL,                -- 'sent' | 'failed'
  provider_message_id text,
  error text,
  order_id uuid REFERENCES orders(id), -- nullable: auth mail predates orders
  user_id uuid REFERENCES users(id),   -- nullable: STEP requests have neither
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON email_log (to_addr);   -- support lookup
CREATE INDEX ON email_log (order_id);
```

**Verify:** migration clean locally + in CI; sqlc round-trip from a handler test.

### Phase 3 — Template set (PL + EN, authored in React Email, shipped as Go templates)

- Add the `emails.*` namespace to plan 08's dictionary (subjects, bodies, CTAs, support-footer line — `pl` + `en`); on-site copy in `strings.order`/`strings.step` and email copy stay consistent by sharing it.
- Shared layout `instant-quote/src/emails/_layout.tsx` — wordmark, PLN/VAT footer, support line; visual language consistent with the site.
- Templates: `OrderConfirmation`, `PaymentReceipt` (invoice link from plan 05's Fakturownia PDF URL), `StatusChange` (parameterized by status), `Shipped` (carrier + tracking URL), `AuthVerify`, `AuthReset`.
- `instant-quote/scripts/build-emails.ts` — renders each template × locale with Go placeholders into `backend/internal/email/templates/<name>.<locale>.html`; a typed template registry in Go (`templates.go`) makes `SendTransactional`'s `Template` arg a closed enum.
- CI guard (plan 03's workflow): re-run `emails:build`, fail on diff — rendered artifacts can't drift from their React sources.
- **Verify:** React Email local preview (`email dev`) eyeballed in both locales; Go-side golden tests execute each embedded template with fixture data and assert locale strings + reply-to/support line present.

### Phase 4 — Domain authentication (SPF / DKIM / DMARC)

- Consumes the external prerequisites (Resend account, domain) + plan 03's DNS control. Checklist doc (`plans/engineering/runbooks/email-dns.md` or backend README): Resend DKIM CNAMEs, SPF include, DMARC `p=quarantine` → `p=reject` after monitoring.
- **Verify:** test message to Gmail + Outlook shows `dkim=pass`, `spf=pass`, `dmarc=pass`, lands in **inbox, not spam** (the brief's deliverability gate).

### Phase 5 — Support inbox + reply-to + site contact point

- Provision `support@<domain>` as a real monitored inbox (business task; MX coordinated with plan 03 — inbound MX and outbound SPF/DKIM must not clobber each other).
- `EMAIL_REPLY_TO=support@<domain>` stamped by the Phase 1 wrapper (structural); this phase confirms the address is live and monitored.
- Frontend contact point: `/kontakt` · `/contact` route (locale-prefixed per plan 08) + footer link; `mailto:` at launch.
- **Verify:** replying to a received transactional mail lands in the support inbox; contact page renders in both locales.

### Phase 6 — Wire the triggers

- **Order confirmation:** plan 05's order-creation handler (`POST /api/v1/orders`) → `SendTransactional(OrderConfirmation, dedupe "order_confirmation:<orderId>")`.
- **Payment receipt / refund:** plan 05's Stripe webhook → `PaymentReceipt` / `StatusChange(refunded)`.
- **Admin transitions:** plan 07's lifecycle endpoints → matching `StatusChange`/`Shipped` (tracking number passed through).
- **STEP manual path:** `POST /api/v1/step-quotes` → customer acknowledgement + support-inbox notification (feeds plan 07's queue).
- **Auth:** plan 04's flows already call the `Sender` port — swap `ConsoleSender` for `ResendSender` + real `AuthVerify`/`AuthReset` templates.
- **Verify:** drive each trigger against a seed inbox (§5); one message per event even on webhook replay.

## 4. Dependencies

- **01 (persistence):** `email_log` extends the schema; order/user UUIDs are FK targets.
- **03 (deploy/CI + domain):** DNS for SPF/DKIM/DMARC + support MX; env vars in Coolify; job runner for abandoned-quote sends; CI runs the migration, template golden tests, and the `emails:build` diff guard.
- **08 (i18n):** shared `emails.*` dictionary namespace + locale plumbing (08 owns the mechanism; this plan owns email copy).
- **11 (observability):** failed-send rows are alerting input.
- **Consumed by 04** (auth mail), **05** (confirmation/receipt/refund), **07** (status/shipped).
- **Blocks launch.**

## 5. Verification — executable checklist

Against a seed inbox on staging:

- [ ] Order placed via `/pl` → **Polish** confirmation; via `/en` → English.
- [ ] Test-mode payment → **receipt** with invoice link, order's locale.
- [ ] Webhook replay → **no second receipt** (`email_log` shows one `sent`).
- [ ] Admin → in-production / cancelled → correct **status-change** variant.
- [ ] Tracking number entered → **shipped** mail with working tracking URL.
- [ ] Refund → refund status mail.
- [ ] Register (PL) → Polish **verification** mail, link works; reset flow same in user's locale.
- [ ] STEP request → customer acknowledgement **and** support notification.
- [ ] Every mail has `reply-to: support@…`; replying reaches the monitored inbox.
- [ ] Gmail + Outlook: dkim/spf/dmarc pass, inbox not spam.
- [ ] Every send writes an `email_log` row; forced provider error → `failed` row, order unaffected.
- [ ] Go template golden tests green for all 6 templates × 2 locales; `emails:build` diff guard green in CI.

## 6. Risks & open questions

- **Pre-render pipeline drift.** The React-source → Go-template artifact chain is this plan's novel machinery; the CI diff guard is what makes it safe. Keep placeholders trivially simple (no logic in React that Go must mirror — loops/conditionals live on the Go side).
- **Domain warm-up:** new sending domains land in spam initially. Ship Phase 4 early; DMARC `quarantine` → `reject` after monitoring.
- **Locale source of truth:** relies on `orders.locale` (plan 05 ✓, added in its migration) and a user locale (plan 04 — **open flag**: add the column or derive from request path at send time).
- **Support MX vs Resend sending:** separate DNS concerns on one domain; owned jointly with plan 03.
- **Abandoned-quote email:** send function ships here; trigger is plan 03's `api abandoned-quote-sweep`. Open: launch-set inclusion + consent posture (plan 09).
- **Attachments:** receipt links to the Fakturownia PDF rather than attaching. Confirm plan 05 exposes a stable, access-controlled invoice URL (the tokenized status page is the natural host).
- **Contact form vs mailto:** launching with mailto; revisit if support volume or spam argues for a form.
