// Blog URL helpers (bun-safe — no .mdx imports). Section words come from
// the sections registry: /pl/baza-wiedzy vs /en/blog. Article slugs are
// per-locale (localized), so cross-locale article paths go through the
// registry's translationKey pairing, not through these helpers.

import type { Locale } from '@/lib/i18n'
import { SECTIONS, sectionAlternates, sectionPath } from '@/content/sections'

export const BLOG_SECTION = SECTIONS.blog

export function blogIndexPath(locale: Locale): string {
  return sectionPath(locale, 'blog')
}

export function blogPath(locale: Locale, slug: string): string {
  return `${blogIndexPath(locale)}/${slug}`
}

/** Per-locale RSS feed, prerendered next to the listing. */
export function rssPath(locale: Locale): string {
  return `${blogIndexPath(locale)}/rss.xml`
}

export function blogIndexAlternates(): Record<Locale, string> {
  return sectionAlternates('blog')
}
