// Blog frontmatter contract (seo_prompts/05). `locale` and `slug` are NOT
// frontmatter — both derive from the file path src/content/blog/{locale}/
// {slug}.mdx, so they can never disagree with it. Translations across
// locales share a `translationKey` (symmetric and rename-proof, unlike a
// translationOf pointer); the registry pairs them for hreflang alternates
// and the locale switch. This module is bun-safe: the zod schema is shared
// by registry.ts (the build gate — parse failure fails the prerender) and
// content.spec.ts (re-validates raw files via gray-matter under bun, which
// cannot parse .mdx).

import { z } from 'zod'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const KEBAB = /^[a-z0-9][a-z0-9-]*$/

export const blogFrontmatterSchema = z
  .object({
    title: z.string().min(8).max(90),
    /** Meta description; also the listing-card teaser. */
    description: z.string().min(50).max(170),
    /** Publication date, static ISO day (deterministic prerender). */
    date: z.string().regex(ISO_DAY),
    /** Bump on substantive edits; drives dateModified + RSS pubDate. */
    updated: z.string().regex(ISO_DAY).optional(),
    author: z.string().min(1),
    tags: z.array(z.string().regex(KEBAB)).min(1).max(5),
    /** Shared across a translation pair; unique within a locale. */
    translationKey: z.string().regex(KEBAB),
  })
  .refine((fm) => !fm.updated || fm.updated >= fm.date, {
    message: 'updated must not precede date',
  })

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>
