# Runbook — Email DNS + support inbox (plan 06, deferred phases 4–5)

> **Status: ⬜ Not started** — blocked on plan 03 (deploy/DNS control) and on
> a registered domain. Everything code-side is done: the Go service sends
> through `LogTransport` (mail is logged, not delivered) until
> `RESEND_API_KEY` is set. This runbook is the flip-to-live checklist.

## Prerequisites

- Domain registered and DNS under our control (plan 03).
- Resend account with an API key.
- Decision on the support inbox provider (e.g. Google Workspace, Fastmail,
  or Resend's inbound routing).

## 1. Resend domain verification (DKIM)

1. Resend dashboard → Domains → Add `<domain>`.
2. Publish the DKIM CNAME records Resend shows (typically
   `resend._domainkey.<domain>`).
3. Verify in the dashboard — status must reach **Verified** before sending.

## 2. SPF

- Add Resend's include to the domain's TXT record:
  `v=spf1 include:amazonses.com ~all` (use the exact include Resend's docs
  show for your region — merge with any existing SPF record; a domain gets
  exactly ONE `v=spf1` TXT).

## 3. DMARC

- Start monitoring: `_dmarc.<domain>` TXT
  `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`.
- After ≥ 2 weeks of clean aggregate reports, tighten to `p=reject`.

## 4. Support inbox (must not clobber sending DNS)

- Provision `support@<domain>` as a real, monitored inbox.
- Inbound MX records belong to the inbox provider; outbound SPF/DKIM above
  belongs to Resend — they coexist, but adding MX records must NOT touch the
  SPF TXT or the DKIM CNAMEs.
- Set the Coolify env so reply-to and the STEP notification point at it:
  `EMAIL_REPLY_TO=support@<domain>`, `EMAIL_SUPPORT=support@<domain>`,
  `VITE_SUPPORT_EMAIL=support@<domain>` (frontend).

## 5. Go live

1. Coolify env (backend app):
   - `RESEND_API_KEY=re_…`
   - `EMAIL_FROM_ORDERS=orders@<domain>`
   - `EMAIL_FROM_AUTH=no-reply@<domain>`
   - `EMAIL_REPLY_TO=support@<domain>`
   - `EMAIL_SUPPORT=support@<domain>`
2. Redeploy. The boot log must NOT show
   `email: RESEND_API_KEY absent — logging mail instead of sending`.

## 6. Deliverability gate (the brief's acceptance)

- Place a test order via `/pl` and `/en`; request a login code.
- For each received message, check Gmail **and** Outlook:
  - headers show `dkim=pass`, `spf=pass`, `dmarc=pass`;
  - lands in **inbox, not spam** (new domains warm up — if spam, keep
    volume low and re-test over days before launch).
- Reply to a received transactional mail → lands in the support inbox.
- `email_log` rows show `status='sent'` with real Resend message ids.
