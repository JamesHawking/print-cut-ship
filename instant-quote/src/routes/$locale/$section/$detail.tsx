import { createFileRoute, notFound } from '@tanstack/react-router'
import { MaterialPage } from '@/components/materials/MaterialPage'
import { ComparePage } from '@/components/compare/ComparePage'
import { DEFAULT_LOCALE, getStrings, isLocale, type Locale } from '@/lib/i18n'
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLd,
  productJsonLd,
  seoHead,
} from '@/lib/seo'
import { sectionKeyFor } from '@/content/sections'
import { materialsCopy } from '@/content/materials/copy'
import { referenceUnitPrice } from '@/content/materials/prices'
import {
  isMaterialSlug,
  materialAlternates,
  materialIdForSlug,
  materialPath,
  materialsIndexPath,
  type MaterialSlug,
} from '@/content/materials/slugs'
import { compareCopy } from '@/content/compare/copy'
import { COMPARE_DATES } from '@/content/compare/data'
import { compareFaq } from '@/content/compare/faq'
import {
  compareAlternates,
  compareIndexPath,
  comparePath,
  isCompareSlug,
  type CompareSlug,
} from '@/content/compare/slugs'
import { MATERIALS } from '@/lib/catalog-static'

// The one dynamic child of $section (TanStack allows a single param segment
// per directory), shared by every section with detail pages. Branches on the
// section key: materials → MaterialPage, compare → ComparePage.
export const Route = createFileRoute('/$locale/$section/$detail')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) return // $locale layout redirects
    switch (sectionKeyFor(params.locale, params.section)) {
      case 'materials':
        if (!isMaterialSlug(params.detail)) throw notFound()
        return
      case 'compare':
        if (!isCompareSlug(params.detail)) throw notFound()
        return
      default:
        // Sections without detail pages (/pl/cennik/x 404s).
        throw notFound()
    }
  },
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const key = sectionKeyFor(locale, params.section)
    if (key === 'materials' && isMaterialSlug(params.detail)) {
      return materialHead(locale, params.detail)
    }
    if (key === 'compare' && isCompareSlug(params.detail)) {
      return compareHead(locale, params.detail)
    }
    return {}
  },
  component: DetailRoute,
})

function materialHead(locale: Locale, slug: MaterialSlug) {
  const id = materialIdForSlug(slug)
  const copy = materialsCopy(locale)[id]
  const label = MATERIALS.find((m) => m.id === id)!.label
  const s = getStrings(locale).materialsPages
  const path = materialPath(locale, slug)

  const head = seoHead({
    locale,
    path,
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: materialAlternates(slug),
  })
  return {
    meta: [
      ...head.meta,
      // Offer price: the qty-1 bracket reference part (engine-generated).
      jsonLd(
        productJsonLd({
          name: copy.h1,
          description: copy.metaDescription,
          path,
          pricePln: referenceUnitPrice(id, 'bracket', 1),
        }),
      ),
      jsonLd(faqPageJsonLd(copy.faq)),
      jsonLd(
        breadcrumbJsonLd([
          { name: s.breadcrumbHome, path: `/${locale}` },
          { name: s.breadcrumbMaterials, path: materialsIndexPath(locale) },
          { name: label, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

// Editorial page: Article (not Product) + FAQPage + BreadcrumbList.
function compareHead(locale: Locale, slug: CompareSlug) {
  const copy = compareCopy(locale)[slug]
  const s = getStrings(locale)
  const path = comparePath(locale, slug)

  const head = seoHead({
    locale,
    path,
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: compareAlternates(slug),
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(
        articleJsonLd({
          headline: copy.h1,
          description: copy.metaDescription,
          path,
          locale,
          datePublished: COMPARE_DATES[slug].datePublished,
          dateModified: COMPARE_DATES[slug].dateModified,
        }),
      ),
      jsonLd(faqPageJsonLd(compareFaq(locale, slug))),
      jsonLd(
        breadcrumbJsonLd([
          { name: s.materialsPages.breadcrumbHome, path: `/${locale}` },
          { name: s.comparePages.breadcrumb, path: compareIndexPath(locale) },
          { name: copy.title, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

function DetailRoute() {
  const { detail } = Route.useParams()
  if (isMaterialSlug(detail)) return <MaterialPage slug={detail} />
  if (isCompareSlug(detail)) return <ComparePage slug={detail} />
  return null
}
