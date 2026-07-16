import { cn } from '@/lib/utils'
import { formatPln, formatPercent } from '@/lib/format'
import type { PriceBreak } from '@/lib/api/client'
import { useStrings } from '@/lib/i18n'

export function PriceBreakTable({
  priceBreaks,
  activeQuantity,
}: {
  priceBreaks: PriceBreak[]
  activeQuantity: number
}) {
  const strings = useStrings()
  return (
    <div>
      <p className="text-muted-foreground mb-2 font-mono text-[0.625rem] tracking-[0.2em] uppercase">
        {strings.quote.priceBreaksTitle}
      </p>
      <div className="overflow-hidden rounded-md border">
        <div className="bg-secondary text-muted-foreground grid grid-cols-3 gap-3 border-b px-3.5 py-2 font-mono text-[0.5625rem] tracking-[0.14em] uppercase">
          <span>{strings.priceBreak.qty}</span>
          <span className="text-right">{strings.priceBreak.unitPrice}</span>
          <span className="text-right">{strings.priceBreak.discount}</span>
        </div>
        {priceBreaks.map((row, i) => {
          const active = row.quantity === activeQuantity
          return (
            <div
              key={row.quantity}
              className={cn(
                'grid grid-cols-3 gap-3 px-3.5 py-2 text-[0.8125rem]',
                i < priceBreaks.length - 1 && 'border-b',
                active ? 'bg-primary/5 font-semibold' : 'bg-card',
              )}
            >
              <span className="tabular-nums">{row.quantity}</span>
              <span className="text-right font-mono tabular-nums">
                {formatPln(row.unitPricePln)}
              </span>
              <span className="text-muted-foreground text-right font-mono tabular-nums">
                {formatPercent(row.discountFraction)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
