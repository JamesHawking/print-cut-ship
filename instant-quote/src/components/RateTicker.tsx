import { strings } from '@/lib/strings'
import { MATERIALS } from '@/lib/catalog-static'

// Material rates plus service slogans, looped as a marquee. Decorative — the
// same figures live in the Materials table, so the whole strip is aria-hidden.
const ITEMS = [
  ...MATERIALS.map((m) => `${m.label} ${m.plnPerKg} zł/kg`),
  ...strings.ticker,
]

export function RateTicker() {
  return (
    <section aria-hidden className="bg-card overflow-hidden border-b">
      <div className="motion-safe:animate-ticker flex w-max font-mono text-[11px] font-semibold tracking-[0.14em] uppercase">
        <TickerRun />
        <TickerRun />
      </div>
    </section>
  )
}

/** One full pass of the items — rendered twice so the -50% loop is seamless. */
function TickerRun() {
  return (
    <span className="flex shrink-0 items-center">
      {ITEMS.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className="py-3 whitespace-nowrap">{t}</span>
          <span className="text-primary-text px-7">·</span>
        </span>
      ))}
    </span>
  )
}
