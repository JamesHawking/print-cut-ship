import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  LocaleProvider,
  setActiveLocale,
  type Locale,
} from '@/lib/i18n'
import { jsonLd, organizationJsonLd, webSiteJsonLd } from '@/lib/seo'

/**
 * Locale segment layout (/pl/*, /en/*): validates the prefix, provides the
 * locale to the tree, and owns the site-wide JSON-LD. Page-level meta
 * (title/canonical/OG/hreflang) lives on each child route via seoHead().
 * Invalid prefixes bounce to `/`, which re-detects.
 */
export const Route = createFileRoute('/$locale')({
  params: {
    parse: (params) => ({ locale: params.locale as Locale }),
    stringify: (params) => ({ locale: params.locale }),
  },
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw redirect({ to: '/', replace: true })
    // Client event handlers outside the render tree read this store.
    setActiveLocale(params.locale)
  },
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return {
      meta: [
        jsonLd(organizationJsonLd()),
        jsonLd(webSiteJsonLd(locale, s.meta.description)),
      ],
    }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const { locale } = Route.useParams()
  return (
    <LocaleProvider value={locale}>
      <Outlet />
    </LocaleProvider>
  )
}
