import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'

/**
 * The industries tape. Rendered dark as a thick accent bracketing the
 * landing's light middle sections: normal direction as the entry threshold
 * above 01, reversed as the exit bracket below 02.
 *
 * It replaces the material-rate tape that used to run here. Those figures
 * already live in the Materials table and on the pricing page, so the band
 * was repeating itself; what it says now — who these parts get made for — is
 * said nowhere else, which is why the marquee carries an sr-only copy rather
 * than being purely decorative.
 *
 * Inline animation properties: the arbitrary-property variant would race the
 * animate-ticker utility.
 */
export function IndustryTicker({
  reverse = false,
  className,
}: {
  reverse?: boolean
  className?: string
}) {
  const industries = useStrings().industries
  return (
    <section
      className={cn(
        'dark bg-background text-foreground overflow-hidden',
        className,
      )}
    >
      <p className="sr-only">{industries.join(', ')}</p>
      {/* Held back to half opacity — the whole tape, so the outlined words and
        the orange marks recede with the solid ones instead of jumping
        forward. It is context for the console above it, never competition:
        this band should be legible if you look at it and ignorable if you
        don't. The animate-ticker token's own 48s is right at this size — a
        run comes out about as wide as the rate tape's did. */}
      <div
        aria-hidden
        className="motion-safe:animate-ticker flex w-max opacity-50"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        <TickerRun industries={industries} />
        <TickerRun industries={industries} />
        <TickerRun industries={industries} />
        <TickerRun industries={industries} />
      </div>
    </section>
  )
}

/** One full pass of the items — rendered four times (two per half) so the
    -50% loop is seamless and each half outspans wide viewports. */
function TickerRun({ industries }: { industries: readonly string[] }) {
  return (
    <span className="flex shrink-0 items-center">
      {industries.map((name, i) => (
        <span key={name} className="flex items-center">
          {/* Alternating solid and outlined, the hero headline's own two-tone
            — so the band reads as the same object as the words above it. */}
          <span
            className={cn(
              'py-3 text-[clamp(0.9375rem,2.2vw,1.375rem)]/[1] font-black tracking-[-0.02em] whitespace-nowrap uppercase',
              // A hairline at this size — anything heavier fills the counters
              // in KOSMOS and ELEKTRONIKA and the word reads as a smudge.
              i % 2 === 1 &&
                'text-stroke-ink [-webkit-text-stroke-width:0.8px]',
            )}
          >
            {name}
          </span>
          <span className="text-primary-text px-4 text-[clamp(0.75rem,1.6vw,1rem)] leading-none font-black">
            ·
          </span>
        </span>
      ))}
    </span>
  )
}
