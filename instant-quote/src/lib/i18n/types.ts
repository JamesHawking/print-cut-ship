import type { pl } from './pl'

/**
 * The dictionary shape, inferred from the Polish source of truth. en.ts must
 * `satisfies Dictionary` — a key present in one locale but not the other is a
 * compile error (Plans/08-i18n.md phase A).
 */
export type Dictionary = typeof pl

export const LOCALES = ['pl', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pl'

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
