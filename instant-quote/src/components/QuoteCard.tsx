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
  /** Bound to this part — shown only when the background upload failed. */
  onRetryUpload?: () => void
  /** priceQuery.dataUpdatedAt — keyed remount fires the flash only on fresh data. */
  priceEpoch: number
  /** A reprice is in flight (keepPreviousData holds the old values). */
  recalculating?: boolean
  /** Editor only: flags render in the viewport checks rail, not as badges. */
  showDfmBadges?: boolean
  /** Editor only: shows the materials-bench toggle next to the process label. */
  compareOpen?: boolean
  onToggleCompare?: () => void
}

export function QuoteCard({
  part,
  quote,
  onConfigChange,
  onRetryUpload,
  priceEpoch,
  recalculating = false,
  showDfmBadges = true,
  compareOpen,
  onToggleCompare,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const discount = quote.discountFraction
  const ext = (part.fileName.split('.').pop() ?? '').toUpperCase()
  // Next-tier nudge: the cheapest quantity break that improves the discount.
  // The unit-price check matters when the per-part floor flattens the tiers —
  // a "−5%" that still costs the same is not an unlock.
  const nudge =
    quote.priceBreaks.find(
      (b) =>
        b.quantity > part.config.quantity &&
        b.discountFraction > discount &&
        b.unitPricePln < quote.unitPricePln,
    ) ?? null

  return (
    // Mounts when the skeleton hands over — settle in instead of snapping
    // (fade only under reduced motion).
    <Card className="animate-in fade-in zoom-in-[0.98] motion-reduce:zoom-in-100 duration-200 ease-out">
      <CardHeader className="leading-[normal]">
        {/* min-w-0: CardHeader is a grid — without it the filename's nowrap
          truncation sets the column's min-content and blows out the card.
          No wrap: the price stays top-right and the filename truncates,
          matching the workbench design. */}
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-secondary shrink-0 rounded px-1.5 py-[3px] font-mono text-[0.59375rem] font-bold tracking-wider">
                {ext}
              </span>
              <p
                className="truncate text-[0.9375rem] font-bold"
                title={part.fileName}
              >
                {part.fileName}
              </p>
            </div>
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
            {part.uploadStatus === 'failed' && onRetryUpload && (
              <button
                type="button"
                className="text-destructive mt-1.5 font-mono text-[0.59375rem] tracking-wider uppercase underline underline-offset-2"
                onClick={onRetryUpload}
              >
                {strings.partsList.uploadFailed} ·{' '}
                {strings.partsList.retryUpload}
              </button>
            )}
          </div>
          <div
            className={cn(
              'flex shrink-0 flex-col items-end gap-1 text-right transition-opacity duration-200',
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
                  className="text-primary-text motion-safe:animate-price-flash-accent font-mono text-[clamp(1.375rem,3.5vw,1.625rem)] leading-[1.15] font-bold tracking-tight whitespace-nowrap tabular-nums"
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
                  <p className="text-xs font-semibold tabular-nums">
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
        {nudge && (
          <button
            type="button"
            onClick={() => onConfigChange({ quantity: nudge.quantity })}
            // mt-1: CardHeader's grid gap-2 already adds 8px — together the
            // 12px offset from the workbench design.
            className="border-signal/60 bg-signal/[0.07] hover:border-signal hover:bg-signal/[0.14] mt-1 flex w-full min-w-0 cursor-pointer items-center justify-between gap-2.5 rounded-md border border-dashed px-2.5 py-2 text-left font-mono text-[0.59375rem] font-bold tracking-wider uppercase transition-colors"
          >
            <span className="inline-flex items-center gap-[7px]">
              <span
                aria-hidden
                className="bg-signal inline-block size-1.5 rounded-full"
              />
              {strings.editor.nudge(
                nudge.quantity,
                formatPercent(nudge.discountFraction),
              )}
            </span>
            <span className="tabular-nums">
              {strings.editor.nudgeApply(formatPln(nudge.unitPricePln, locale))}
            </span>
          </button>
        )}
        {showDfmBadges && quote.dfmFlags.length > 0 && (
          <div className="pt-2">
            <DfmBadges flags={quote.dfmFlags} />
          </div>
        )}
      </CardHeader>
      {/* leading-[normal]: the workbench design never sets a line-height in
        the config section, so text sits at font-metric height (~1.2), not
        the body's 1.5 — this is most of its tighter vertical rhythm. */}
      <CardContent className="space-y-5 border-t pt-5 leading-[normal]">
        <ConfigPanel
          config={part.config}
          onChange={onConfigChange}
          quote={quote}
          compareOpen={compareOpen}
          onToggleCompare={onToggleCompare}
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
