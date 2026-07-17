import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from './ContentBreadcrumb'
import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import { formatDecimal, formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
} from '@/content/materials/slugs'
import { referenceUnitPrice } from '@/content/materials/prices'

type MaterialId = keyof Dictionary['materials']

/** /materials index: all seven catalog materials, three with pages. */
export function MaterialsIndex() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.materialsPages

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                { label: s.breadcrumbHome, href: `/${locale}` },
                { label: s.breadcrumbMaterials },
              ]}
            />
            <h1 className="mt-8 text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
              {s.indexHeading}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-[17px] leading-relaxed text-pretty">
              {s.indexIntro}
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MATERIALS.map((material) => {
                const published = PUBLISHED_MATERIALS.find(
                  (m) => m.id === material.id,
                )
                const tagline =
                  strings.materials[material.id as MaterialId].tagline
                const meta = (
                  <span className="text-muted-foreground mt-4 block font-mono text-[0.6rem] tracking-wider uppercase tabular-nums">
                    {formatDecimal(material.densityGCm3, locale, 2, 2)} g/cm³ ·{' '}
                    {material.plnPerKg} zł/kg
                  </span>
                )
                if (!published) {
                  return (
                    <div
                      key={material.id}
                      className="bg-card flex flex-col rounded-lg border p-6 opacity-70"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-lg font-extrabold tracking-tight">
                          {material.label}
                        </span>
                        <span className="bg-secondary text-secondary-foreground shrink-0 rounded px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em] uppercase">
                          {s.comingSoon}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                        {tagline}
                      </span>
                      {meta}
                    </div>
                  )
                }
                return (
                  <Link
                    key={material.id}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: MATERIALS_SECTION[locale],
                      detail: published.slug,
                    }}
                    className="group bg-card hover:border-primary/60 flex flex-col rounded-lg border p-6 transition-[border-color,box-shadow] hover:shadow-lg"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-lg font-extrabold tracking-tight">
                        {material.label}
                      </span>
                      <span className="text-primary-text font-mono text-xs font-bold whitespace-nowrap tabular-nums">
                        {s.priceFrom(
                          formatPln(
                            referenceUnitPrice(published.id, 'bracket', 1),
                            locale,
                          ),
                        )}
                      </span>
                    </span>
                    <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                      {tagline}
                    </span>
                    {meta}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="materials-index" />
    </>
  )
}
