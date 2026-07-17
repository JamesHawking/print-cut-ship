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
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { useLocale, useStrings } from '@/lib/i18n'
import { formatDecimal, formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import { MATERIAL_DATA } from '@/content/materials/data'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
} from '@/content/materials/slugs'
import {
  REFERENCE_PARTS,
  REFERENCE_QUANTITIES,
  referenceUnitPrice,
} from '@/content/materials/prices'
import { SECTIONS } from '@/content/sections'
import { ALUMINUM, compareValues } from '@/content/compare/data'
import { compareCopy } from '@/content/compare/copy'
import { compareFaq } from '@/content/compare/faq'
import {
  COMPARE_SECTION,
  COMPARISONS,
  compareIndexPath,
  compareMaterials,
  type CompareSlug,
} from '@/content/compare/slugs'

/** One template for every comparison landing page (seo_prompts/04). */
export function ComparePage({ slug }: { slug: CompareSlug }) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const m = strings.materialsPages
  const copy = compareCopy(locale)[slug]
  const values = compareValues()
  const faq = compareFaq(locale, slug)
  const sourcePage = `compare/${slug}`

  // print-in-house-vs-order has no spec section — its 01 is the cost table.
  const hasSpecSection = slug !== 'print-in-house-vs-order'
  const n = (pairIndex: string, tcoIndex: string) =>
    hasSpecSection ? pairIndex : tcoIndex

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* hero: breadcrumb, h1, TL;DR verdict above the fold */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                { label: m.breadcrumbHome, href: `/${locale}` },
                { label: s.breadcrumb, href: compareIndexPath(locale) },
                { label: copy.title },
              ]}
            />
            <h1 className="mt-8 text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
              {copy.h1}
            </h1>
            <aside className="bg-card mt-8 max-w-3xl rounded-lg border p-6">
              <p className="text-primary-text font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                {s.verdictTitle}
              </p>
              {copy.verdict(values).map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="mt-3 text-[17px] leading-relaxed font-medium text-pretty"
                >
                  {paragraph}
                </p>
              ))}
            </aside>
            {copy.intro(values).map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="text-muted-foreground mt-6 max-w-3xl text-[15px] leading-relaxed text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {/* 01 — side-by-side specs (pair pages only) */}
        {hasSpecSection && (
          <section className="border-b">
            <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
              <SectionHeading n="01" title={s.specTitle} />
              {slug === 'asa-vs-petg' ? (
                <MaterialPairSpecs />
              ) : (
                <PaCfVsAluminumSpecs />
              )}
            </div>
          </section>
        )}

        {/* cost comparison — dark section with the live numbers + CTA */}
        <section className="dark bg-background text-foreground border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n={n('02', '01')} title={s.costTitle} />
            <p className="text-muted-foreground mt-6 max-w-3xl font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              {slug === 'pa-cf-vs-aluminum' ? s.citedRangeNote : m.pricesNote}
            </p>
            <div className="mt-8 overflow-x-auto">
              {slug === 'asa-vs-petg' && <MaterialPairPrices />}
              {slug === 'pa-cf-vs-aluminum' && <PaCfVsAluminumCosts />}
              {slug === 'print-in-house-vs-order' && <TcoTable />}
            </div>
            <div className="mt-10">
              <QuoteCta variant="compact" sourcePage={sourcePage} />
            </div>
          </div>
        </section>

        {/* decision: analysis prose + choose-A / choose-B cards */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n={n('03', '02')} title={s.decisionTitle} />
            <div className="mt-10 max-w-3xl space-y-5">
              {copy.body(values).map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground text-[15px] leading-relaxed text-pretty"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {[copy.chooseA, copy.chooseB].map((choose) => (
                <div
                  key={choose.title}
                  className="bg-card rounded-lg border p-6"
                >
                  <p className="text-[15px] font-extrabold tracking-tight">
                    {choose.title}
                  </p>
                  <ul className="mt-4 list-none space-y-3 p-0">
                    {choose.items.map((item) => (
                      <li key={item} className="flex items-baseline gap-3">
                        <span
                          aria-hidden
                          className="bg-primary size-1.5 shrink-0 translate-y-[-2px] rounded-full"
                        />
                        <span className="text-muted-foreground text-[14px] leading-relaxed text-pretty">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ + sources + cross-links */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n={n('04', '03')} title={m.faqTitle} />
            <Accordion type="single" collapsible className="mt-8 max-w-3xl">
              {faq.map((item) => (
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

            {copy.footnotes.length > 0 && (
              <div className="mt-12 max-w-3xl border-t pt-6">
                <p className="text-muted-foreground font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  {s.footnotesTitle}
                </p>
                <ul className="mt-3 list-none space-y-2 p-0">
                  {copy.footnotes.map((note) => (
                    <li
                      key={note.slice(0, 24)}
                      className="text-muted-foreground text-[13px] leading-relaxed text-pretty"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* see also: material pages, pricing, the other comparisons */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-6 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              <span className="text-muted-foreground">{s.seeAlso}</span>
              {compareMaterials(slug).map((id) => {
                const published = PUBLISHED_MATERIALS.find((p) => p.id === id)!
                const label = MATERIALS.find((mat) => mat.id === id)!.label
                return (
                  <Link
                    key={id}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: MATERIALS_SECTION[locale],
                      detail: published.slug,
                    }}
                    className="text-primary-text hover:text-foreground font-bold transition-colors"
                  >
                    {label} →
                  </Link>
                )
              })}
              {COMPARISONS.filter((c) => c.slug !== slug).map((other) => (
                <Link
                  key={other.slug}
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: COMPARE_SECTION[locale],
                    detail: other.slug,
                  }}
                  className="text-primary-text hover:text-foreground font-bold transition-colors"
                >
                  {compareCopy(locale)[other.slug].title} →
                </Link>
              ))}
              <Link
                to="/$locale/$section"
                params={{ locale, section: SECTIONS.pricing[locale] }}
                className="text-muted-foreground hover:text-foreground ml-auto transition-colors"
              >
                {m.pricingLink}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage={sourcePage} />
    </>
  )
}

/** Two-material property grid: ASA and PETG from the shared material card. */
function MaterialPairSpecs() {
  const strings = useStrings()
  const locale = useLocale()
  const m = strings.materialsPages
  const columns = ['asa', 'petg'] as const

  const rows: Array<[string, (id: (typeof columns)[number]) => string]> = [
    [m.propertyLabels.tensile, (id) => `${MATERIAL_DATA[id].tensileMPa} MPa`],
    [m.propertyLabels.hdt, (id) => `${MATERIAL_DATA[id].hdtC} °C`],
    [m.propertyLabels.uv, (id) => m.ratings[MATERIAL_DATA[id].uv]],
    [
      m.propertyLabels.layerAdhesion,
      (id) => m.ratings[MATERIAL_DATA[id].layerAdhesion],
    ],
    [
      m.propertyLabels.tolerance,
      (id) =>
        `±${formatDecimal(MATERIAL_DATA[id].toleranceMm, locale, 2)} mm / 100 mm`,
    ],
    [
      m.propertyLabels.density,
      (id) =>
        `${formatDecimal(MATERIALS.find((c) => c.id === id)!.densityGCm3, locale, 2, 2)} g/cm³`,
    ],
    [
      m.propertyLabels.rate,
      (id) => `${MATERIALS.find((c) => c.id === id)!.plnPerKg} zł/kg`,
    ],
  ]

  return (
    <div className="mt-10 overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="text-muted-foreground grid grid-cols-[minmax(180px,2fr)_repeat(2,minmax(120px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
          <span />
          {columns.map((id) => (
            <span key={id} className="text-foreground text-right font-bold">
              {MATERIALS.find((c) => c.id === id)!.label}
            </span>
          ))}
        </div>
        {rows.map(([label, valueFor]) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(180px,2fr)_repeat(2,minmax(120px,1fr))] gap-4 border-b py-3.5"
          >
            <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {label}
            </span>
            {columns.map((id) => (
              <span
                key={id}
                className="text-right font-mono text-sm font-bold tabular-nums"
              >
                {valueFor(id)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** PA12-CF (our card) against machined 6061 aluminum (cited datasheet [1]). */
function PaCfVsAluminumSpecs() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const m = strings.materialsPages
  const paCf = MATERIAL_DATA.pa12_cf
  const paCfCatalog = MATERIALS.find((c) => c.id === 'pa12_cf')!
  const values = compareValues()

  const rows: Array<[string, string, string]> = [
    [
      m.propertyLabels.tensile,
      `${paCf.tensileMPa} MPa`,
      `${ALUMINUM.tensileMPa} MPa [1]`,
    ],
    [
      m.propertyLabels.density,
      `${formatDecimal(paCfCatalog.densityGCm3, locale, 2, 2)} g/cm³`,
      `${formatDecimal(ALUMINUM.densityGCm3, locale, 2, 2)} g/cm³ [1]`,
    ],
    [
      m.propertyLabels.tolerance,
      `±${formatDecimal(paCf.toleranceMm, locale, 2)} mm / 100 mm`,
      `±${formatDecimal(ALUMINUM.toleranceMm, locale, 2)} mm [1]`,
    ],
    [
      s.maxTempLabel,
      s.hdtValue(paCf.hdtC),
      `${s.aluMaxTempValue(ALUMINUM.maxServiceC)} [1]`,
    ],
    [s.conductivityLabel, s.conductivityNo, s.conductivityYes],
    [
      s.leadTimeLabel,
      s.ourLeadValue(values.expressDays),
      `${s.aluLeadValue(values.aluLeadMinDays, values.aluLeadMaxDays)} [2]`,
    ],
  ]

  return (
    <div className="mt-10 overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="text-muted-foreground grid grid-cols-[minmax(180px,2fr)_repeat(2,minmax(150px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
          <span />
          <span className="text-foreground text-right font-bold">
            {paCfCatalog.label}
          </span>
          <span className="text-foreground text-right font-bold">
            {s.aluminumHeader}
          </span>
        </div>
        {rows.map(([label, ours, theirs]) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(180px,2fr)_repeat(2,minmax(150px,1fr))] gap-4 border-b py-3.5"
          >
            <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {label}
            </span>
            <span className="text-right font-mono text-sm font-bold tabular-nums">
              {ours}
            </span>
            <span className="text-right font-mono text-sm font-bold tabular-nums">
              {theirs}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Live engine prices for both materials on the shared reference parts. */
function MaterialPairPrices() {
  const strings = useStrings()
  const locale = useLocale()
  const m = strings.materialsPages
  const pair = ['asa', 'petg'] as const

  return (
    <div className="min-w-[560px]">
      <div className="text-muted-foreground grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(90px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
        <span>{m.priceHeaderPart}</span>
        {REFERENCE_QUANTITIES.map((qty) => (
          <span key={qty} className="text-right">
            {m.priceHeaderQty(qty)}
          </span>
        ))}
      </div>
      {REFERENCE_PARTS.map((part) =>
        pair.map((id) => (
          <div
            key={`${part.id}-${id}`}
            className="hover:bg-card grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(90px,1fr))] gap-4 border-b py-4 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">
                {m.partNames[part.id]} ·{' '}
                {MATERIALS.find((c) => c.id === id)!.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block font-mono text-[0.6rem] tracking-wider uppercase tabular-nums">
                {formatDecimal(part.volumeCm3, locale, 0)} cm³ · {part.bboxMm.x}{' '}
                × {part.bboxMm.y} × {part.bboxMm.z} mm
              </span>
            </span>
            {REFERENCE_QUANTITIES.map((qty) => (
              <span
                key={qty}
                className="self-center text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums"
              >
                {formatPln(referenceUnitPrice(id, part.id, qty), locale)}
              </span>
            ))}
          </div>
        )),
      )}
    </div>
  )
}

/** PA12-CF engine prices vs the cited EU CNC range, per quantity. */
function PaCfVsAluminumCosts() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const m = strings.materialsPages
  const bracket = REFERENCE_PARTS.find((p) => p.id === 'bracket')!
  const aluRange: Record<number, [number, number]> = {
    1: [ALUMINUM.bracketQty1MinPln, ALUMINUM.bracketQty1MaxPln],
    10: [ALUMINUM.bracketQty10MinPln, ALUMINUM.bracketQty10MaxPln],
    50: [ALUMINUM.bracketQty50MinPln, ALUMINUM.bracketQty50MaxPln],
  }

  return (
    <div className="min-w-[520px]">
      <div className="text-muted-foreground grid grid-cols-[minmax(140px,1fr)_repeat(2,minmax(150px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
        <span>
          {m.partNames.bracket} · {formatDecimal(bracket.volumeCm3, locale, 0)}{' '}
          cm³
        </span>
        <span className="text-right">
          {MATERIALS.find((c) => c.id === 'pa12_cf')!.label}
        </span>
        <span className="text-right">{s.aluminumHeader}</span>
      </div>
      {REFERENCE_QUANTITIES.map((qty) => (
        <div
          key={qty}
          className="hover:bg-card grid grid-cols-[minmax(140px,1fr)_repeat(2,minmax(150px,1fr))] gap-4 border-b py-4 transition-colors"
        >
          <span className="text-[15px] font-bold">{m.priceHeaderQty(qty)}</span>
          <span className="self-center text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums">
            {formatPln(referenceUnitPrice('pa12_cf', 'bracket', qty), locale)}
          </span>
          <span className="text-muted-foreground self-center text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums">
            {formatPln(aluRange[qty][0], locale)}–
            {formatPln(aluRange[qty][1], locale)} [2]
          </span>
        </div>
      ))}
    </div>
  )
}

/** In-house TCO ledger for the worked example part vs ordering it. */
function TcoTable() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const v = compareValues()

  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    {
      label: s.tcoMaterial(50),
      value: formatPln(v.inHouseMaterialPln, locale),
    },
    { label: s.tcoMachine(4), value: formatPln(v.inHouseMachinePln, locale) },
    {
      label: s.tcoOperator(30),
      value: formatPln(v.inHouseOperatorPln, locale),
    },
    { label: s.tcoFailure(v.failureRatePct), value: `+${v.failureRatePct}%` },
    {
      label: s.tcoTotalHobby,
      value: `~${formatPln(v.inHouseHobbyPln, locale)}`,
      strong: true,
    },
    {
      label: s.tcoTotalCosted,
      value: `~${formatPln(v.inHouseCostedPln, locale)}`,
      strong: true,
    },
    {
      label: s.tcoOrdered,
      value: formatPln(v.orderedBracketTotalPln, locale),
      strong: true,
    },
  ]

  return (
    <div className="max-w-3xl min-w-[440px]">
      <div className="text-muted-foreground grid grid-cols-[minmax(260px,3fr)_minmax(120px,1fr)] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
        <span>{s.componentHeader}</span>
        <span className="text-right">{s.amountHeader}</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(260px,3fr)_minmax(120px,1fr)] gap-4 border-b py-3.5"
        >
          <span
            className={
              row.strong
                ? 'text-[15px] font-bold'
                : 'text-muted-foreground text-[14px]'
            }
          >
            {row.label}
          </span>
          <span className="self-center text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
