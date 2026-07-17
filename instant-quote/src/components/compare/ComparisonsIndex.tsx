import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import { formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import { MATERIAL_DATA } from '@/content/materials/data'
import { referenceUnitPrice } from '@/content/materials/prices'
import { ALUMINUM, compareValues } from '@/content/compare/data'
import { compareCopy } from '@/content/compare/copy'
import {
  COMPARE_SECTION,
  COMPARISONS,
  type CompareSlug,
} from '@/content/compare/slugs'
import type { Locale } from '@/lib/i18n'

interface TileStat {
  value: string
  label: string
}

/** The A/B stat pair each decision tile carries (design 4a). */
function tileStats(
  slug: CompareSlug,
  s: Dictionary['comparePages'],
  locale: Locale,
): [TileStat, TileStat] {
  const values = compareValues()
  switch (slug) {
    case 'asa-vs-petg':
      return [
        {
          value: s.tileStatAsa(MATERIAL_DATA.asa.hdtC),
          label: MATERIALS.find((m) => m.id === 'asa')!.label,
        },
        {
          value: s.tileStatPetg(
            MATERIAL_DATA.petg.tensileMPa,
            MATERIALS.find((m) => m.id === 'petg')!.plnPerKg,
          ),
          label: MATERIALS.find((m) => m.id === 'petg')!.label,
        },
      ]
    case 'pa-cf-vs-aluminum':
      return [
        {
          value: formatPln(referenceUnitPrice('pa12_cf', 'bracket', 1), locale),
          label: s.tilePrintedQty1,
        },
        {
          value: `${ALUMINUM.bracketQty1MinPln}–${ALUMINUM.bracketQty1MaxPln} zł`,
          label: s.tileCncQty1,
        },
      ]
    case 'print-in-house-vs-order':
      return [
        {
          value: `~${formatPln(values.inHouseCostedPln, locale)}`,
          label: s.tileInHouse,
        },
        {
          value: formatPln(values.orderedBracketTotalPln, locale),
          label: s.tileOrdered,
        },
      ]
  }
}

/** /compare index as decision tiles: teaser + A/B stat pair per card. */
export function ComparisonsIndex() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const copy = compareCopy(locale)

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                { label: strings.materialsPages.breadcrumbHome, to: 'home' },
                { label: s.breadcrumb },
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
              {COMPARISONS.map(({ slug }) => {
                const [statA, statB] = tileStats(slug, s, locale)
                return (
                  <Link
                    key={slug}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: COMPARE_SECTION[locale],
                      detail: slug,
                    }}
                    className="group bg-card hover:border-primary/60 flex flex-col rounded-lg border p-6 transition-[border-color,box-shadow] hover:shadow-lg"
                  >
                    <span className="text-xl font-extrabold tracking-tight">
                      {copy[slug].title}
                    </span>
                    <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                      {copy[slug].teaser}
                    </span>
                    <span className="mt-auto grid grid-cols-2 border-t pt-3">
                      {[statA, statB].map((stat, i) => (
                        <span
                          key={stat.label}
                          className={i === 0 ? 'border-r pr-3' : 'pl-3'}
                        >
                          <span className="block font-mono text-[14px] font-bold whitespace-nowrap tabular-nums">
                            {stat.value}
                          </span>
                          <span className="text-muted-foreground mt-1 block font-mono text-[0.53rem] tracking-[0.14em] uppercase">
                            {stat.label}
                          </span>
                        </span>
                      ))}
                    </span>
                    <span className="text-primary-text group-hover:text-foreground mt-4 font-mono text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors">
                      {s.readVerdict}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="compare-index" />
    </>
  )
}
