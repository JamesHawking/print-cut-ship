# Prompt 01: SEO foundation (run first)

## Context

Existing codebase: an instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start (latest) + React + TypeScript strict, Bun as runtime and package manager, TanStack Query, shadcn/ui on Tailwind v4, Oxlint for linting. Pricing engine is a pure config-driven module at `src/lib/pricing.ts` (FDM: ASA, PETG, PA-CF). Quote flow lives at `/`. UI strings are hardcoded English in one file.

## Goal

Make the site indexable, multilingual and structured-data-ready so that content pages built in later prompts rank. No visible design changes to the quote tool.

## Requirements

1. **Rendering.** Every route must return full HTML on first request: enable SSR (or static prerendering for content routes) in TanStack Start. Verify with `curl` that page text is present in the raw response, not injected client-side. The quote tool itself may hydrate into an interactive island.
2. **Locale routing.** Introduce `/` (English, x-default), `/de/`, `/pl/` route trees sharing layouts and components. Move UI strings into per-locale dictionaries (`src/i18n/{en,de,pl}.ts`), typed so a missing key is a compile error. German and English complete; Polish may fall back to English per-key with a console warning in dev.
3. **Head management.** Per-page title, meta description, canonical URL, Open Graph and Twitter tags via TanStack Start's head API. Create a typed `Seo` helper component so later prompts pass `{title, description, path, locale, image?}` and get everything, including `hreflang` alternates linking the three locale versions plus `x-default`.
4. **Sitemap and robots.** Generate `sitemap.xml` at build time from the route tree (all locales, correct alternates) and a `robots.txt` allowing all, referencing the sitemap. Exclude the order-submission endpoints.
5. **Structured data plumbing.** A typed `JsonLd` component. Implement `Organization` (site-wide) and `WebSite` schema now; later prompts will pass `Product`, `FAQPage`, `Article`, `BreadcrumbList`. Add a `BreadcrumbList` component (shadcn Breadcrumb) used by all content pages.
6. **Performance floor.** Lighthouse SEO score 100 and performance 90+ on `/` and one content route: preload fonts, `loading="lazy"` images below the fold, no layout shift from the quote widget skeleton.
7. **Analytics.** Extend the existing console funnel events with `page_view {path, locale, referrer}` and `cta_upload_clicked {source_page}` so content-page conversion is attributable. Keep the PostHog-ready shape.
8. **Shared CTA block.** Build one `QuoteCta` component (headline, one trust line, upload button deep-linking to `/` with `?source=` param preserved into funnel events). Later prompts must reuse it, so make it good: compact variant (inline in prose) and full-width variant (page footer).

## Out of scope

No content pages yet. No blog. No new languages beyond en/de/pl scaffolding.

## Definition of done

`curl` on `/de/` returns German HTML with correct hreflang set; `sitemap.xml` lists all locale variants; Lighthouse SEO = 100 on both tested routes; `bun test` and `bun run lint` pass; README updated with the i18n and Seo conventions for future prompts.
