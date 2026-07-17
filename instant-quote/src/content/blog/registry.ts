// The blog post registry — VITE-ONLY. This module imports .mdx via
// import.meta.glob, which bun's test runner cannot parse: nothing imported
// by any *.spec.ts may transitively reach this file. Pure logic lives in
// schema.ts / paths.ts / helpers.ts / toc.ts instead.
//
// The module-scope zod parse below IS the spec's build gate: a bad
// frontmatter throws while the SSR/prerender bundle evaluates, failing
// `vite build` (and surfacing in the dev overlay). content.spec.ts
// re-validates the raw files with the same schema under bun.
//
// Posts are eagerly bundled — fine at a handful of articles; past ~20,
// split into an eager frontmatter glob + a lazy component glob.

import type { ComponentType } from 'react'
import { LOCALES, type Locale } from '@/lib/i18n'
import { blogFrontmatterSchema, type BlogFrontmatter } from './schema'
import {
  alternatesFromGroup,
  groupByTranslationKey,
  relatedByTags,
  sortNewestFirst,
  type PostRef,
} from './helpers'
import { blogPath } from './paths'
import type { TocEntry } from './toc'

interface BlogModule {
  default: ComponentType<{ components?: Record<string, ComponentType<never>> }>
  frontmatter: unknown
  readingTime: { text: string; minutes: number; time: number; words: number }
  tableOfContents: Array<TocEntry>
}

export interface BlogPost extends PostRef {
  fm: BlogFrontmatter
  readingTimeMinutes: number
  toc: Array<TocEntry>
  Component: BlogModule['default']
}

const modules = import.meta.glob<BlogModule>('./{pl,en}/*.mdx', {
  eager: true,
})

const ALL_POSTS: BlogPost[] = Object.entries(modules).map(([path, mod]) => {
  const match = /^\.\/(pl|en)\/([a-z0-9-]+)\.mdx$/.exec(path)
  if (!match) throw new Error(`blog: unexpected content path ${path}`)
  const locale = match[1] as Locale
  const slug = match[2]!
  const parsed = blogFrontmatterSchema.safeParse(mod.frontmatter)
  if (!parsed.success) {
    throw new Error(
      `blog: invalid frontmatter in ${path} — ${parsed.error.message}`,
    )
  }
  const fm = parsed.data
  return {
    locale,
    slug,
    date: fm.date,
    tags: fm.tags,
    translationKey: fm.translationKey,
    fm,
    readingTimeMinutes: Math.max(1, Math.round(mod.readingTime.minutes)),
    toc: mod.tableOfContents,
    Component: mod.default,
  }
})

// A duplicate translationKey within a locale would silently corrupt the
// translation pairing — fail the build instead.
for (const locale of LOCALES) {
  const seen = new Set<string>()
  for (const post of ALL_POSTS) {
    if (post.locale !== locale) continue
    if (seen.has(post.translationKey)) {
      throw new Error(
        `blog: duplicate translationKey "${post.translationKey}" in ${locale}`,
      )
    }
    seen.add(post.translationKey)
  }
}

const TRANSLATION_GROUPS = groupByTranslationKey(ALL_POSTS)

/** This locale's posts, newest first. */
export function blogPosts(locale: Locale): BlogPost[] {
  return sortNewestFirst(ALL_POSTS.filter((post) => post.locale === locale))
}

export function getBlogPost(locale: Locale, slug: string): BlogPost | null {
  return (
    ALL_POSTS.find((post) => post.locale === locale && post.slug === slug) ??
    null
  )
}

export function isBlogSlug(locale: Locale, slug: string): boolean {
  return getBlogPost(locale, slug) !== null
}

/**
 * hreflang alternates for an article — partial when it has no counterpart
 * (an untranslated article never advertises an hreflang link to a 404).
 */
export function blogAlternatesFor(
  locale: Locale,
  slug: string,
): Partial<Record<Locale, string>> {
  const post = getBlogPost(locale, slug)
  if (!post) return { [locale]: blogPath(locale, slug) }
  return alternatesFromGroup(TRANSLATION_GROUPS.get(post.translationKey) ?? {})
}

/**
 * A slug that is not valid in `locale` but names a post in another locale
 * (the LocaleSwitcher swaps only the locale param): the counterpart's path
 * here, or null → 404. Mirrors correctedWordFor for section words.
 */
export function counterpartRedirectPath(
  locale: Locale,
  foreignSlug: string,
): string | null {
  for (const other of LOCALES) {
    if (other === locale) continue
    const foreign = getBlogPost(other, foreignSlug)
    if (!foreign) continue
    const twin = TRANSLATION_GROUPS.get(foreign.translationKey)?.[locale]
    if (twin) return blogPath(locale, twin.slug)
  }
  return null
}

/** Unique tags across this locale's posts, alphabetical (listing filter). */
export function blogTags(locale: Locale): string[] {
  return [...new Set(blogPosts(locale).flatMap((post) => post.tags))].sort()
}

/** Same-locale related articles by shared tags, max 3. */
export function relatedTo(post: BlogPost): BlogPost[] {
  return relatedByTags(blogPosts(post.locale), post)
}
