# Production Readiness Roadmap — Instant Quote

**Scope decisions (locked 2026-07-15):**

- **Launch target:** full self-service e-commerce (quote → pay → track order online)
- **Hosting:** self-hosted on Coolify (Postgres, S3-compatible storage, and app all as Coolify resources)
- **Languages:** Polish + English at launch
- **Back-office:** fuller admin (orders, model downloads, statuses, pricing config, customers)
- **Backend: Go is canonical (added later on 2026-07-15, user-locked).** A dedicated Go service at `backend/` (chi + OpenAPI-first codegen) owns all API surface; TanStack Start is frontend-only. Already shipped: pricing engine (exact-parity golden tests vs the retired TS engine), ship dates, quote/step-quote intake, MakerWorld proxy, `/api/v1/config` catalog. Topics 1, 3, 4, 5, 6, 10 plan against Go — see the amendment in [DECISIONS.md](DECISIONS.md); the "server functions" and Drizzle/better-auth references in the briefs below predate this pivot.

**Plan index** — every topic has an implementation plan in this folder (stack decisions pinned in [DECISIONS.md](DECISIONS.md)):
[01 Persistence](01-persistence.md) · [02 File storage](02-file-storage.md) · [03 Deploy/CI](03-deploy-ci.md) · [04 Auth](04-auth.md) · [05 Orders & payments](05-orders-payments.md) · [06 Email](06-email.md) · [07 Admin](07-admin.md) · [08 i18n](08-i18n.md) · [09 Legal/GDPR](09-legal-gdpr.md) · [10 Security](10-security.md) · [11 Observability](11-observability.md) · [12 Testing](12-testing.md) · [13 SEO & content](13-seo-content.md) · [14 Pricing engine](14-pricing-engine.md) · [15 Shipping](15-shipping.md) · [16 Feature backlog](16-feature-backlog.md) · [17 OKF bundle](17-okf-bundle.md) · [18 Stripe payments](18-stripe-payments.md)

**Implementation status (2026-07-20):** each plan carries a `> **Status:**` banner under its title — that banner is the source of truth; update it when a plan's state changes and mirror the change here. Current: ✅ **01 Persistence** done (committed `e6667b6`, code-reviewed with top-3 findings fixed, verification checklist passed locally; 7 lower-severity review findings still open; two checklist items deferred to plan 03 as written). ✅ **02 File storage** done with notes (2026-07-17) — storage/upload/tee/retention plus the deferred server-side geometry recompute (`internal/mesh` Go port wired into `POST /quotes`; tolerance-based authoritative, not bit-exact — see the plan's status banner). ✅ **08 i18n** done. ✅ **04 Auth** done (2026-07-19 — amended 2026-07-18 to passwordless OTP: email + 6-digit code → Postgres session cookie; codes console-logged until plan 06, which stays the launch gate). ✅ **05 Orders & payments** done (2026-07-19, reviewed and merged `abd9889` — amended 2026-07-19: full order flow on a Stripe-shaped provider port with a stub provider + fake checkout, invoice seam only; review fix: payment ledger commits even when the transition is refused; real Stripe + Fakturownia live in the new plan 18, blocked on the external accounts). ✅ **07 Back-office admin** done (2026-07-19, on `backend/admin` pending review + merge — orders board driving the plan-05 state machine with a path-prefix admin guard, per-order model download, DB-backed versioned pricing editor with live swap (bootstrap now DB-wins), customer lookup + GDPR export/erase dry-run, daily ops view, STEP queue; transition emails deferred to plan 06 via a notify seam). 🟨 **06 Transactional email** code done (2026-07-20 — Resend transport with LogTransport fallback, 7 templates × PL/EN pre-rendered to Go templates, all triggers wired, `email_log` dedupe, `/kontakt · /contact` page; DNS/DKIM + support inbox deferred to `plans/engineering/runbooks/email-dns.md`, abandoned-quote email deferred entirely). 🟨 **13 SEO & content** phases 1–2 largely pre-built. ⬜ **03, 09–12, 14–18** not started — with committed groundwork noted in 03 (production Dockerfile, compose Postgres) and 12 (Go golden-fixture + handler suites, frontend unit suite); 17 (OKF bundle) is decision-recorded 2026-07-18, execution deferred; 18 (Stripe + Fakturownia) holds the deferred integrations and is blocked on the external accounts. A plan is **done** only when its own §Verification checklist is ticked, the work is committed, and it has been code-reviewed.

