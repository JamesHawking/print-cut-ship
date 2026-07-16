import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { isLocale } from '@/lib/i18n'
import { correctedWordFor, sectionKeyFor } from '@/content/sections'

/**
 * Localized content-section segment (plan 08 §6): /pl/materialy|cennik/*,
 * /en/materials|pricing/*. A section word from the OTHER locale redirects to
 * the corrected one — this is what keeps the LocaleSwitcher (which only
 * swaps the locale param) working on these pages, and catches cross-language
 * URL guesses. Anything unregistered is a 404. Static sibling routes
 * (login/orders/quote) out-rank this dynamic segment.
 */
export const Route = createFileRoute('/$locale/$section')({
  beforeLoad: ({ params, location }) => {
    if (!isLocale(params.locale)) throw redirect({ to: '/', replace: true })
    if (sectionKeyFor(params.locale, params.section)) return
    const corrected = correctedWordFor(params.section, params.locale)
    if (corrected) {
      throw redirect({
        href: location.pathname.replace(`/${params.section}`, `/${corrected}`),
        replace: true,
      })
    }
    throw notFound()
  },
  component: Outlet,
})
