import type { Locale } from '@/lib/i18n'
import { pricingCopy } from './copy'
import { pricingValues } from './data'

/** FAQ with engine values resolved — feeds both the accordion and FAQPage schema. */
export function pricingFaq(locale: Locale): Array<{ q: string; a: string }> {
  const values = pricingValues()
  return pricingCopy(locale).faq.map(({ q, a }) => ({ q, a: a(values) }))
}