**How to use this document:** each numbered topic below is a self-contained brief meant to be handed off to a separate planning session before implementation. Every brief states the goal, what exists today, what's in scope, the key decisions the planning session must resolve, dependencies on other topics, and what "done" means. Topics are grouped into phases by dependency order, but briefs within a phase can be planned in parallel.

**Current state in one paragraph:** the app is a working quoting product on the quote path and a prototype everywhere else — upload STL/OBJ/3MF/STEP (or paste a MakerWorld URL), get a calibrated price with DFM checks, 3D preview, lead times, and multi-plate packing on the Bambu H2S envelope. Quotes and step-requests persist to Postgres (plan 01); files upload on drop to MinIO with a MakerWorld tee, a retention sweep, and server-side geometry recompute in Go at quote submit so the price rides on stored bytes (plan 02); quotes can be read back via `GET /api/v1/quotes/{id}` (pricing-only). All copy runs through full PL+EN `src/lib/i18n` dictionaries (`strings.ts` is gone); SEO/content pages and the MDX blog shipped (plan 13 phases 1–2); a prototype login/orders flow exists (simulated OTP, unauthenticated `/orders` endpoint — real auth lands in plans 04/05). Still missing: CI/deploy, payments, email, and admin.

---

## Phase 0 — Foundations

Everything else depends on these three. Nothing here is user-visible.

### 1. Persistence layer (database + ORM)

**Goal:** a Postgres database with a schema and data-access layer that all later topics (users, orders, payments, admin) build on.

**Today:** no database, no ORM, nothing in `.env` but `BAMBU_CLOUD_TOKEN`. All state is in-memory React (`PartsProvider` reducer); a page refresh loses everything.

**In scope:** Postgres provisioned on Coolify; ORM/query-layer choice (Drizzle vs Prisma — evaluate against Bun runtime + TanStack Start server functions); migration tooling and workflow; initial schema skeleton for the entities other topics will extend (users, quotes, orders, files, pricing-config snapshots); local dev story (docker-compose or Coolify dev DB); seed script.

**Key decisions:** ORM choice; whether quotes are persisted for anonymous visitors (recommended — enables quote links, abandoned-quote follow-up, and analytics) or only at order time; ID scheme (the prototype already generates `Q-XXXXXXXX` / `STEP-XXXXXXXX` public IDs — keep public short IDs + internal UUIDs).

**Depends on:** nothing. **Blocks:** nearly everything (3, 4, 5, 6, 7, 8).

**Done when:** migrations run in CI and on Coolify, a server function can round-trip a record, and the dev-setup is documented in README.

### 2. File storage for uploaded models

**Goal:** customer-uploaded model files survive beyond the browser session, because production and admin both need the actual geometry.

**Today:** files are parsed client-side (web worker; STEP via 10 MB WASM) and never leave the browser except MakerWorld downloads, which stream through a server function and are discarded. The Hero literally promises "Private — files never leave your session" — that copy must change when this ships (coordinate with topics 9 and 13).

**In scope:** S3-compatible storage (MinIO on Coolify, or an external S3/R2 bucket — decide with the backup story in mind); upload path from browser to storage (presigned URLs vs through-server; 100 MB max is already enforced); linking stored files to quote/order records; retention policy (e.g. delete unordered uploads after N days, keep ordered files for M months — feeds GDPR topic); server-side re-validation of uploaded files (client-computed volume/weight cannot be trusted for money — see topic 12).

