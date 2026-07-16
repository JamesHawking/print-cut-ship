# Prompt 04: comparison pages (run after 01 and 02)

## Context

Existing codebase: instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start + TypeScript strict, Bun, TanStack Query, shadcn/ui on Tailwind v4, Oxlint. Pricing engine `src/lib/pricing.ts`; material data `src/content/materials.ts` and reference parts `src/content/referenceParts.ts` from prompt 02; SEO foundation from prompt 01 (locale routing, Seo, JsonLd, QuoteCta, breadcrumbs).

## Goal

Mid-intent comparison landing pages that capture "X vs Y" searches and funnel readers to the material pages and the quote tool. Three pages at launch.

## Requirements

1. **Pages.**
   - `/compare/asa-vs-petg` — decision guide: outdoor/UV and heat → ASA, chemical contact and easy dimensional stability → PETG. Include the live price delta for the same reference part.
   - `/compare/pa-cf-vs-aluminum` — when a printed PA-CF part replaces a machined aluminum bracket (stiffness-to-weight, cost at qty 1-50, lead time) and when it cannot (temperature, tight tolerance, conductivity). Aluminum prices as a cited external range (state "typical EU CNC job-shop range", not our quote), PA-CF prices live from the engine.
   - `/compare/print-in-house-vs-order` — honest TCO calculator-style page: desktop printer amortization, operator time, failure rate vs ordering; concludes with the segmentation truth: one-off PLA → print at home; engineering materials, batches, deadlines → order. This honesty is the trust play; write it straight.
   - German and Polish slugs translated (`/de/vergleich/...`, `/pl/porownanie/...`), hreflang wired.
2. **Template.** Shared comparison layout: H1, TL;DR verdict box at top (shadcn Alert style, the answer in 3 sentences), side-by-side spec table, live price comparison table for the shared reference parts, decision flow ("choose A if... choose B if...", rendered as cards, not a wall of bullets), FAQ accordion (4-6 questions), compact QuoteCta mid-page and full-width at end.
3. **Data.** Reuse `materials.ts` and `referenceParts.ts`; extend `materials.ts` if fields are missing rather than duplicating data in page files. The in-house-vs-order page gets its own small typed dataset (printer cost, failure rates, operator €/h) with sources noted in comments and rendered footnotes.
4. **Structured data.** `FAQPage` per page, `BreadcrumbList`; `Article` schema with datePublished/dateModified.
5. **Copy.** 700-1,000 words per page, en+de native quality (pl fallback allowed). Engineer tone, numbers over adjectives, no vendor bashing. Every claim about materials must trace to a `materials.ts` field or a footnoted source.
6. **Internal linking.** Each comparison links both material pages, `/pricing`, and the other comparisons. Material pages from prompt 02 get a "Compare" section linking here (edit them).
7. **Funnel.** `cta_upload_clicked` carries `source_page: "compare/asa-vs-petg"` etc.

## Out of scope

No comparisons against named competitors. No MJF/SLS comparisons yet. No user-configurable comparison tool.

## Definition of done

Three pages live in en+de with live-computed price tables; verdict boxes render above the fold; FAQPage and Article schema validate; internal links from material pages in place; Lighthouse SEO 100; `bun test` and `bun run lint` pass.
