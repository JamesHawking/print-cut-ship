import type { Locale } from '@/lib/i18n'
import { plPricingCopy, type PricingCopy } from './pl'
import { enPricingCopy } from './en'

const COPY: Record<Locale, PricingCopy> = {
  pl: plPricingCopy,
  en: enPricingCopy,
}

export function pricingCopy(locale: Locale): PricingCopy {
  return COPY[locale]
}