**Key decisions:** MinIO-on-Coolify vs managed object storage; whether pricing-relevant mesh metrics get recomputed server-side at order time (recommended) or client metrics are trusted with sanity bounds.

**Depends on:** 1 (file metadata rows). **Blocks:** 4 (orders reference files), 7 (admin downloads models).

**Done when:** an uploaded file is retrievable by an admin after browser close, retention deletion runs on schedule, and a tampered client price is caught by server-side recomputation.

### 3. Deployment, CI/CD, and environments

**Goal:** the app ships to Coolify automatically from `main`, with a staging environment, and secrets managed properly.

**Today:** no Dockerfile, no `.github`, no CI of any kind. Build output is a Nitro `node-server` bundle (nitro 3.0.1 pre-release — verify Bun-vs-Node runtime choice for production). Only env var is `BAMBU_CLOUD_TOKEN` in a local `.env`.

**In scope:** Dockerfile (decide Bun runtime vs Node for the Nitro server); Coolify application + Postgres + storage resources wired together; GitHub Actions running typecheck + lint + tests + build on PR, deploy on merge; staging environment with its own DB; secrets in Coolify env config (never in repo); database backup schedule (Coolify supports scheduled Postgres backups — configure and test a restore); domain + TLS; health-check endpoint; background-job/scheduled-task infrastructure — this topic owns the runner (Coolify scheduled tasks at launch; a BullMQ-on-Redis queue only if a real need emerges) that other topics' jobs plug into: file-retention deletion (2), abandoned-quote emails (1/6), Bambu token-expiry checks (10).

**Key decisions:** Bun vs Node in the production container; single server vs separate staging server; backup destination (must be off-server).

**Depends on:** nothing (can start immediately; DB wiring lands when topic 1 does). **Blocks:** everything reaching real users.

**Done when:** a merged PR reaches staging automatically, promotion to production is one action, a DB restore has been rehearsed, and CI blocks merges on red tests.

---

## Phase 1 — Commerce core

The revenue path: register → order → pay → get emails. Topics 4–6 are the critical chain; 7–8 complete it.

### 4. User accounts & authentication

