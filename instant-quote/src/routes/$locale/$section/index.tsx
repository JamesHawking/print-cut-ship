import { createFileRoute } from '@tanstack/react-router'
import { MaterialsIndex } from '@/components/materials/MaterialsIndex'
import { DEFAULT_LOCALE, getStrings, isLocale } from '@/lib/i18n'
import { breadcrumbJsonLd, jsonLd, seoHead } from '@/lib/seo'
import {
  materialsIndexAlternates,
  materialsIndexPath,
} from '@/content/materials/slugs'

export const Route = createFileRoute('/$locale/$section/')({
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale).materialsPages
    const head = seoHead({
      locale,
      path: materialsIndexPath(locale),
      title: s.indexTitle,
      description: s.indexDescription,
      alternates: materialsIndexAlternates(),
    })
    return {
      meta: [
        ...head.meta,
        jsonLd(
          breadcrumbJsonLd([
            { name: s.breadcrumbHome, path: `/${locale}` },
            { name: s.breadcrumbMaterials, path: materialsIndexPath(locale) },
          ]),
        ),
      ],
      links: head.links,
    }
  },
  component: MaterialsIndex,
})
