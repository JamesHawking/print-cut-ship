import { cn } from '@/lib/utils'
import { MATERIALS } from '@/lib/catalog-static'

/**
 * The material-rate tape. Rendered dark on both edges of the landing's dark
 * zone (sections 01–02): normal direction as the entry threshold above 01,
 * reversed as the exit bracket below 02. Inline animationDirection — the
 * arbitrary-property variant would race the animate-ticker utility.
 */
export function RateTicker({
  reverse = false,
  className,
}: {
  reverse?: boolean
  className?: string
}) {
  return (
    <section
      aria-hidden
      className={cn(
        'dark bg-background text-foreground overflow-hidden',
        className,
      )}
    >
      <div
        className="motion-safe:animate-ticker text-muted-foreground flex w-max font-mono text-[11px] font-semibold tracking-[0.14em] uppercase"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        <TickerRun />
        <TickerRun />
        <TickerRun />
        <TickerRun />
      </div>
    </section>
  )
}

/** One full pass of the items — rendered four times (two per half) so the
    -50% loop is seamless and each half outspans wide viewports. */
function TickerRun() {
  // Material rates looped as a marquee. Decorative — the same figures live in
  // the Materials table, so the whole strip is aria-hidden. The service
  // slogans moved to the header trust strip (SiteHeader), their primary
  // carrier.
  const items = MATERIALS.map((m) => `${m.label} ${m.plnPerKg} zł/kg`)
  return (
    <span className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className="py-3 whitespace-nowrap">{t}</span>
          <span className="text-primary-text px-7">·</span>
        </span>
      ))}
    </span>
  )
}