**Goal:** customers can register, sign in, and see their orders; guests can still order without an account (the product's core promise is "no friction to the number" — never gate quoting behind login).

**Today:** nothing. `submitQuote` collects a bare email.

**In scope:** auth library choice (better-auth, Lucia-style hand-rolled, or Auth.js — evaluate TanStack Start compatibility); email+password with verification and reset; session management; guest checkout that creates an order tied to an email, claimable later by registering with that email; account page (profile, order history); admin role flag (consumed by topic 7). B2B fields (company name, NIP/VAT-ID) on the account or per-order — needed for Polish invoicing (topic 5).

**Key decisions:** auth library; social login at launch (recommend: defer, email-only first); where the login UI lives given quoting must stay anonymous.

**Depends on:** 1. **Blocks:** 7 (admin auth), parts of 5 (attributing payments).

**Done when:** register/verify/login/reset all work e2e, a guest order can be claimed, and sessions survive deploys.

### 5. Orders, checkout & payments

**Goal:** the quote a customer sees becomes a paid order with a legal Polish invoice.

**Today:** `submitQuote` console-logs and returns a fake ID. Pricing is calibrated (gross, 23% VAT, 30 zł minimum, 20 zł shipping free ≥500 zł, EU country enum with 25 countries) — the money math exists; the transaction doesn't.

**In scope:** order data model (order ↔ parts ↔ files ↔ pricing snapshot — snapshot the full breakdown at order time so later pricing-config changes never mutate past orders); order lifecycle states (draft → paid → in-production → shipped → delivered → cancelled/refunded); PSP integration — for the Polish market evaluate **Stripe** (best DX, supports P24+BLIK as payment methods) vs **Przelewy24/PayU direct** (local standard, lower fees, worse DX); webhook handling with idempotency; VAT invoicing — Polish law requires faktura VAT on request, B2B always; evaluate invoice API (Fakturownia, wFirma, inFakt) vs PSP-generated invoices; refund/cancellation flow (admin-triggered); order confirmation page + status page (public link with token, so guests can track); invoice retention — Polish accounting law requires keeping invoices ~5 years, which must be carved out of any GDPR deletion flow (coordinate with topics 2 and 9).

**Key decisions:** PSP choice (this is the biggest external decision in the roadmap — recommend Stripe with P24/BLIK enabled unless fees at expected volume argue otherwise); invoicing provider; whether card data ever implies SAQ scope (use hosted checkout/elements — keep the app out of PCI scope).

**Depends on:** 1, 2, 4 (guest path only needs 1+2). **Blocks:** 6, 7, launch.

**Done when:** a real test-mode payment produces a paid order with a stored pricing snapshot, a webhook replay doesn't double-fulfil, an invoice PDF is generated for a NIP-bearing order, and a refund round-trips.

### 6. Transactional email

**Goal:** the shop talks to customers: order confirmation, payment receipt, status changes, shipping notification with tracking, plus auth emails (verification, reset).

**Today:** nothing. No provider, no templates.

**In scope:** provider choice (Resend/Postmark/SES — self-hosting SMTP on Coolify is possible but deliverability makes it a bad idea; recommend managed); domain auth (SPF/DKIM/DMARC); template system with PL+EN variants (coordinate with topic 8 — email copy is i18n surface); sending from server functions + webhook handlers; email log table (what was sent to whom, for support and GDPR); customer support channel — a monitored support inbox (e.g. support@domain) set as reply-to on all transactional mail, plus a contact point on the site (mailto/contact form), so customers can reach a human about an order.

**Key decisions:** provider; template tech (React Email fits the stack).

**Depends on:** 1, 3 (domain), consumed by 4 and 5. **Blocks:** launch.

**Done when:** every lifecycle transition in topic 5 and every auth flow in topic 4 sends the right email in the right language, verified against a seed inbox, and mail lands in inbox not spam.

### 7. Back-office admin

**Goal:** you can run the business from a browser: see orders, download the models to print, move statuses, adjust pricing, look up customers.

**Today:** nothing. Pricing lives in `src/lib/pricing-config.ts` as compiled-in constants.

**In scope:** admin area (protected by role from topic 4) — decide route-in-app (`/admin/*`) vs separate app (recommend in-app; one deploy, shared types); orders board with lifecycle transitions (each transition fires topic-6 emails); model file download per order; customer lookup (orders by email, GDPR export/delete hooks for topic 9); pricing-config editor — move `PRICING` constants to a DB-backed, versioned config so price changes don't require deploys, while orders keep their snapshots; shipping: enter tracking number → triggers shipped email; daily ops view (what must ship today, given the lead-time engine already computes ship dates); manual quote handling for STEP fallback (`requestStepQuote` queue with a "send custom quote" action).

**Key decisions:** in-app vs separate admin; how much of pricing config is editable vs code (rates and fees yes; formula structure no).

**Depends on:** 1, 2, 4, 5, 6. **Blocks:** launch (you can't fulfil orders without it).

**Done when:** a test order can be taken from paid → shipped entirely in the UI, including model download and tracking-number email, and a pricing rate change takes effect for new quotes without a deploy.

### 8. Internationalization (PL + EN)

**Goal:** the entire customer surface — app, emails, invoices, legal pages — works in Polish and English.

**Today:** all copy is English-only, but it's already centralized in `src/lib/strings.ts`, which makes this much cheaper than usual. Formatting helpers (`formatPln` etc.) exist but locale-awareness needs checking.

**In scope:** i18n approach (given strings are centralized, a typed two-locale dictionary may beat a full framework like i18next — planning session should compare); locale routing/detection (path prefix `/pl` vs `/en` recommended for SEO, with `hreflang`); translating all strings including DFM warnings, error messages, and email templates; number/date/currency formatting per locale (prices stay PLN in both); language switcher; making Zod validation errors user-facing in both languages.

**Key decisions:** dictionary vs framework; URL strategy; default locale (recommend PL default given .pl market, EN for the Germany-facing positioning).

**Depends on:** nothing hard (start any time; touches everything, so earlier is cheaper). **Blocks:** launch, 9 (legal pages need both languages).

**Done when:** a Polish user completes quote → payment → emails entirely in Polish, an English user entirely in English, and no hardcoded string remains outside the dictionary.

---

## Phase 2 — Launch gates

Legal and security are not optional polish — they gate accepting the first real order.

### 9. Legal & GDPR/RODO compliance

**Goal:** the shop is legal to operate in Poland/EU: required documents, consumer rights, and data protection.

**Today:** nothing — no privacy policy, no terms, no cookie consent, no company info anywhere. The footer has no legal links.

**In scope:** Terms of Service (regulamin sklepu — Polish e-commerce has specific required elements); Privacy Policy (RODO-compliant: lawful bases, retention periods — must match topic 2's file retention, processor list: Coolify server host, PSP, email provider, Bambu Cloud); consumer withdrawal rights — critical nuance: custom-manufactured goods are exempt from the 14-day EU withdrawal right (Art. 38 Consumer Rights Directive), but the exemption must be explicitly stated and acknowledged at checkout; statutory complaint handling (rękojmia/reklamacje) — the withdrawal exemption does NOT remove liability for defective goods; the regulamin must define the complaint process (how to file, the 14-day response obligation, repair/replacement/refund remedies); retention periods in the privacy policy must also carve out the ~5-year invoice-retention obligation from topic 5; cookie consent (may be minimal if analytics choice in topic 11 is cookieless); company details block (footer + terms: entity name, NIP, REGON, address); data-subject rights implementation (export + delete, hooked into topic 7's admin); DPA review of each processor. **Draft documents with a lawyer or vetted Polish template service — do not ship AI-drafted legal text.**

**Key decisions:** business entity to operate under; whether to use a Polish regulamin template service (e.g. legal-geek-style generators) vs custom lawyer work.

**Depends on:** 8 (both languages), decisions from 2, 5, 11 (what data/processors exist to disclose). **Blocks:** launch absolutely.

**Done when:** all documents live in both languages, checkout collects the required acknowledgements (terms + withdrawal-exemption), and a data-deletion request can actually be executed.

### 10. Security hardening

**Goal:** the app can face the internet with real money and real personal data behind it.

**Today:** no rate limiting, no CORS policy, no CSP or any security headers, secrets in a local `.env`, and the MakerWorld integration holds a Bambu bearer token that expires (~90 days) and calls undocumented APIs.

**In scope:** rate limiting on all server functions (especially `fetchMakerworldModel` — it's an SSRF-adjacent proxy that downloads 100 MB files on request, and `submitQuote`); security headers (CSP — note the WASM + web-worker + WebGL surface needs careful `script-src`/`worker-src`; HSTS, frame-ancestors, etc.); server-side input re-validation (never trust client-computed prices — overlap with topic 2, decide owner); upload content validation (magic bytes, zip-bomb guard for 3MF — it's a ZIP; parser fuzz-resilience); secrets management in Coolify + rotation runbook; Bambu token expiry monitoring + refresh procedure (feature degrades gracefully when token dies); auth hardening once topic 4 lands (login throttling, session fixation, password policy); dependency audit in CI; basic abuse controls (per-IP upload caps).

**Key decisions:** rate-limit storage (in-process vs Redis — a Coolify Redis may also serve sessions/queues; decide once here); whether to commission an external pentest before launch.

**Depends on:** 3 (headers/infra), informed by 4, 5. **Blocks:** launch.

**Done when:** a documented checklist (headers verified via scanner, rate limits demonstrated with a load script, price-tamper test rejected, oversized/malformed uploads rejected server-side) passes on staging.

### 11. Observability, error tracking & analytics

**Goal:** when something breaks you find out before the customer tells you, and the quote→order funnel is measurable.

**Today:** `funnel.ts` emits PostHog-shaped events to console only; Sentry is marked external in `vite.config.ts` but no SDK is wired; no uptime monitoring, no log aggregation.

**In scope:** Sentry (or self-hosted GlitchTip on Coolify) for client + server errors with release tagging from CI; PostHog wired for real (cloud EU or self-hosted on Coolify — cookieless mode interacts with topic 9's consent scope) — the event taxonomy already exists in `funnel.ts`; uptime monitoring external to the server (the health endpoint from topic 3); structured server logs retained somewhere queryable; alerting rules (payment webhook failures, error-rate spikes, Bambu token expiry from topic 10); simple business dashboard (quotes/day, conversion, AOV) — PostHog can carry this at launch.

**Key decisions:** SaaS vs self-hosted for both Sentry and PostHog (self-hosting both on the same Coolify box couples your monitoring to the thing being monitored — recommend at least error tracking external); analytics consent posture.

**Depends on:** 3. **Blocks:** nothing hard, but launching blind is a bad idea — treat as launch gate.

**Done when:** a thrown test error appears in the tracker with release + user context, funnel events flow to a real dashboard, and downtime pages you within minutes.

### 12. Test & quality expansion

**Goal:** confidence that the money path keeps working as all of the above lands.

**Today:** 109 unit tests, all on pure libs (pricing, mesh, packing, lead-time, MakerWorld parsing). Zero component, server-function, route, or E2E coverage. A local `verify` skill exists for manual e2e passes.

**In scope:** E2E suite (Playwright) for the golden paths: upload → quote → checkout (test-mode PSP) → order visible in admin; MakerWorld URL path; server-function integration tests against a test DB (Zod schemas already exist as contracts); payment webhook tests (replay, out-of-order, signature failure); component tests only where logic lives (OrderDialog, ConfigPanel) — don't chase coverage on presentational components; CI integration (topic 3) with the E2E suite on staging deploys; visual check for the 3D viewer is explicitly out of scope for automation (known WebGL/rAF limitation in headless) — keep as a manual checklist item.

**Key decisions:** E2E runner environment (against staging vs ephemeral); how much DB isolation per test.

**Depends on:** 3, grows alongside 4–7. **Blocks:** nothing, but every Phase 1 topic's "done when" should land with its tests — plan this early, execute continuously.

**Done when:** the golden-path E2E runs green in CI on every merge and a deliberately broken pricing change is caught before deploy.

---

## Phase 3 — Post-launch improvements

Not launch gates. Plan each when it reaches the top of the queue.

### 13. SEO, content & trust surface

**Today:** `manifest.json` still says "TanStack App"; robots.txt allows all; no sitemap, structured data, or OG images; the "files never leave your session" claim will be false after topic 2.
**Scope:** metadata + OG per locale, sitemap with hreflang, structured data (Product/LocalBusiness), manifest/branding cleanup, revised trust/privacy copy, materials/FAQ content pages for organic traffic, favicon/logo pass.

### 14. Pricing engine & quoting improvements

**Today:** solid calibrated core, but: the 10 zł extra-plate fee is uncalibrated (memory: geometric packing ≠ Bambu's actual plate split); shell/infill rates were anchored to just two reference quotes; multi-plate packing over-fits (e2e showed 1 plate where Bambu splits to 2).
**Scope:** calibrate against a larger reference set (more mapi-tech anchors + real print data once orders flow); packing accuracy vs real slicer output; quote persistence + expiry ("your quote is valid 14 days" links — needs topic 1); volume/bulk quoting UX; material/color choices expansion; possibly slicer-in-the-loop pricing (kiri:moto or CLI slicer server-side) as the long-term accuracy play.

### 15. Fulfillment & shipping integration

**Today:** flat 20 zł shipping, free ≥500 zł, manual everything.
**Scope:** carrier integration for PL/EU (InPost ShipX API is the Polish default; DPD/DHL for DE) — label purchase from admin, tracking-number automation into topic 6's emails; packaging weight/dims estimation from mesh data; per-country shipping rates for the 25-country enum; customs docs are N/A intra-EU but revisit if UK/CH added.

### 16. Feature backlog (customer-facing)

Candidates, each its own mini-plan when picked: customer dashboard improvements (re-order past parts, saved addresses); quote sharing links; STEP quoting hardening (auto-quoting works today; the manual-email card is the parse-failure fallback — reduce how often it triggers); more processes beyond FDM (the pricing engine's `PROCESS_IDS` structure anticipates this); DFM feedback expansion (wall-thickness analysis exists — surface fixes/suggestions); MakerWorld import hardening (official API unlikely — monitor the undocumented endpoints, degrade gracefully); accessibility audit against the WCAG 2.2 AA commitment in business/product.md (keyboard, contrast, reduced-motion, non-WebGL fallback — partially built, never audited).

### 17. OKF knowledge bundle (repo docs infrastructure)

**Today:** the repo's knowledge layer (plans, research, business docs) is plain markdown with README index tables and status banners — no machine-readable metadata.
**Scope:** make the whole repo a conforming [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle: YAML frontmatter (`type`/`title`/`description`) on every knowledge `.md`, a root `index.md` declaring `okf_version`, a `check-okf` conformance gate, and the type vocabulary in AGENTS.md. Locked protections: status stays in banners (never frontmatter), no hand-maintained timestamps, no per-directory `index.md`/`log.md`. Full plan: [17-okf-bundle.md](17-okf-bundle.md). Not a launch gate — pure repo infrastructure; decision recorded 2026-07-18 (full adoption chosen over skip / OKF-lite / export adapter, against advisor recommendation).

Business tasks that gate multiple topics and have real lead times — no plan file owns them, so they're tracked here:

- [ ] **Business entity** decision + registration (JDG vs sp. z o.o.) — gates Stripe activation, Fakturownia, and the regulamin (topics 5, 9)
- [ ] **Stripe account** onboarding + activation with P24/BLIK payment methods enabled (topic 5)
- [ ] **Fakturownia account** setup (topic 5)
- [ ] **Lawyer engagement** for regulamin + privacy policy (topic 9 — kick off during Phase 1)
- [ ] **Domain** purchase + DNS control (topics 3, 6)
- [ ] **Email provider account** (Resend) + sending-domain verification SPF/DKIM/DMARC (topic 6)

---

## Suggested sequencing

```
Phase 0 (parallel):      [1 Persistence] [2 File storage] [3 Deploy/CI]
                                │              │               │
Phase 1:                 [4 Auth] ──► [5 Orders+Payments] ◄── [2]
                              │            │
                         [6 Email] ◄───────┤
                              │            │
                         [7 Back-office] ◄─┘      [8 i18n — start early, runs long]
                                │
Phase 2 (launch gates):  [9 Legal/GDPR] [10 Security] [11 Observability] [12 Testing]
                                │
                            ─ LAUNCH ─
                                │
Phase 3:                 [13 SEO] [14 Pricing] [15 Shipping] [16 Backlog]
```

Rules of thumb: start **8 (i18n)** and **12 (testing)** early even though they gate late — both get more expensive the longer they wait. **9 (legal)** needs lawyer lead time — kick off the engagement during Phase 1. The single longest external-dependency chain is **5 (PSP onboarding + invoicing)** — begin the Stripe/P24 account setup before its planning session.
