import { useId } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { HowWePriceDialog } from './HowWePriceDialog'
import { formatPln } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { useCatalog } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import type { OrderTotals, PartQuote } from '@/lib/api/client'

interface Props {
  breakdownQuote: PartQuote | null
  totals: OrderTotals
  pricesExVat: boolean
  onTogglePricesExVat: (value: boolean) => void
  orderableCount: number
  /** Parts quoted but outside print limits — excluded from the order total. */
  excludedCount?: number
  /** Set when the selected part is blocked and the breakdown shows another part. */
  breakdownForName?: string
  /** priceQuery.dataUpdatedAt — keyed remount fires the flash only on fresh data. */
  priceEpoch: number
  /** A reprice is in flight (keepPreviousData holds the old values). */
  recalculating?: boolean
  onOrderClick: () => void
}

export function OrderPanel({
  breakdownQuote,
  totals,
  pricesExVat,
  onTogglePricesExVat,
  orderableCount,
  excludedCount = 0,
  breakdownForName,
  priceEpoch,
  recalculating = false,
  onOrderClick,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()
  // useId: QuoteColumnContent mounts in both breakpoint trees at once, so a
  // hardcoded id would duplicate.
  const vatSwitchId = useId()
  const catalog = useCatalog()
  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  // Rows sum to the gross total: the focused part's engine lines, the other
  // parts folded into one row, then the order-level lines.
  const rows: Array<{ label: string; value: string }> = []
  if (breakdownQuote) {
    for (const line of breakdownQuote.breakdown) {
      // Labels render from the stable key (+count); line.label is debug-only.
      rows.push({
        label:
          line.key === 'plates'
            ? strings.breakdown.plates(line.count ?? 0)
            : strings.breakdown[line.key],
        value: formatPln(line.amountPln, locale),
      })
    }
    if (orderableCount > 1) {
      rows.push({
        label: strings.orderPanel.otherParts(orderableCount - 1),
        value: formatPln(
          Math.round(
            (totals.partsSubtotalPln - breakdownQuote.lineTotalPln) * 100,
          ) / 100,
          locale,
        ),
      })
    }
    if (totals.minOrderApplied) {
      rows.push({
        label: strings.orderPanel.minOrderTopUp,
        value: formatPln(totals.minOrderTopUpPln, locale),
      })
    }
    rows.push({
      label: strings.orderPanel.orderFee,
      value: formatPln(totals.orderFeePln, locale),
    })
    rows.push({
      label: strings.orderPanel.shipping,
      value: totals.freeShipping
        ? strings.orderPanel.free
        : formatPln(totals.shippingPln, locale),
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={vatSwitchId}
              checked={pricesExVat}
              onCheckedChange={onTogglePricesExVat}
            />
            <Label
              htmlFor={vatSwitchId}
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
            {breakdownForName && (
              <p className="text-muted-foreground mt-1 font-mono text-[0.625rem] tracking-[0.2em] uppercase">
                {strings.orderPanel.breakdownFor(breakdownForName)}
              </p>
            )}
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
                  {pricesExVat
                    ? strings.orderPanel.totalExVat
                    : strings.orderPanel.totalIncVat}
                </dt>
                <dd
                  key={priceEpoch}
                  className="motion-safe:animate-price-flash font-mono text-[0.8125rem] font-bold whitespace-nowrap tabular-nums"
                >
                  {formatPln(displayTotal, locale)}
                </dd>
              </div>
              <div className="text-muted-foreground flex items-baseline justify-between gap-4">
                <dt className="text-[0.71875rem]">
                  {strings.orderPanel.includesVat(
                    Math.round((catalog?.vatRate ?? 0.23) * 100),
                  )}
                </dt>
                <dd className="font-mono text-[0.6875rem] whitespace-nowrap tabular-nums">
                  {formatPln(totals.vatPln, locale)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div
          className={cn(
            'border-t pt-3 transition-opacity duration-200',
            recalculating && 'opacity-60',
          )}
        >
          <p className="text-muted-foreground text-xs">
            {strings.order.orderTotal}
          </p>
          <p
            key={priceEpoch}
            aria-live="polite"
            className="motion-safe:animate-price-flash mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums"
          >
            {formatPln(displayTotal, locale)}
          </p>
        </div>

        {totals.minOrderApplied && catalog && (
          <p className="text-muted-foreground text-xs">
            {strings.quote.minOrderHint(formatPln(catalog.minOrderPln, locale))}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {totals.freeShipping
            ? strings.orderPanel.freeShippingApplied
            : strings.quote.shippingNote}
        </p>

        {excludedCount > 0 && (
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
            {strings.orderPanel.excludedParts(excludedCount)}
          </p>
        )}

        <Button
          size="lg"
          className="w-full font-bold"
          disabled={orderableCount === 0}
          onClick={onOrderClick}
        >
          {strings.quote.orderButton(formatPln(displayTotal, locale))}
        </Button>
      </CardContent>
    </Card>
  )
}
