# Phase 1 SEO build: prompt sequence

Six executable prompts for the coding agent, in dependency order. Feed one at a time; each is self-contained and repeats the codebase context, so fresh agent sessions work.

| # | Prompt | Depends on | What it ships |
|---|--------|-----------|---------------|
| 01 | seo_foundation | nothing | SSR/prerender, meta, sitemap, hreflang, locale routing, schema.org plumbing |
| 02 | material_pages | 01 | /materials/{asa,petg,pa-cf} with live prices from the pricing engine |
| 03 | pricing_page | 01 | Transparent /pricing rate card, single source of truth |
| 04 | comparison_pages | 01, 02 | 3 comparison landing pages with internal linking |
| 05 | blog_engine | 01 | MDX blog, listing, RSS, 2 seed articles |
| 06 | stl_calculator | 01 | Free standalone STL cost estimator (linkable asset) |

Rules that apply to every prompt:

- Bun for everything (`bun install`, `bun dev`, `bunx`, `bun test`, `bun run lint` with Oxlint). No npm/yarn/pnpm.
- All prices shown anywhere on the site must be computed from `src/lib/pricing.ts` config at build/render time. Never hardcode a price in content. If the config changes, every page updates.
- Every page ends in the upload/quote CTA. The tool is the CTA, not a newsletter.
- Locales: `/` = English (x-default), `/de/` = German, `/pl/` = Polish. German content is the priority; English ships alongside; Polish may ship as structure with translated UI chrome and untranslated body marked draft.
- Keep TypeScript strict; `bun test` and `bun run lint` must pass at the end of each prompt.
