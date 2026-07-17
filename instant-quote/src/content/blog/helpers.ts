// Pure post-list logic (bun-safe — operates on a minimal shape, so tests
// never touch .mdx modules). The registry feeds it real posts; helpers.spec
// feeds it synthetic ones.

import type { Locale } from '@/lib/i18n'
import { blogPath } from './paths'

/** The slice of a post the list logic needs. */
export interface PostRef {
  locale: Locale
  slug: string
  date: string
  tags: ReadonlyArray<string>
  translationKey: string
}

/** Newest first; equal dates tie-break on slug for a stable order. */
export function sortNewestFirst<T extends PostRef>(posts: T[]): T[] {
  return [...posts].sort(
    (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
  )
}

export function groupByTranslationKey<T extends PostRef>(
  posts: T[],
): Map<string, Partial<Record<Locale, T>>> {
  const groups = new Map<string, Partial<Record<Locale, T>>>()
  for (const post of posts) {
    const group = groups.get(post.translationKey) ?? {}
    group[post.locale] = post
    groups.set(post.translationKey, group)
  }
  return groups
}

/**
 * hreflang alternates for a translation group — partial when a post has no
 * counterpart (seoHead then emits only the locales that exist).
 */
export function alternatesFromGroup(
  group: Partial<Record<Locale, PostRef>>,
): Partial<Record<Locale, string>> {
  const alternates: Partial<Record<Locale, string>> = {}
  for (const [locale, post] of Object.entries(group) as Array<
    [Locale, PostRef]
  >) {
    alternates[locale] = blogPath(locale, post.slug)
  }
  return alternates
}

/**
 * Related articles: most shared tags first, then newest, capped at `max`,
 * never the article itself (nor its other-locale twin — callers pass
 * same-locale lists, so that cannot arise).
 */
export function relatedByTags<T extends PostRef>(
  posts: T[],
  current: PostRef,
  max = 3,
): T[] {
  const shared = (post: PostRef) =>
    post.tags.filter((tag) => current.tags.includes(tag)).length
  return posts
    .filter((post) => post.slug !== current.slug && shared(post) > 0)
    .sort(
      (a, b) =>
        shared(b) - shared(a) ||
        b.date.localeCompare(a.date) ||
        a.slug.localeCompare(b.slug),
    )
    .slice(0, max)
}
