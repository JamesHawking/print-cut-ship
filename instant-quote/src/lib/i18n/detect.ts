// Locale detection for the `/` redirect: cookie (switcher override) →
// Accept-Language → DEFAULT_LOCALE. Pure functions so they unit-test without
// a request context.

import { DEFAULT_LOCALE, isLocale, type Locale } from './types'

export const LOCALE_COOKIE = 'locale'

/**
 * Highest-q supported base language. Order alone carries no meaning in
 * RFC 9110 — a proxy or API client may legally send a lower-q entry first —
 * so entries are sorted by quality (stable, preserving order within equal q).
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null
  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        q: Number.isNaN(q) ? 0 : q,
      }
    })
    .sort((a, b) => b.q - a.q)
  for (const c of candidates) {
    if (isLocale(c.base)) return c.base
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
