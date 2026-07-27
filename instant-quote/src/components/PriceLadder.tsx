import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useDemoPrice, usePriceCompare } from '@/hooks/useApi'
import { useOnceInView } from '@/hooks/useOnceInView'
import { formatDecimal, formatInt, formatPln } from '@/lib/format'
import { MATERIALS } from '@/lib/catalog-static'
import { useLocale, useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'
import { buildLadderRows } from './ladder/rows'
import { FALLBACK_QUOTE, SAMPLE_FILE } from './how-it-works/demo'

/**
 * Section 01 — "Same part, seven prices" (design 18a): the demo bracket from
 * the hero, re-quoted in every material by the live engine (one
 * POST /api/v1/price/compare). Teaches material choice and pricing honesty in
 * one table; the highlighted PETG row IS the hero's quote, so both sections
 * are visibly the same engine. Owns the `how-it-works` anchor the nav
 * targets. Header figures (weight/hours) are the PETG demo quote's — the
 * intro attributes them; material weight varies by density per row.
 */
export function PriceLadder() {
  const strings = useStrings()
  const locale = useLocale()
  const l = strings.ladder
  const rows = buildLadderRows(usePriceCompare())
  const demo = useDemoPrice()
  const weight = formatInt(
    Math.round(demo?.weightG ?? FALLBACK_QUOTE.weightG),
    locale,
  )
  const hours = formatDecimal(
    demo?.printHours ?? FALLBACK_QUOTE.printHours,
    locale,
    1,
  )
  const { ref, revealed } = useOnceInView()
  // ≤sm only the top 3 (cheapest-sorted; PETG sits inside them) show by
  // default — the rest expand in place (Mobile Audit finding 04).
  const [showAll, setShowAll] = useState(false)

  return (
    <section id="how-it-works" className="scroll-mt-14 border-b">
      <div className="mx-auto max-w-6xl px-4 py-11 sm:px-6 sm:py-15 md:py-24">
        <SectionHeading n={l.n} title={l.heading} />
        <p className="text-muted-foreground mt-4 max-w-[560px] text-[13.5px] leading-[1.55] text-pretty">
          {l.intro(hours)}
        </p>

        <div
          ref={ref}
          role="table"
          aria-label={l.tableLabel}
          className="border-foreground bg-card mt-8 border"
        >
          {/* dark header strip — the terminal echo. Same grid template as
            the rows so the column headers sit over what they describe:
            "vs cheapest" over the bar, gross over the price. */}
          <div
            role="row"
            className="bg-foreground text-background grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] uppercase sm:grid-cols-[150px_130px_1fr_90px] sm:px-5 lg:grid-cols-[150px_130px_1fr_240px_110px]"
          >
            <span
              role="columnheader"
              className="font-bold whitespace-nowrap max-sm:whitespace-normal sm:col-span-3"
            >
              {l.tableHead(SAMPLE_FILE.name, weight, hours)}
            </span>
            <span
              role="columnheader"
              className="text-background/70 max-lg:hidden"
            >
              {l.vsCheapest}
            </span>
            <span
              role="columnheader"
              className="text-background/70 text-right whitespace-nowrap max-sm:hidden"
            >
              {l.tableGross}
            </span>
          </div>
          {rows.map((row, i) => {
            const material = MATERIALS.find((m) => m.id === row.id)
            const family = strings.materials[row.id].family
            const petg = row.id === 'petg'
            return (
              <div
                role="row"
                key={row.id}
                className={cn(
                  // Family col 130px, not the mock's 110 — PL
                  // "Specjalistyczne" needs 123px at the 10px type floor.
                  // ≤sm the row is a stacked card (finding 04): name+price /
                  // bar+chip / use case — rows 4+ collapse behind the toggle.
                  'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[150px_130px_1fr_90px] sm:px-5 lg:grid-cols-[150px_130px_1fr_240px_110px]',
                  petg &&
                    'bg-primary/10 shadow-[inset_3px_0_0_0_var(--color-primary)]',
                  i >= 3 && !showAll && 'max-sm:hidden',
                )}
              >
                <span
                  role="cell"
                  className="text-[15px] font-bold max-sm:text-[16px]"
                >
                  {material?.label}
                </span>
                <span
                  role="cell"
                  className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase max-sm:hidden"
                >
                  {strings.materialFamilies[family]}
                </span>
                <span
                  role="cell"
                  className="text-muted-foreground text-[12.5px] max-sm:col-span-full max-sm:row-start-3 max-sm:mt-1 sm:max-lg:hidden"
                >
                  {l.useCases[row.id]}
                </span>
                <span
                  role="cell"
                  className="flex items-center gap-2 max-sm:col-span-full max-sm:row-start-2 max-sm:mt-1.5"
                >
                  <span
                    aria-hidden
                    className="bg-secondary h-2.5 flex-1 max-sm:h-1.5"
                  >
                    <span
                      className={cn(
                        'block h-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out',
                        petg ? 'bg-primary' : 'bg-foreground',
                      )}
                      style={{
                        width: revealed ? `${row.pct}%` : '0%',
                        transitionDelay: `${i * 60}ms`,
                      }}
                    />
                  </span>
                  {petg && (
                    <span className="text-primary-text font-mono text-[10px] font-bold tracking-[0.08em] whitespace-nowrap uppercase max-sm:hidden">
                      {l.quotedAboveBar}
                    </span>
                  )}
                  {/* ≤sm multiplier chip at the bar's end — names what the
                    bar shows; the PETG one doubles as the quoted-above tag. */}
                  {!row.blocked && (
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[10px] font-bold tracking-[0.06em] whitespace-nowrap uppercase tabular-nums sm:hidden',
                        petg ? 'text-primary-text' : 'text-muted-foreground',
                      )}
                    >
                      {row.mult === null
                        ? l.chipCheapest
                        : petg
                          ? l.chipQuoted(formatDecimal(row.mult, locale, 2, 2))
                          : `×${formatDecimal(row.mult, locale, 2, 2)}`}
                    </span>
                  )}
                </span>
                <span role="cell" className="text-right font-mono">
                  <span
                    className={cn(
                      'block text-[13px] font-bold tabular-nums max-sm:text-[15px]',
                      petg && 'text-primary-text',
                    )}
                  >
                    {row.blocked ? '—' : formatPln(row.pricePln, locale)}
                  </span>
                  {/* ×-multiplier vs the cheapest row: the bars under-sell
                    the 4× jump to PA12-CF; this names it. ≤sm the bar chip
                    carries it instead. */}
                  {!row.blocked && (
                    <span className="text-muted-foreground mt-0.5 block text-[10px] tabular-nums max-sm:hidden">
                      {row.mult === null
                        ? l.cheapest
                        : `×${formatDecimal(row.mult, locale, 2, 2)}`}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* ≤sm expand toggle, visually fused to the table frame. */}
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((o) => !o)}
          className="border-foreground bg-card text-primary-text focus-visible:ring-ring -mt-px flex h-12 w-full cursor-pointer items-center justify-center gap-2 border font-mono text-[10.5px] font-bold tracking-[0.14em] uppercase focus-visible:ring-2 focus-visible:outline-none sm:hidden"
        >
          {showAll ? l.showFewer : l.showAll}{' '}
          <span aria-hidden>{showAll ? '▴' : '▾'}</span>
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            to="/$locale"
            params={{ locale }}
            hash="materials"
            className="text-primary-text hover:text-foreground font-mono text-[10.5px] font-bold tracking-[0.14em] uppercase transition-colors"
          >
            {l.specLink}
          </Link>
          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase">
            {l.requote}
          </span>
        </div>
      </div>
    </section>
  )
}
