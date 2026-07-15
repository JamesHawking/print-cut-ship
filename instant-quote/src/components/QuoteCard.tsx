import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfigPanel } from './ConfigPanel'
import { PriceBreakTable } from './PriceBreakTable'
import { DfmBadges } from './DfmBadges'
import { formatPln, formatPercent, formatVolume } from '@/lib/format'
import type { Part } from '@/hooks/useParts'
import type { PartConfig, PartQuote } from '@/lib/api/client'

interface Props {
  part: Part
  quote: PartQuote
  onConfigChange: (patch: Partial<PartConfig>) => void
}

export function QuoteCard({ part, quote, onConfigChange }: Props) {
  const discount = quote.discountFraction

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={part.fileName}>
              {part.fileName}
            </p>
            {part.metrics && (
              <p className="text-muted-foreground text-xs">
                {formatVolume(quote.billableVolumeCm3)} ·{' '}
                {part.metrics.triangleCount.toLocaleString()} triangles
                {quote.pieceCount != null && quote.plates != null && (
                  <>
                    {' '}
                    · {quote.pieceCount} parts · {quote.plates}{' '}
                    {quote.plates === 1 ? 'plate' : 'plates'}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            {quote.blocked ? (
              <p className="text-destructive text-sm font-medium">
                Not printable
              </p>
            ) : (
              <>
                <div className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                  {formatPln(quote.unitPricePln)}
                </div>
                <p className="text-muted-foreground text-xs">
                  per part
                  {discount > 0 && (
                    <span className="text-primary">
                      {' '}
                      · {formatPercent(discount)} off
                    </span>
                  )}
                </p>
                {part.config.quantity > 1 && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatPln(quote.lineTotalPln)} for {part.config.quantity}
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
      <CardContent className="space-y-6">
        <ConfigPanel config={part.config} onChange={onConfigChange} />
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
