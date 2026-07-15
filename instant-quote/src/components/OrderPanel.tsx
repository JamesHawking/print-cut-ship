import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { HowWePriceDialog } from './HowWePriceDialog'
import { formatPln } from '@/lib/format'
import { strings } from '@/lib/strings'
import { useCatalog } from '@/hooks/useApi'
import type { OrderTotals, PartQuote } from '@/lib/api/client'

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
  const catalog = useCatalog()
  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  // Rows sum to the gross total: the focused part's engine lines, the other
  // parts folded into one row, then the order-level lines.
  const rows: Array<{ label: string; value: string }> = []
  if (breakdownQuote) {
    for (const line of breakdownQuote.breakdown) {
      rows.push({ label: line.label, value: formatPln(line.amountPln) })
    }
    if (orderableCount > 1) {
      rows.push({
        label: `Other parts — ${orderableCount - 1}`,
        value: formatPln(
          Math.round(
            (totals.partsSubtotalPln - breakdownQuote.lineTotalPln) * 100,
          ) / 100,
        ),
      })
    }
    if (totals.minOrderApplied) {
      rows.push({
        label: 'Minimum-order top-up',
        value: formatPln(totals.minOrderTopUpPln),
      })
    }
    rows.push({ label: 'Order fee', value: formatPln(totals.orderFeePln) })
    rows.push({
      label: 'Shipping',
      value: totals.freeShipping ? 'Free' : formatPln(totals.shippingPln),
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="ex-vat"
              checked={pricesExVat}
              onCheckedChange={onTogglePricesExVat}
            />
            <Label
              htmlFor="ex-vat"
              className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider uppercase"
            >
              {pricesExVat ? strings.quote.exVat : strings.quote.incVat}
            </Label>
          </div>
          <HowWePriceDialog />
        </div>

        {rows.length > 0 && (
          <div>
            <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
              {strings.quote.breakdownTitle}
            </p>
            <dl className="mt-3 flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-muted-foreground min-w-0 truncate text-[0.8125rem]">
                    {row.label}
                  </dt>
                  <dd className="font-mono text-[0.78125rem] whitespace-nowrap tabular-nums">
                    {row.value}
                  </dd>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-2.5">
                <dt className="text-[0.8125rem] font-bold">
                  {pricesExVat ? 'Total ex VAT' : 'Total incl. VAT'}
                </dt>
                <dd className="font-mono text-[0.8125rem] font-bold whitespace-nowrap tabular-nums">
                  {formatPln(displayTotal)}
                </dd>
              </div>
              <div className="text-muted-foreground flex items-baseline justify-between gap-4">
                <dt className="text-[0.71875rem]">
                  Includes VAT ({Math.round((catalog?.vatRate ?? 0.23) * 100)}%
                  PL)
                </dt>
                <dd className="font-mono text-[0.6875rem] whitespace-nowrap tabular-nums">
                  {formatPln(totals.vatPln)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="border-t pt-3">
          <p className="text-muted-foreground text-xs">
            {strings.order.orderTotal}
          </p>
          <p
            aria-live="polite"
            className="mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums"
          >
            {formatPln(displayTotal)}
          </p>
        </div>

        {totals.minOrderApplied && catalog && (
          <p className="text-muted-foreground text-xs">
            {strings.quote.minOrderHint(formatPln(catalog.minOrderPln))}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {totals.freeShipping
            ? 'Free shipping applied'
            : strings.quote.shippingNote}
        </p>

        <Button
          size="lg"
          className="w-full font-bold"
          disabled={orderableCount === 0}
          onClick={onOrderClick}
        >
          {strings.quote.orderButton(formatPln(displayTotal))}
        </Button>
      </CardContent>
    </Card>
  )
}
