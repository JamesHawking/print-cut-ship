# 09 — Legal & GDPR/RODO compliance

## 1. Context

Nothing legal exists: no regulamin (terms), no privacy policy, no cookie posture, no company details anywhere, no withdrawal-rights disclosure, no complaint procedure, no data-subject rights implementation. The footer has no legal links. Meanwhile the stack is accumulating exactly the things these documents must describe: uploaded files with retention windows (plan 02), payments via Stripe (05), invoices with a 5-year statutory retention (05), transactional email (06), analytics (11), and an admin who can look up customers (07).

This is an absolute launch gate — the first real order must not be taken without it. **Hard rule from the brief: final legal text is drafted with a lawyer or a vetted Polish template service.** This plan scaffolds structure, placeholders, mechanics (acknowledgements, versioning, export/erase), and the checklist the lawyer works from — never AI-drafted final legal text.

## 2. Decisions applied

**Pinned (DECISIONS.md):** PostHog EU cookieless (shrinks consent surface); processors to disclose: server host, Stripe, Resend, PostHog, Sentry, Bambu Cloud (MakerWorld feature), Fakturownia; MinIO is self-hosted (not a processor, but disclosed as storage). Go backend serves the data-rights endpoints (07's plumbing).

**Topic-local decisions:**

- **Regulamin path: vetted Polish template service, lawyer-reviewed** (frame: template services like those used by small PL e-commerce cover the mandatory regulamin elements cheaply; a custom-lawyer-only route is slower and dearer). **Final call is the user's** — flagged as an external decision; the plan's document skeletons work for either.
- **Cookie posture: no consent banner at launch.** PostHog cookieless + strictly-necessary cookies only (session cookie, locale cookie). If a marketing pixel ever lands, a CMP becomes necessary — revisit then. Documented in the privacy policy.
- **Document versioning:** legal docs are versioned markdown in-repo (`instant-quote/src/content/legal/{regulamin,privacy}.{pl,en}.md` with a `version` frontmatter); orders record the accepted version. No CMS.

## 3. Implementation phases

### Phase A — Document skeletons + legal pages

- Structured skeletons (headings + placeholder clauses + `TODO(lawyer)` markers) for: **Regulamin** (mandatory PL e-commerce elements: seller identity, ordering procedure, prices/payment, delivery, **withdrawal exemption**, **complaint procedure**, ODR platform link), **Privacy policy** (RODO: controller identity, lawful bases per purpose, retention table — must mirror plan 02's file windows and the 5-year invoice rule, processor list, data-subject rights, transfers), **Withdrawal/complaints info page**.
- Frontend routes (locale-prefixed, plan 08): `/regulamin` · `/terms`, `/prywatnosc` · `/privacy`, `/reklamacje` · `/complaints`; rendered from the markdown content. Footer gains the legal-links block + **company details** (entity name, NIP, REGON, address — external prerequisite: entity registration).
- **Verify:** all pages render in both locales; footer links present on every public route; grep finds no `TODO(lawyer)` marker at launch-gate time.

### Phase B — Checkout acknowledgements (the withdrawal-exemption nuance)

- Custom-manufactured goods are **exempt from the 14-day EU withdrawal right** (Art. 38(1)(3) Consumer Rights Directive / Art. 38 pkt 3 ustawy o prawach konsumenta), but the exemption only holds if the consumer is **informed and acknowledges** it before paying.
- `OrderDialog`/checkout gains two required checkboxes (unchecked by default): (1) regulamin acceptance, (2) explicit acknowledgement that the withdrawal right is lost for custom-manufactured items. Plan 05's `POST /api/v1/orders` schema gains `acceptedTermsVersion` + `withdrawalAcknowledged: true` (both required — the API rejects without them); stored on the order row (add to plan 05's migration: `accepted_terms_version text NOT NULL`, `withdrawal_acknowledged boolean NOT NULL`).
- **Complaint procedure (rękojmia):** the exemption does NOT remove defect liability — the regulamin defines how to file a reklamacja (channel = support inbox from plan 06, statutory 14-day response, remedies: repair/replacement/price reduction/refund). Admin handles complaints manually at launch (no ticket system); plan 07's customer lookup is the tool.
- **Verify:** ordering without either checkbox is impossible client-side AND rejected by the API; the order row records version + acknowledgement; the complaint page states the procedure in both languages.

### Phase C — Data-subject rights (export + erase)

- Finish plan 07's stubs into policy-complete flows (Go):
  - **Export:** JSON bundle of user/quotes/orders/files-metadata/email-log for an email, admin-triggered on request (Art. 15/20). Manual delivery at launch.
  - **Erase (Art. 17) with the retention carve-out:** anonymize rather than delete where legal duties persist — orders with issued invoices keep the financial fields until `retention_until` but have PII columns (email, name, company) replaced with tombstones; files (blobs) delete via plan 02; email-log rows anonymize the address; auth user rows delete outright. The dry-run report (07) becomes the operator's confirmation screen.
- Account page (plan 04) gains "export my data / delete my account" request entry points (mailto/support at launch — automated self-serve is backlog).
- **Verify:** erase on a seeded customer with an invoiced order removes/anonymizes everything except the invoice-required fields, which survive with a logged legal basis; export bundle is complete and matches what the admin lookup shows.

### Phase D — Processor diligence + registers

- DPA checklist per processor (Stripe, Resend, PostHog EU, Sentry, Fakturownia, host provider — all offer standard DPAs; record signed/accepted status). Note Bambu Cloud has **no DPA** — MakerWorld imports send a URL to an undocumented API; disclose in the policy and treat imported-model metadata as leaving the EEA-controlled surface.
- Minimal RODO records: processing-activities register (Art. 30 — a simple table in `Plans/runbooks/rodo-register.md`) and the retention table shared with the privacy policy.
- **Verify:** every third-party service in `DECISIONS.md` appears in the processor list + register; retention table values match plans 02/05 constants.

## 4. Dependencies

- **Requires:** 08 (both languages — hard), decisions/constants from 02 (retention windows), 05 (invoice retention + acknowledgement columns), 06 (support inbox = complaint channel), 11 (analytics posture). Plumbing from 07 (export/erase endpoints).
- **External prerequisites:** business entity registered (identity block), lawyer engaged (start during Phase 1 of the roadmap — longest lead time).
- **Blocks:** launch, absolutely.

## 5. Verification

- [ ] Regulamin, privacy policy, complaints page live in PL+EN, lawyer-approved (no `TODO(lawyer)` left), footer-linked everywhere, with company details.
- [ ] Checkout collects regulamin acceptance + withdrawal-exemption acknowledgement; API-enforced; persisted with version.
- [ ] A data-deletion request can actually be executed: erase run on staging behaves per Phase C, invoices retained with basis.
- [ ] Export bundle delivered for a test request.
- [ ] No consent banner needed: only strictly-necessary cookies present (verify in devtools); PostHog runs cookieless.
- [ ] Processor register complete; DPAs recorded.

## 6. Risks & open questions

- **Lawyer lead time is the critical path** — engage during Phase 1 of the roadmap, not when this topic starts. Template-service vs custom-lawyer is the user's call (cost/speed vs fit).
- **Withdrawal-exemption edge:** MakerWorld-imported stock models are arguably not "made to consumer specification" in the same way as uploads — ask the lawyer whether the exemption confidently covers them; if not, the acknowledgement copy must differentiate.
- **Anonymization vs deletion correctness:** the tombstone approach must be reviewed (legal + technical) so no PII survives in `raw` jsonb blobs (Stripe events store customer email inside `payments.raw` — scrub on erase).
- **B2B vs consumer scope:** rękojmia/withdrawal rules differ for B2B buyers; regulamin needs the standard dual-track clauses — lawyer scope item.
- **Open:** does the abandoned-quote email (03/06) need consent under PL telecom/UCE rules when the quoter gave an email but no explicit marketing opt-in? Lawyer question before enabling that job.
