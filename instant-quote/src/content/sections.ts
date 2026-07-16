// Registry of localized content sections under the /$locale/$section route
// (plan 08 §6: localized slugs for content pages). Each key maps to its
// per-locale URL word; the $section layout validates against this and
// redirects wrong-locale words (which is what keeps the LocaleSwitcher
// working on content pages). New content sections register here.

import type { Locale } from '@/lib/i18n'

export const SECTIONS = {
  materials: { pl: 'materialy', en: 'materials' },
  pricing: { pl: 'cennik', en: 'pricing' },
} as const

export type SectionKey = keyof typeof SECTIONS

/** The section this word names in this locale, if any. */
export function sectionKeyFor(locale: Locale, word: string): SectionKey | null {
  for (const key of Object.keys(SECTIONS) as SectionKey[]) {
    if (SECTIONS[key][locale] === word) return key
  }
  return null
}

/** If `word` belongs to ANY locale's section, the right word for `locale`. */
export function correctedWordFor(word: string, locale: Locale): string | null {
  for (const key of Object.keys(SECTIONS) as SectionKey[]) {
    if ((Object.values(SECTIONS[key]) as string[]).includes(word)) {
      return SECTIONS[key][locale]
    }
  }
  return null
}

export function sectionPath(locale: Locale, key: SectionKey): string {
  return `/${locale}/${SECTIONS[key][locale]}`
}

/** Per-locale alternates for seoHead/sitemap. */
export function sectionAlternates(key: SectionKey): Record<Locale, string> {
  return { pl: sectionPath('pl', key), en: sectionPath('en', key) }
}
