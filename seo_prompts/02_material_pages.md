# Prompt 02: material pages (run after 01)

## Context

Existing codebase: instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start + TypeScript strict, Bun, TanStack Query, shadcn/ui on Tailwind v4, Oxlint. Pricing engine: config-driven `src/lib/pricing.ts` (FDM: ASA €20/kg, PETG €18/kg, PA-CF €45/kg; €4.00/machine-hour; quantity discounts 1/5/10/25/50 = 0/5/12/20/28%; Economy/Standard/Express lead times). SEO foundation from prompt 01 exists: locale routing (`/`, `/de/`, `/pl/`), `Seo` helper, `JsonLd`, `QuoteCta`, sitemap generation.

## Goal

Commercial-intent landing pages that rank for "{material} 3D printing service" queries in German and English and convert directly into the quote tool. These pages are the core of the SEO strategy; they are landing pages first, documentation second.

## Requirements

1. **Routes.** `/materials` index plus `/materials/asa`, `/materials/petg`, `/materials/pa-cf` in all three locales (German: `/de/materialien/...` with translated slugs; Polish slugs translated too; hreflang wired by the Seo helper).
2. **Single data source.** Create `src/content/materials.ts`: typed records per material with mechanical properties (tensile strength, HDT, UV resistance, layer adhesion notes), use cases, design limits (min wall, tolerance ±0.3 mm or per material), finish options, and marketing copy keys. Prices must NOT live here; they are computed from `pricing.ts`.
3. **Live example prices.** Each page shows a "what it costs" table computed at render time from the pricing engine for three canonical reference parts (define once in `src/content/referenceParts.ts`): a 20 cm3 bracket, a 60 cm3 enclosure, a 100 cm3 housing, each at qty 1 / 10 / 50 with unit prices. Label: "Live prices, calculated by the same engine as your quote."
4. **Page structure** (same template, one component): H1 "{Material} 3D printing service", one-paragraph value promise with lead time ("parts ship in 3 business days, D+1/D+2 delivery in Germany"), properties table (shadcn Table), price table, use-cases section, design guidelines, FAQ (5-7 material-specific questions in an Accordion), inline compact `QuoteCta` after the price table, full-width `QuoteCta` at the end.
5. **Structured data.** `Product` schema with `offers` (price from the qty-1 bracket reference part, priceCurrency EUR), `FAQPage` schema from the FAQ content, `BreadcrumbList`.
6. **Copy.** Write real copy, not lorem: 500-800 words per page per language, German and English (Polish body may be marked draft with English fallback). Tone: engineer-to-engineer, concrete numbers, no superlatives. German copy must be native-quality technical German (Schichthaftung, Bauteilausrichtung, Maßhaltigkeit), not literal translation.
7. **Internal linking.** Materials index cards link to each page; each material page links to the other two ("compare with...") and to `/pricing` (exists after prompt 03; use the route now, it can 404 until then behind a feature flag if needed).
8. **Funnel.** `cta_upload_clicked` events must carry `source_page: "materials/asa"` etc.

## Out of scope

No MJF/SLS/resin pages yet (FDM only). No comparison pages (prompt 04). No CMS; content lives in typed TS/MDX files in the repo.

## Definition of done

Three material pages live in en+de with real copy and live-computed prices; changing a price constant in `pricing.ts` changes the rendered price tables after rebuild; Product and FAQPage schema validate in Google's Rich Results test; Lighthouse SEO 100; `bun test` and `bun run lint` pass. Include a unit test asserting the reference-part price table matches `pricing.ts` output.
