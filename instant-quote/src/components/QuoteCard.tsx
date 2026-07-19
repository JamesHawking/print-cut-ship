import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfigPanel } from './ConfigPanel'
import { PriceBreakTable } from './PriceBreakTable'
import { DfmBadges } from './DfmBadges'
import { formatInt, formatPln, formatPercent, formatVolume } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Part } from '@/hooks/useParts'
import type { PartConfig, PartQuote } from '@/lib/api/client'

interface Props {
  part: Part
  quote: PartQuote
  onConfigChange: (patch: Partial<PartConfig>) => void
  /** priceQuery.dataUpdatedAt — keyed remount fires the flash only on fresh data. */
  priceEpoch: number
  /** A reprice is in flight (keepPreviousData holds the old values). */
  recalculating?: boolean
}

export function QuoteCard({
  part,
  quote,
  onConfigChange,
  priceEpoch,
  recalculating = false,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const discount = quote.discountFraction

  return (
    // Mounts when the skeleton hands over — settle in instead of snapping
    // (fade only under reduced motion).
    <Card className="animate-in fade-in zoom-in-[0.98] motion-reduce:zoom-in-100 duration-200 ease-out">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-44">
            <p
              className="truncate text-[0.9375rem] font-bold"
              title={part.fileName}
            >
              {part.fileName}
            </p>
            {part.metrics && (
              <p className="text-muted-foreground mt-1.5 font-mono text-[0.625rem] tracking-wider tabular-nums">
                {formatVolume(quote.billableVolumeCm3, locale)} ·{' '}
                {strings.quote.metaTriangles(
                  part.metrics.triangleCount,
                  formatInt(part.metrics.triangleCount, locale),
                )}
                {quote.pieceCount != null && quote.plates != null && (
                  <>
                    {' '}
                    · {strings.quote.metaPieces(quote.pieceCount)} ·{' '}
                    {strings.quote.metaPlates(quote.plates)}
                  </>
                )}
              </p>
            )}
          </div>
          <div
            className={cn(
              'shrink-0 text-right transition-opacity duration-200',
              recalculating && 'opacity-60',
            )}
            aria-live="polite"
          >
            {quote.blocked ? (
              <p className="text-destructive text-sm font-bold">
                {strings.quote.notPrintable}
              </p>
            ) : (
              <>
                <div
                  key={priceEpoch}
                  className="text-primary-text motion-safe:animate-price-flash-accent font-mono text-[clamp(1.375rem,3.5vw,1.75rem)] font-bold tracking-tight whitespace-nowrap tabular-nums"
                >
                  {formatPln(quote.unitPricePln, locale)}
                </div>
                <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs">
                  {strings.quote.unitPrice}
                  {discount > 0 && (
                    <> · {strings.quote.discountOff(formatPercent(discount))}</>
                  )}
                  {recalculating && (
                    <span className="text-muted-foreground ml-1 inline-flex items-center gap-1 font-mono text-[0.59375rem] tracking-wider uppercase">
                      <span
                        className="bg-signal motion-safe:animate-led inline-block size-[5px] rounded-full"
                        aria-hidden
                      />
                      {strings.quote.recalculating}
                    </span>
                  )}
                </p>
                {part.config.quantity > 1 && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {strings.quote.lineTotalFor(
                      formatPln(quote.lineTotalPln, locale),
                      part.config.quantity,
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {quote.dfmFlags.length > 0 && (
          <div className="pt-2">
            <DfmBadges flags={quote.dfmFlags} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5 border-t pt-5">
        <ConfigPanel
          config={part.config}
          onChange={onConfigChange}
          quote={quote}
        />
        {!quote.blocked && (
          <PriceBreakTable
            priceBreaks={quote.priceBreaks}
            activeQuantity={part.config.quantity}
          />
        )}
      </CardContent>
    </Card>
  )
}
