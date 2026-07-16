// URL identity for the material landing pages (seo_prompts/02): the section
// word is localized (plan 08 §6 — localized slugs for content pages only);
// material slugs are technical names, identical in both locales.

import type { Locale } from '@/lib/i18n'

export const MATERIALS_SECTION: Record<Locale, string> = {
  pl: 'materialy',
  en: 'materials',
}

/** Materials with a published landing page (mirrors cmd/api reference-prices). */
export const PUBLISHED_MATERIALS = [
  { slug: 'petg', id: 'petg' },
  { slug: 'asa', id: 'asa' },
  { slug: 'pa12-cf', id: 'pa12_cf' },
] as const

export type MaterialSlug = (typeof PUBLISHED_MATERIALS)[number]['slug']
export type PublishedMaterialId = (typeof PUBLISHED_MATERIALS)[number]['id']

export function isMaterialSlug(value: string): value is MaterialSlug {
  return PUBLISHED_MATERIALS.some((m) => m.slug === value)
}

export function materialIdForSlug(slug: MaterialSlug): PublishedMaterialId {
  return PUBLISHED_MATERIALS.find((m) => m.slug === slug)!.id
}

/** The localized section word another locale's URL used, if any. */
export function isAnyMaterialsSection(section: string): boolean {
  return Object.values(MATERIALS_SECTION).includes(section)
}

export function materialsIndexPath(locale: Locale): string {
  return `/${locale}/${MATERIALS_SECTION[locale]}`
}

export function materialPath(locale: Locale, slug: MaterialSlug): string {
  return `${materialsIndexPath(locale)}/${slug}`
}

/** Per-locale alternates for seoHead/sitemap (localized section word). */
export function materialsIndexAlternates(): Record<Locale, string> {
  return { pl: materialsIndexPath('pl'), en: materialsIndexPath('en') }
}

export function materialAlternates(slug: MaterialSlug): Record<Locale, string> {
  return { pl: materialPath('pl', slug), en: materialPath('en', slug) }
}
