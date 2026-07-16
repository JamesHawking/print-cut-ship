import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { isLocale } from '@/lib/i18n'
import {
  isAnyMaterialsSection,
  MATERIALS_SECTION,
} from '@/content/materials/slugs'

/**
 * Localized content-section segment (plan 08 §6: localized slugs for content
 * pages): /pl/materialy/* and /en/materials/*. A section word from the OTHER
 * locale redirects to the corrected one — this is what keeps the
 * LocaleSwitcher (which only swaps the locale param) working on these pages,
 * and catches cross-language URL guesses. Anything else is a 404. Static
 * sibling routes (login/orders/quote) out-rank this dynamic segment.
 */
export const Route = createFileRoute('/$locale/$section')({
  beforeLoad: ({ params, location }) => {
    if (!isLocale(params.locale)) throw redirect({ to: '/', replace: true })
    const expected = MATERIALS_SECTION[params.locale]
    if (params.section === expected) return
    if (isAnyMaterialsSection(params.section)) {
      throw redirect({
        href: location.pathname.replace(`/${params.section}`, `/${expected}`),
        replace: true,
      })
    }
    throw notFound()
  },
  component: Outlet,
})
