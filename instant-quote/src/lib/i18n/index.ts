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
import type { Dictionary, Locale } from './types'

export { LOCALES, DEFAULT_LOCALE, isLocale } from './types'
export type { Dictionary, Locale } from './types'

const DICTIONARIES: Record<Locale, Dictionary> = { pl, en }

export function getStrings(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

// TODO(Phase B): locale routing takes over and flips this default to
// DEFAULT_LOCALE ('pl'). Until then the site stays English.
let activeLocale: Locale = 'en'

/** Client-side only — set on $locale route match; see invariant above. */
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
