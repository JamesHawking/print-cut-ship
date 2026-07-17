import { Link } from '@tanstack/react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { SectionHeading } from '@/components/SectionHeading'
import { QuoteCta } from '@/components/QuoteCta'
import { ContentBreadcrumb } from './ContentBreadcrumb'
import { useLocale, useStrings } from '@/lib/i18n'
import { formatDecimal, formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import { MATERIAL_DATA } from '@/content/materials/data'
import { materialsCopy } from '@/content/materials/copy'
import {
  MATERIALS_SECTION,
  materialIdForSlug,
  materialsIndexPath,
  PUBLISHED_MATERIALS,
  type MaterialSlug,
} from '@/content/materials/slugs'
import { SECTIONS } from '@/content/sections'
import {
  REFERENCE_PARTS,
  REFERENCE_QUANTITIES,
  referenceUnitPrice,
} from '@/content/materials/prices'
import { COMPARE_SECTION, comparisonsFor } from '@/content/compare/slugs'
import { compareCopy } from '@/content/compare/copy'

/** One template for every material landing page (seo_prompts/02). */
export function MaterialPage({ slug }: { slug: MaterialSlug }) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.materialsPages
  const id = materialIdForSlug(slug)
  const data = MATERIAL_DATA[id]
  const copy = materialsCopy(locale)[id]
  const catalog = MATERIALS.find((m) => m.id === id)!
  const sourcePage = `materials/${slug}`

  // Locale-formatted property rows: label from the dictionary, value from
  // the locale-neutral data module.
  const properties: Array<[string, string]> = [
    [s.propertyLabels.tensile, `${data.tensileMPa} MPa`],
    [s.propertyLabels.hdt, `${data.hdtC} °C`],
    [s.propertyLabels.uv, s.ratings[data.uv]],
    [s.propertyLabels.layerAdhesion, s.ratings[data.layerAdhesion]],
    [
      s.propertyLabels.minWall,
      `${formatDecimal(data.minWallMm, locale, 1)} mm`,
    ],
    [
      s.propertyLabels.tolerance,
      `±${formatDecimal(data.toleranceMm, locale, 2)} mm / 100 mm`,
    ],
    [
      s.propertyLabels.density,
      `${formatDecimal(catalog.densityGCm3, locale, 2, 2)} g/cm³`,
    ],
    [s.propertyLabels.rate, `${catalog.plnPerKg} zł/kg`],
  ]

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* hero */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                { label: s.breadcrumbHome, href: `/${locale}` },
                {
                  label: s.breadcrumbMaterials,
                  href: materialsIndexPath(locale),
                },
                { label: catalog.label },
              ]}
            />
            <h1 className="mt-8 text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
              {copy.h1}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-[17px] leading-relaxed text-pretty">
              {copy.promise}
            </p>
          </div>
        </section>

        {/* 01 — properties */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="01" title={s.propertiesTitle} />
            <dl className="mt-10 grid gap-x-10 sm:grid-cols-2">
              {properties.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 border-b py-3.5"
                >
                  <dt className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
                    {label}
                  </dt>
                  <dd className="font-mono text-sm font-bold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 02 — reference prices */}
        <section className="dark bg-background text-foreground border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="02" title={s.pricesTitle} />
            <p className="text-muted-foreground mt-6 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              {s.pricesNote}
            </p>
            <div className="mt-8 overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="text-muted-foreground grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(90px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
                  <span>{s.priceHeaderPart}</span>
                  {REFERENCE_QUANTITIES.map((qty) => (
                    <span key={qty} className="text-right">
                      {s.priceHeaderQty(qty)}
                    </span>
                  ))}
                </div>
                {REFERENCE_PARTS.map((part) => (
                  <div
                    key={part.id}
                    className="hover:bg-card grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(90px,1fr))] gap-4 border-b py-4 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold">
                        {s.partNames[part.id]}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block font-mono text-[0.6rem] tracking-wider uppercase tabular-nums">
                        {formatDecimal(part.volumeCm3, locale, 0)} cm³ ·{' '}
                        {part.bboxMm.x} × {part.bboxMm.y} × {part.bboxMm.z} mm
                      </span>
                    </span>
                    {REFERENCE_QUANTITIES.map((qty) => (
                      <span
                        key={qty}
                        className="self-center text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums"
                      >
                        {formatPln(
                          referenceUnitPrice(id, part.id, qty),
                          locale,
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10">
              <QuoteCta variant="compact" sourcePage={sourcePage} />
            </div>
          </div>
        </section>

        {/* 03 — use cases */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="03" title={s.useCasesTitle} />
            <ul className="mt-10 grid list-none gap-x-10 gap-y-5 p-0 sm:grid-cols-2">
              {copy.useCases.map((useCase) => (
                <li key={useCase} className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="bg-primary size-1.5 shrink-0 translate-y-[-2px] rounded-full"
                  />
                  <span className="text-[15px] leading-relaxed text-pretty">
                    {useCase}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 04 — design guidelines */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="04" title={s.guidelinesTitle} />
            <div className="mt-10 max-w-3xl space-y-5">
              {copy.guidelines.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground text-[15px] leading-relaxed text-pretty"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <ul className="mt-8 flex list-none flex-wrap gap-x-8 gap-y-2 p-0">
              {copy.finishes.map((finish) => (
                <li
                  key={finish}
                  className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase"
                >
                  {finish}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 05 — FAQ */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="05" title={s.faqTitle} />
            <Accordion type="single" collapsible className="mt-8 max-w-3xl">
              {copy.faq.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left text-[15px] font-bold">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed text-pretty">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* compare-with + pricing link */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-6 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              <span className="text-muted-foreground">{s.compareTitle}</span>
              {data.compareWith.map((otherId) => {
                const other = PUBLISHED_MATERIALS.find((m) => m.id === otherId)!
                const otherCatalog = MATERIALS.find((m) => m.id === otherId)!
                return (
                  <Link
                    key={otherId}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: MATERIALS_SECTION[locale],
                      detail: other.slug,
                    }}
                    className="text-primary-text hover:text-foreground font-bold transition-colors"
                  >
                    {otherCatalog.label} →
                  </Link>
                )
              })}
              {comparisonsFor(id).map((compareSlug) => (
                <Link
                  key={compareSlug}
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: COMPARE_SECTION[locale],
                    detail: compareSlug,
                  }}
                  className="text-primary-text hover:text-foreground font-bold transition-colors"
                >
                  {compareCopy(locale)[compareSlug].title} →
                </Link>
              ))}
              <Link
                to="/$locale/$section"
                params={{ locale, section: SECTIONS.pricing[locale] }}
                className="text-muted-foreground hover:text-foreground ml-auto transition-colors"
              >
                {s.pricingLink}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage={sourcePage} />
    </>
  )
}
