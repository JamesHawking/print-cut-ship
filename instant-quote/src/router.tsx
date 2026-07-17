import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { NotFoundPage } from './components/NotFoundPage'
import { track } from './lib/funnel'
import { isLocale } from './lib/i18n'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
  })

  // page_view per resolved navigation (initial load included) — client only;
  // SSR renders must not emit funnel events.
  if (typeof document !== 'undefined') {
    let lastPath: string | null = null
    router.subscribe('onResolved', ({ toLocation }) => {
      const path = toLocation.pathname
      if (path === lastPath) return // search/hash-only changes aren't views
      lastPath = path
      const prefix = path.split('/')[1]
      track('page_view', {
        path,
        locale: isLocale(prefix) ? prefix : null,
        referrer: document.referrer || null,
        ...(toLocation.search as Record<string, unknown>),
      })
    })
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
