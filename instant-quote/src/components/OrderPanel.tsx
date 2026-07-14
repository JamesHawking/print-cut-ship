import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { BreakdownAccordion } from './BreakdownAccordion'
import { HowWePriceDialog } from './HowWePriceDialog'
import { formatPln } from '@/lib/format'
import { strings } from '@/lib/strings'
import { PRICING } from '@/lib/pricing-config'
import type { OrderTotals, PartQuote } from '@/lib/pricing'

interface Props {
  breakdownQuote: PartQuote | null
  totals: OrderTotals
  pricesExVat: boolean
  onTogglePricesExVat: (value: boolean) => void
  orderableCount: number
  onOrderClick: () => void
}

export function OrderPanel({
  breakdownQuote,
  totals,
  pricesExVat,
  onTogglePricesExVat,
  orderableCount,
  onOrderClick,
}: Props) {
  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="ex-vat"
              checked={pricesExVat}
              onCheckedChange={onTogglePricesExVat}
            />
            <Label htmlFor="ex-vat" className="text-muted-foreground text-sm">
              {pricesExVat ? strings.quote.exVat : strings.quote.incVat}
            </Label>
          </div>
          <HowWePriceDialog />
        </div>

        {breakdownQuote && (
          <BreakdownAccordion
            quote={breakdownQuote}
            totals={totals}
            pricesExVat={pricesExVat}
          />
        )}

        <div className="flex items-end justify-between border-t pt-3">
          <div>
            <p className="text-muted-foreground text-xs">
              {strings.order.orderTotal}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatPln(displayTotal)}
            </p>
          </div>
        </div>

        {totals.minOrderApplied && (
          <p className="text-muted-foreground text-xs">
            {strings.quote.minOrderHint(formatPln(PRICING.minOrderPln))}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {totals.freeShipping
            ? 'Free shipping applied'
            : strings.quote.shippingNote}
        </p>

        <Button
          size="lg"
          className="w-full"
          disabled={orderableCount === 0}
          onClick={onOrderClick}
        >
          {strings.quote.orderButton(formatPln(displayTotal))}
        </Button>
      </CardContent>
    </Card>
  )
}
