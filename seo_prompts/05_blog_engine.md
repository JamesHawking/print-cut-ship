# Prompt 05: blog engine + seed articles (run after 01)

## Context

Existing codebase: instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start + TypeScript strict, Bun, TanStack Query, shadcn/ui on Tailwind v4, Oxlint. SEO foundation from prompt 01 (locale routing `/`, `/de/`, `/pl/`, Seo helper, JsonLd, QuoteCta, sitemap generation). Material pages and pricing page may or may not exist yet; link to their routes regardless.

## Goal

An MDX blog living in the same app and domain (subdirectory, never a subdomain) for informational-intent content and backlink earning. Ship the engine plus two real seed articles.

## Requirements

1. **Engine.**
   - Content as MDX files in `src/content/blog/{locale}/{slug}.mdx` with typed frontmatter (title, description, date, updated, author, tags, locale, translationOf?) validated at build time with zod; a bad frontmatter fails the build.
   - Routes: `/blog` listing + `/blog/{slug}` (German: `/de/wissen/...`, Polish: `/pl/baza-wiedzy/...`). An article missing in a locale 404s rather than silently falling back, but the listing shows only that locale's articles.
   - Article layout: readable measure (~70ch), h2/h3 anchor links, table of contents for articles with 4+ headings, code/figure support, image captions, author box, published/updated dates, tags, related articles (by shared tags, max 3), compact QuoteCta after the second h2 and full-width at the end.
   - Listing page: cards with title/description/date/tags, newest first, tag filter. No pagination until >20 posts.
   - RSS feed per locale at `/blog/rss.xml` (and locale variants), included in robots/sitemap correctly (sitemap lists articles; RSS linked via `<link rel="alternate">`).
   - `Article` structured data with author, dates, and `BreadcrumbList`.
   - Reading-time estimate in frontmatter-derived metadata.
2. **Seed article 1: FDM design guide.** "Designing FDM parts that don't fail: wall thickness, orientation, and tolerances" (en + de). 1,200-1,800 words of real engineering content: minimum wall by material, anisotropy and layer adhesion, orientation vs strength, realistic tolerance bands (±0.3 mm class), hole sizing and clearances, when to add ribs vs thickness. Concrete numbers, simple inline SVG diagrams (3-4, drawn as components, not stock images).
3. **Seed article 2: tolerance guide.** "What tolerances can you actually expect from FDM?" (en + de). 900-1,200 words: as-printed tolerance classes, what drives variance (material shrinkage per material, from `materials.ts` if present), design strategies (clearance tables for press/slide/loose fits), when FDM is the wrong answer. Include one HTML table usable as a reference (this is the linkable asset within the article).
4. **Quality bar for copy.** Engineer-to-engineer, short sentences, numbers over adjectives, zero fluff intros ("In today's fast-paced world..." = instant fail). German versions native technical quality, not literal translation.
5. **Funnel.** `page_view` and `cta_upload_clicked` with `source_page: "blog/{slug}"`.

## Out of scope

No CMS or admin UI. No comments. No newsletter. No auto-translation. Polish seed articles not required (structure only).

## Definition of done

Both articles live in en+de and render with ToC, schema, RSS; invalid frontmatter breaks the build (test proves it); listing filters by tag; Lighthouse SEO 100 on listing and one article; `bun test` and `bun run lint` pass. README documents how to add an article.
