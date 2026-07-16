import { createFileRoute, notFound } from '@tanstack/react-router'
import { MaterialPage } from '@/components/materials/MaterialPage'
import { DEFAULT_LOCALE, getStrings, isLocale } from '@/lib/i18n'
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLd,
  productJsonLd,
  seoHead,
} from '@/lib/seo'
import { materialsCopy } from '@/content/materials/copy'
import { referenceUnitPrice } from '@/content/materials/prices'
import {
  isMaterialSlug,
  materialAlternates,
  materialIdForSlug,
  materialPath,
  materialsIndexPath,
} from '@/content/materials/slugs'
import { MATERIALS } from '@/lib/catalog-static'

export const Route = createFileRoute('/$locale/$section/$materialId')({
  beforeLoad: ({ params }) => {
    if (!isMaterialSlug(params.materialId)) throw notFound()
  },
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    if (!isMaterialSlug(params.materialId)) return {}
    const slug = params.materialId
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
  },
  component: MaterialRoute,
})

function MaterialRoute() {
  const { materialId } = Route.useParams()
  if (!isMaterialSlug(materialId)) return null
  return <MaterialPage slug={materialId} />
}
