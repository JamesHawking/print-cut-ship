// URL identity for the comparison landing pages (seo_prompts/04): the section
// word is localized (registered in src/content/sections.ts); comparison slugs
// are technical names, identical in both locales.

import type { Locale } from '@/lib/i18n'
import { SECTIONS, sectionAlternates, sectionPath } from '@/content/sections'
import type { PublishedMaterialId } from '@/content/materials/slugs'

export const COMPARE_SECTION: Record<Locale, string> = SECTIONS.compare

/** Published comparisons; `materials` drives the material-page backlinks. */
export const COMPARISONS = [
  { slug: 'asa-vs-petg', materials: ['asa', 'petg'] },
  { slug: 'pa-cf-vs-aluminum', materials: ['pa12_cf'] },
  { slug: 'print-in-house-vs-order', materials: [] },
] as const satisfies ReadonlyArray<{
  slug: string
  materials: readonly PublishedMaterialId[]
}>

export type CompareSlug = (typeof COMPARISONS)[number]['slug']

export function isCompareSlug(value: string): value is CompareSlug {
  return COMPARISONS.some((c) => c.slug === value)
}

export function compareMaterials(
  slug: CompareSlug,
): readonly PublishedMaterialId[] {
  return COMPARISONS.find((c) => c.slug === slug)!.materials
}

/** Comparisons that mention this material (material-page cross-links). */
export function comparisonsFor(id: PublishedMaterialId): CompareSlug[] {
  return COMPARISONS.filter((c) =>
    (c.materials as readonly PublishedMaterialId[]).includes(id),
  ).map((c) => c.slug)
}

export function compareIndexPath(locale: Locale): string {
  return sectionPath(locale, 'compare')
}

export function comparePath(locale: Locale, slug: CompareSlug): string {
  return `${compareIndexPath(locale)}/${slug}`
}

/** Per-locale alternates for seoHead/sitemap (localized section word). */
export function compareIndexAlternates(): Record<Locale, string> {
  return sectionAlternates('compare')
}

export function compareAlternates(slug: CompareSlug): Record<Locale, string> {
  return { pl: comparePath('pl', slug), en: comparePath('en', slug) }
}
