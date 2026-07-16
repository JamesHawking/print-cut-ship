# Prompt 03: transparent pricing page (run after 01)

## Context

Existing codebase: instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start + TypeScript strict, Bun, TanStack Query, shadcn/ui on Tailwind v4, Oxlint. Pricing engine: config-driven `src/lib/pricing.ts` (FDM ASA/PETG/PA-CF, €4.00/machine-hour, material €/kg, qty discounts 0/5/12/20/28% at 1/5/10/25/50, Economy -15% / Standard / Express +35%, €15 minimum order, €9 shipping free above €250). SEO foundation from prompt 01 exists (locale routing, Seo, JsonLd, QuoteCta).

## Goal

A `/pricing` page that publishes the actual rate card. Strategic rationale, encode it in the copy: almost no EU provider publishes real prices anymore, so transparency both ranks and converts. This page is the "how we price" reference the whole site links to.

## Requirements

1. **Routes.** `/pricing`, `/de/preise`, `/pl/cennik`, hreflang wired.
2. **Everything computed.** Every number renders from `pricing.ts` config. A test must fail if any EUR value on this page is a string literal in the page source.
3. **Sections, in order:**
   - The formula, in plain language and as a visual: price = machine time × rate + material weight × price/kg, with the actual constants shown per material.
   - Rate card table: per material, effective price for 1 cm3 / 10 cm3 / 100 cm3 parts (computed), material €/kg, machine-hour rate.
   - Quantity discount table with the exact percentages and a worked example (same part at 1/5/10/25/50).
   - Lead time options with multipliers and concrete ship-date examples ("ordered Tuesday 11:00 → Express ships Wednesday").
   - Minimums and shipping: €15 minimum order with a worked example of when it binds, €9 EU shipping, free over €250, D+1 PL/DE, D+2 rest of EU.
   - "No hidden costs" section: no file fees, no setup fees, VAT handling explained (23% PL VAT, ex-VAT toggle consistent with the quote tool).
   - Honest comparison paragraph: when a Chinese provider is cheaper (large simple parts, no deadline) and when we are (deadlines, iteration loops, no customs risk, EUR 3/line import duty since July 2026). Factual tone, no competitor bashing.
4. **Interactive element.** A mini price slider ("part volume in cm3" → live price per material, reusing the pricing engine through TanStack Query, same pattern as the quote tool). This is the page's hook; make it the first thing after the intro.
5. **Structured data.** `FAQPage` from a 6-question pricing FAQ (minimum order, VAT, shipping, discounts, payment methods, quote validity). `BreadcrumbList`.
6. **Copy.** 400-600 words per language around the tables, en+de native quality, pl may fall back. Engineer tone, short sentences.
7. **Linking.** Link each material row to its `/materials/...` page; inline compact `QuoteCta` after the rate card and full-width at the end; the quote tool's "How we price" dialog now links here.

## Out of scope

No CNC/MJF pricing. No currency switcher (EUR only). No PDF rate card export.

## Definition of done

Rate card and discount tables render from config (test proves it); mini slider updates in <100 ms; FAQPage schema validates; en+de copy complete; Lighthouse SEO 100; `bun test` and `bun run lint` pass.
