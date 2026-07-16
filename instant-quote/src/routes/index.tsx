import { createFileRoute, redirect } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { detectLocale } from '@/lib/i18n/detect'

// Per-environment detection inputs: request headers during SSR, document
// state on the client. The start compiler strips the server branch (and its
// import) from the client bundle.
const resolveLocale = createIsomorphicFn()
  .server(() => {
    const headers = getRequest().headers
    return detectLocale({
      cookie: headers.get('cookie'),
      acceptLanguage: headers.get('accept-language'),
    })
  })
  .client(() =>
    detectLocale({
      cookie: document.cookie,
      acceptLanguage: navigator.languages.join(','),
    }),
  )

/**
 * `/` never renders — it redirects to the detected locale prefix:
 * cookie (switcher override) → Accept-Language → /pl.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$locale',
      params: { locale: resolveLocale() },
      replace: true,
    })
  },
})
