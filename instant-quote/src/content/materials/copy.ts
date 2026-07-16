import type { Locale } from '@/lib/i18n'
import { plMaterialsCopy, type MaterialCopy } from './pl'
import { enMaterialsCopy } from './en'
import type { PublishedMaterialId } from './slugs'

const COPY: Record<Locale, Record<PublishedMaterialId, MaterialCopy>> = {
  pl: plMaterialsCopy,
  en: enMaterialsCopy,
}

export function materialsCopy(
  locale: Locale,
): Record<PublishedMaterialId, MaterialCopy> {
  return COPY[locale]
}
