import type { Locale } from '@/lib/i18n'
import { plCompareCopy, type CompareCopy } from './pl'
import { enCompareCopy } from './en'
import type { CompareSlug } from './slugs'

const COPY: Record<Locale, Record<CompareSlug, CompareCopy>> = {
  pl: plCompareCopy,
  en: enCompareCopy,
}

export function compareCopy(locale: Locale): Record<CompareSlug, CompareCopy> {
  return COPY[locale]
}
