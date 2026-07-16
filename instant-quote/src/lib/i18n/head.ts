// hreflang alternates for the $locale routes (feeds plan 13's SEO).

import { LOCALES, type Locale } from './types'

// TODO(plan 13): pin the canonical origin; relative alternates are tolerated
// until then.
const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? ''

/** Swaps the /pl|/en prefix of an app pathname. */
export function localizedPath(pathname: string, locale: Locale): string {
  return pathname.replace(/^\/(pl|en)(?=\/|$)/, `/${locale}`)
}

/** rel=alternate for every locale plus x-default (→ the PL variant). */
export function hreflangLinks(pathname: string) {
  return [
    ...LOCALES.map((locale) => ({
      rel: 'alternate',
      hrefLang: locale,
      href: `${SITE_URL}${localizedPath(pathname, locale)}`,
    })),
    {
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${SITE_URL}${localizedPath(pathname, 'pl')}`,
    },
  ]
}
