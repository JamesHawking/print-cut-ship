import { createFileRoute } from '@tanstack/react-router'
import { MaterialsIndex } from '@/components/materials/MaterialsIndex'
import { PricingPage } from '@/components/pricing/PricingPage'
import { ComparisonsIndex } from '@/components/compare/ComparisonsIndex'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  type Locale,
} from '@/lib/i18n'
import { breadcrumbJsonLd, faqPageJsonLd, jsonLd, seoHead } from '@/lib/seo'
import {
  sectionAlternates,
  sectionKeyFor,
  sectionPath,
  type SectionKey,
} from '@/content/sections'
import { pricingCopy } from '@/content/pricing/copy'
import { pricingFaq } from '@/content/pricing/faq'

/**
 * The index of a localized content section — one route file serves every
 * registered section; head and component branch on the section key.
 */
export const Route = createFileRoute('/$locale/$section/')({
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const key = sectionKeyFor(locale, params.section) ?? 'materials'
    if (key === 'pricing') return pricingHead(locale)
    if (key === 'compare') return compareIndexHead(locale)
    return materialsHead(locale)
  },
  component: SectionIndex,
})

function materialsHead(locale: Locale) {
  const s = getStrings(locale).materialsPages
  const head = seoHead({
    locale,
    path: sectionPath(locale, 'materials'),
    title: s.indexTitle,
    description: s.indexDescription,
    alternates: sectionAlternates('materials'),
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(
        breadcrumbJsonLd([
          { name: s.breadcrumbHome, path: `/${locale}` },
          {
            name: s.breadcrumbMaterials,
            path: sectionPath(locale, 'materials'),
          },
        ]),
      ),
    ],
    links: head.links,
  }
}

function pricingHead(locale: Locale) {
  const strings = getStrings(locale)
  const copy = pricingCopy(locale)
  const path = sectionPath(locale, 'pricing')
  const head = seoHead({
    locale,
    path,
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: sectionAlternates('pricing'),
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(faqPageJsonLd(pricingFaq(locale))),
      jsonLd(
        breadcrumbJsonLd([
          {
            name: strings.materialsPages.breadcrumbHome,
            path: `/${locale}`,
          },
          { name: strings.pricingPage.breadcrumb, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

function compareIndexHead(locale: Locale) {
  const s = getStrings(locale).comparePages
  const path = sectionPath(locale, 'compare')
  const head = seoHead({
    locale,
    path,
    title: s.indexTitle,
    description: s.indexDescription,
    alternates: sectionAlternates('compare'),
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(
        breadcrumbJsonLd([
          {
            name: getStrings(locale).materialsPages.breadcrumbHome,
            path: `/${locale}`,
          },
          { name: s.breadcrumb, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

function SectionIndex() {
  const locale = useLocale()
  const { section } = Route.useParams()
  const key: SectionKey = sectionKeyFor(locale, section) ?? 'materials'
  if (key === 'pricing') return <PricingPage />
  if (key === 'compare') return <ComparisonsIndex />
  return <MaterialsIndex />
}
