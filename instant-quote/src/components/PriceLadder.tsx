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

  return (
    <section id="how-it-works" className="scroll-mt-14 border-b">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
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
          {/* dark header strip — the terminal echo */}
          <div
            role="row"
            className="bg-foreground text-background flex items-center justify-between gap-4 px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] uppercase sm:px-5"
          >
            <span role="columnheader" className="font-bold">
              {l.tableHead(SAMPLE_FILE.name, weight, hours)}
            </span>
            <span
              role="columnheader"
              className="text-background/70 max-sm:hidden"
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
                  'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[150px_110px_1fr_90px] sm:px-5 lg:grid-cols-[150px_110px_1fr_240px_90px]',
                  petg &&
                    'bg-primary/10 shadow-[inset_3px_0_0_0_var(--color-primary)]',
                )}
              >
                <span role="cell" className="text-[15px] font-bold">
                  {material?.label}
                  {petg && (
                    // inline-block + nowrap: the tag drops below the name as
                    // one unit instead of breaking mid-phrase in the 150px cell.
                    <span className="text-primary-text ml-2 inline-block font-mono text-[8.5px] font-bold tracking-[0.1em] whitespace-nowrap uppercase">
                      {l.quotedAbove}
                    </span>
                  )}
                </span>
                <span
                  role="cell"
                  className="text-muted-foreground font-mono text-[9px] tracking-[0.12em] uppercase max-sm:col-span-full max-sm:row-start-2 max-sm:-mt-0.5"
                >
                  {strings.materialFamilies[family]}
                </span>
                <span
                  role="cell"
                  className="text-muted-foreground text-[12.5px] max-lg:hidden"
                >
                  {l.useCases[row.id]}
                </span>
                <span
                  role="cell"
                  aria-hidden
                  className="bg-secondary h-2.5 max-sm:hidden"
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
                <span
                  role="cell"
                  className={cn(
                    'text-right font-mono text-[13px] font-bold tabular-nums',
                    petg && 'text-primary-text',
                  )}
                >
                  {row.blocked ? '—' : formatPln(row.pricePln, locale)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            to="/$locale"
            params={{ locale }}
            hash="materials"
            className="text-primary-text hover:text-foreground font-mono text-[10.5px] font-bold tracking-[0.14em] uppercase transition-colors"
          >
            {l.specLink}
          </Link>
          <span className="text-muted-foreground font-mono text-[9.5px] tracking-[0.12em] uppercase">
            {l.requote}
          </span>
        </div>
      </div>
    </section>
  )
}
