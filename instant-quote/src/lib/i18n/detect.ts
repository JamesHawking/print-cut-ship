// Locale detection for the `/` redirect: cookie (switcher override) →
// Accept-Language → DEFAULT_LOCALE. Pure functions so they unit-test without
// a request context.

import { DEFAULT_LOCALE, isLocale, type Locale } from './types'

export const LOCALE_COOKIE = 'locale'

/**
 * First supported base language in header order. Entries are conventionally
 * ordered by preference; with two locales, q-value sorting adds nothing.
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const base = part.split(';')[0].trim().toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return null
}

export function parseLocaleCookie(
  cookieHeader: string | null | undefined,
): Locale | null {
  if (!cookieHeader) return null
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(
    cookieHeader,
  )
  return match && isLocale(match[1]) ? (match[1] as Locale) : null
}

export function detectLocale(input: {
  cookie?: string | null
  acceptLanguage?: string | null
}): Locale {
  return (
    parseLocaleCookie(input.cookie) ??
    parseAcceptLanguage(input.acceptLanguage) ??
    DEFAULT_LOCALE
  )
}

/** Written only by the language switcher — the `/` redirect just reads it. */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`
}
