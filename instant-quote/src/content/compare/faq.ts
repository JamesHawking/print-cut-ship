import type { Locale } from '@/lib/i18n'
import { compareCopy } from './copy'
import { compareValues } from './data'
import type { CompareSlug } from './slugs'

/** FAQ with engine values resolved — feeds both the accordion and FAQPage schema. */
export function compareFaq(
  locale: Locale,
  slug: CompareSlug,
): Array<{ q: string; a: string }> {
  const values = compareValues()
  return compareCopy(locale)[slug].faq.map(({ q, a }) => ({ q, a: a(values) }))
}
