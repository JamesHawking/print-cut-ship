import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatPln } from '@/lib/format'
import { PRICING } from '@/lib/pricing-config'
import type { PartQuote } from '@/lib/pricing'
import type { OrderTotals } from '@/lib/pricing'
import { strings } from '@/lib/strings'

interface Props {
  quote: PartQuote
  totals: OrderTotals
  pricesExVat: boolean
}

export function BreakdownAccordion({ quote, totals, pricesExVat }: Props) {
  const rows: Array<{ label: string; value: number; muted?: boolean }> = [
    ...quote.breakdown.map((l) => ({ label: l.label, value: l.amountPln })),
    { label: 'Shipping', value: totals.shippingPln },
  ]
  if (totals.minOrderApplied) {
    rows.push({ label: 'Minimum-order top-up', value: totals.minOrderTopUpPln })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="breakdown">
        <AccordionTrigger className="text-sm">
          {strings.quote.breakdownTitle}
        </AccordionTrigger>
        <AccordionContent>
          <dl className="space-y-1.5 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="tabular-nums">{formatPln(r.value)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5">
              <dt className="text-muted-foreground">Net total</dt>
              <dd className="tabular-nums">{formatPln(totals.netTotalPln)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                VAT ({Math.round(PRICING.vatRate * 100)}% PL)
              </dt>
              <dd className="tabular-nums">{formatPln(totals.vatPln)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <dt>{pricesExVat ? 'Total ex VAT' : 'Total incl. VAT'}</dt>
              <dd className="tabular-nums">
                {formatPln(
                  pricesExVat ? totals.netTotalPln : totals.grossTotalPln,
                )}
              </dd>
            </div>
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
