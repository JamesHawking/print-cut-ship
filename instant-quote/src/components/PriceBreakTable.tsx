import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatPln, formatPercent } from '@/lib/format'
import type { PriceBreak } from '@/lib/api/client'
import { strings } from '@/lib/strings'

export function PriceBreakTable({
  priceBreaks,
  activeQuantity,
}: {
  priceBreaks: PriceBreak[]
  activeQuantity: number
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm font-medium">
        {strings.quote.priceBreaksTitle}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Discount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {priceBreaks.map((row) => {
            const active = row.quantity === activeQuantity
            return (
              <TableRow
                key={row.quantity}
                className={cn(active && 'bg-primary/5 font-medium')}
              >
                <TableCell>{row.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPln(row.unitPricePln)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {formatPercent(row.discountFraction)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
