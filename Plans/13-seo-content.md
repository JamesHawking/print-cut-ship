# 13 — SEO, content & trust surface

> **Status: ⬜ Not started** (as of 2026-07-16).

*Phase 3 — post-launch. Lighter plan by design: scoping + sequencing.*

## 1. Context

The public surface still carries scaffold artifacts and soon-to-be-false claims: `instant-quote/public/manifest.json` says "TanStack App"; robots.txt allows all with no sitemap; no OG images, no structured data, no favicon/logo identity; and the Hero's *"files never leave your session"* promise becomes false the day plan 02 ships (that copy change is **owned here**, the legal disclosure in 09). No content pages exist for organic traffic (materials, FAQ).

## 2. Decisions applied

Pinned: `/pl` + `/en` with hreflang (plan 08 built the plumbing); PostHog measures whatever this topic wins. Topic-local: structured data as JSON-LD (`Organization` + `Product`/`Service` on the landing, `FAQPage` on the FAQ); content pages as markdown-rendered routes (same mechanism as plan 09's legal pages — no CMS).

## 3. Implementation phases

1. **Metadata & identity pass** — per-locale `<title>`/description on every public route; OG/Twitter images (one branded template, per-locale text); manifest/branding cleanup; favicon + wordmark pass consistent with the Archivo/Martian Mono identity. *Verify:* social-card validators render correctly for `/pl` and `/en`.
2. **Sitemap + robots + hreflang audit** — generated `sitemap.xml` (both locales, hreflang alternates matching plan 08's tags), robots.txt pointing at it, `/admin` + `/order/*` (tokenized) disallowed. *Verify:* Search Console accepts the sitemap, zero hreflang errors.
3. **Trust & privacy copy revision** — rewrite the Hero privacy line and `HowWePriceDialog`/footer trust copy to truthfully describe upload storage + retention (coordinate wording with 09's policy; **sequenced with plan 02's production deploy**). *Verify:* no copy anywhere claims files stay in-session.
4. **Content pages for organic traffic** — materials guide (per-material spec/use pages leveraging the existing spec-table data), FAQ (pricing, lead times, file formats, complaints), about/how-it-works. PL-first, EN mirrored; JSON-LD on each. *Verify:* pages indexed; internal links from quote flow (material picker → material page).

## 4. Dependencies

Requires 08 (locale routing) and 09's policy wording for phase 3; phase 3 must ship **with or before** plan 02 hits production. Unblocks nothing — pure growth surface.

## 5. Verification

- [ ] Lighthouse SEO ≥ 95 on landing + content pages, both locales.
- [ ] Search Console: sitemap accepted, no hreflang/coverage errors, branded result renders (favicon, sitename).
- [ ] OG cards validated on the major platforms.
- [ ] Privacy-claim copy truthful post-plan-02.
- [ ] PostHog can segment organic-landing sessions (UTM/referrer capture already in funnel events).

## 6. Risks & open questions

- The copy-truthfulness gate (phase 3) is a hard sequencing constraint with plan 02 — flagged in both plans.
- Materials/FAQ content needs real domain writing (print quality, tolerances) — the operator's time, not just code; keep pages few and good rather than many and thin.
- Open: blog/programmatic SEO deferred entirely; revisit only with evidence organic matters for this niche vs MakerWorld-import virality.
