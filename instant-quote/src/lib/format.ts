// Presentation-only formatting helpers, locale-aware. Every formatter takes
// the active locale explicitly — SSR renders /pl and /en from one process,
// so module-level locale state would bleed between concurrent renders.

import type { Locale } from '@/lib/i18n'

const TAGS: Record<Locale, string> = { pl: 'pl-PL', en: 'en-GB' }

// Intl formatters are expensive to construct — cache per locale+shape.
const numberFormatters = new Map<string, Intl.NumberFormat>()

function num(locale: Locale, min: number, max: number): Intl.NumberFormat {
  const key = `${locale}:${min}:${max}`
  let f = numberFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(TAGS[locale], {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    })
    numberFormatters.set(key, f)
  }
  return f
}

/**
 * Gross PLN with the `zł` suffix in BOTH locales (pinned in plan 08 —
 * `Intl style:'currency'` would render "PLN 1,234.56" in English).
 */
export function formatPln(amount: number, locale: Locale): string {
  return `${num(locale, 2, 2).format(amount)}\u00a0zł`
}

export function formatInt(value: number, locale: Locale): string {
  return num(locale, 0, 0).format(value)
}

/** Locale decimal separator with a fraction-digit range. */
export function formatDecimal(
  value: number,
  locale: Locale,
  max: number,
  min = 0,
): string {
  return num(locale, min, max).format(value)
}

export function formatMm(value: number, locale: Locale): string {
  const digits = value < 10 ? 1 : 0
  return `${num(locale, digits, digits).format(value)} mm`
}

export function formatDims(
  bbox: { x: number; y: number; z: number },
  locale: Locale,
): string {
  const f = (n: number) => {
    const digits = n < 10 ? 1 : 0
    return num(locale, digits, digits).format(n)
  }
  return `${f(bbox.x)} × ${f(bbox.y)} × ${f(bbox.z)} mm`
}

export function formatVolume(cm3: number, locale: Locale): string {
  const digits = cm3 < 10 ? 2 : 1
  return `${num(locale, digits, digits).format(cm3)} cm³`
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function dateFmt(
  locale: Locale,
  opts: Intl.DateTimeFormatOptions & { key: string },
): Intl.DateTimeFormat {
  const key = `${locale}:${opts.key}`
  let f = dateFormatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(TAGS[locale], opts)
    dateFormatters.set(key, f)
  }
  return f
}

/**
 * Localized ship date from the API's structured CalDate — the response's
 * `label` is the engine's canonical EN form and is never displayed
 * (Plans/08-i18n.md phase D).
 */
export function formatShipDate(
  d: { y: number; m: number; d: number },
  locale: Locale,
): string {
  return dateFmt(locale, {
    key: 'ship',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(d.y, d.m - 1, d.d)))
}

/** Localized weekday name for an ISO date (pricing-page ship examples). */
export function formatWeekday(isoDate: string, locale: Locale): string {
  return dateFmt(locale, {
    key: 'weekday',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`))
}

/**
 * Order-row "Placed" date (day + short month), pinned to the shop's Warsaw
 * business calendar — the viewer's local zone must not shift the day.
 */
export function formatPlacedDate(iso: string, locale: Locale): string {
  return dateFmt(locale, {
    key: 'placed',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso))
}

/** Blog published/updated date (ISO day, frontmatter) — day + full month + year. */
export function formatArticleDate(isoDate: string, locale: Locale): string {
  return dateFmt(locale, {
    key: 'article',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}
