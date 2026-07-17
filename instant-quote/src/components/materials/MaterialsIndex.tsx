import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { FAMILY_DOT, FAMILY_ORDER } from '@/components/Materials'
import { ContentBreadcrumb } from './ContentBreadcrumb'
import { cn } from '@/lib/utils'
import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import { formatDecimal, formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import { MATERIAL_DATA } from '@/content/materials/data'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
} from '@/content/materials/slugs'
import { referenceUnitPrice } from '@/content/materials/prices'

type MaterialId = keyof Dictionary['materials']

/**
 * /materials index in the "Spec grid" direction (SEO Pages Revamp 3a):
 * every card a mini-datasheet with the family signal dot from the landing
 * legend; published cards add a tensile/HDT spec strip, a live from-price
 * and a details link. The legend sits beside the h1.
 */
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
                { label: s.breadcrumbHome, to: 'home' },
                { label: s.breadcrumbMaterials },
              ]}
            />
            <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
              <h1 className="mt-8 max-w-2xl text-[clamp(2.2rem,6vw,4rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
                {s.indexHeading}
              </h1>
              <span className="text-muted-foreground flex gap-6 pb-1.5 font-mono text-[0.6rem] tracking-[0.14em] whitespace-nowrap uppercase">
                {FAMILY_ORDER.map((family) => (
                  <span key={family} className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 rounded-full',
                        FAMILY_DOT[family],
                      )}
                    />
                    {strings.materialFamilies[family]}
                  </span>
                ))}
              </span>
            </div>
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
                const entry = strings.materials[material.id as MaterialId]
                const name = (
                  <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                    <span
                      aria-hidden
                      className={cn(
                        'size-[7px] shrink-0 rounded-full',
                        FAMILY_DOT[entry.family],
                      )}
                    />
                    {material.label}
                  </span>
                )
                const meta = (
                  <span className="text-muted-foreground font-mono text-[0.6rem] tracking-wider uppercase tabular-nums">
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
                        {name}
                        <span className="bg-secondary text-secondary-foreground shrink-0 rounded px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em] uppercase">
                          {s.comingSoon}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                        {entry.tagline}
                      </span>
                      <span className="mt-4 block">{meta}</span>
                    </div>
                  )
                }
                const data = MATERIAL_DATA[published.id]
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
                      {name}
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
                      {entry.tagline}
                    </span>
                    {/* mini-datasheet strip */}
                    <span className="mt-auto grid grid-cols-2 border-t pt-3">
                      <span className="border-r pr-3">
                        <span className="block font-mono text-[15px] font-bold tabular-nums">
                          {data.tensileMPa} MPa
                        </span>
                        <span className="text-muted-foreground mt-1 block font-mono text-[0.53rem] tracking-[0.14em] uppercase">
                          {s.propertyLabelsShort.tensile}
                        </span>
                      </span>
                      <span className="pl-3">
                        <span className="block font-mono text-[15px] font-bold tabular-nums">
                          {data.hdtC} °C
                        </span>
                        <span className="text-muted-foreground mt-1 block font-mono text-[0.53rem] tracking-[0.14em] uppercase">
                          {s.propertyLabelsShort.hdt}
                        </span>
                      </span>
                    </span>
                    <span className="mt-4 flex items-baseline justify-between gap-3">
                      {meta}
                      <span className="text-primary-text group-hover:text-foreground font-mono text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors">
                        {s.detailsLink}
                      </span>
                    </span>
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
