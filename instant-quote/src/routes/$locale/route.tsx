import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import {
  getStrings,
  isLocale,
  LocaleProvider,
  setActiveLocale,
  type Locale,
} from '@/lib/i18n'
import { hreflangLinks } from '@/lib/i18n/head'

/**
 * Locale segment layout (/pl/*, /en/*): validates the prefix, provides the
 * locale to the tree, and owns the localized title/description + hreflang
 * alternates. Invalid prefixes bounce to `/`, which re-detects.
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
  head: ({ params, match }) => {
    const s = getStrings(isLocale(params.locale) ? params.locale : 'pl')
    return {
      meta: [
        { title: s.meta.title },
        { name: 'description', content: s.meta.description },
      ],
      links: hreflangLinks(match.pathname),
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
