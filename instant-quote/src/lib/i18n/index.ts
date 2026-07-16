// Locale resolution — no i18n framework (Plans/DECISIONS.md).
//
// Two access paths, one invariant:
// - RENDER paths (components) MUST use useStrings()/useLocale() — React
//   context, SSR-safe (the server renders /pl and /en from one process).
// - CLIENT EVENT handlers outside the component tree (useParts toasts,
//   MakerWorld error mapping) resolve getStrings(getActiveLocale()) at call
//   time. The module store is set on route match and is never read during
//   server rendering.

import { createContext, useContext } from 'react'
import { pl } from './pl'
import { en } from './en'
import { DEFAULT_LOCALE, type Dictionary, type Locale } from './types'

export { LOCALES, DEFAULT_LOCALE, isLocale } from './types'
export type { Dictionary, Locale } from './types'

const DICTIONARIES: Record<Locale, Dictionary> = { pl, en }

export function getStrings(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

let activeLocale: Locale = DEFAULT_LOCALE

/**
 * Set on $locale route match, guarded to the client there (beforeLoad also
 * runs during SSR, where a module global would race across concurrent
 * requests). On the server this store keeps DEFAULT_LOCALE and must never
 * feed a render — render paths use useStrings()/useLocale().
 */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale
}

export function getActiveLocale(): Locale {
  return activeLocale
}

const LocaleContext = createContext<Locale | null>(null)

export const LocaleProvider = LocaleContext.Provider

export function useLocale(): Locale {
  // Fallback covers the pre-routing phase (no provider mounted yet) and
  // keeps the hook total; Phase B mounts the provider on every route.
  return useContext(LocaleContext) ?? getActiveLocale()
}

export function useStrings(): Dictionary {
  return getStrings(useLocale())
}
