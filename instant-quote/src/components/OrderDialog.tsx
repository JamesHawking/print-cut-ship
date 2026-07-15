import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import { formatPln } from '@/lib/format'
import { submitQuote, EU_COUNTRIES } from '@/server/quote.functions'
import { track } from '@/lib/funnel'
import type { Part } from '@/hooks/useParts'
import type { PartQuote, OrderTotals } from '@/lib/pricing'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  parts: Array<{ part: Part; quote: PartQuote }>
  totals: OrderTotals
  pricesExVat: boolean
}

export function OrderDialog({
  open,
  onOpenChange,
  parts,
  totals,
  pricesExVat,
}: Props) {
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<string>('PL')
  const [submitting, setSubmitting] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)

  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  async function submit() {
    if (!email) return
    setSubmitting(true)
    try {
      const res = await submitQuote({
        data: {
          email,
          country: country as (typeof EU_COUNTRIES)[number],
          parts: parts.map(({ part, quote }) => ({
            fileName: part.fileName,
            hash: part.hash ?? '',
            process: part.config.process,
            quantity: part.config.quantity,
            leadTime: part.config.leadTime,
            unitPricePln: quote.unitPricePln,
            lineTotalPln: quote.lineTotalPln,
          })),
          grossTotalPln: totals.grossTotalPln,
          pricesExVat,
        },
      })
      setQuoteId(res.quoteId)
      track('order_submitted', {
        quoteId: res.quoteId,
        grossTotalPln: totals.grossTotalPln,
        parts: parts.length,
      })
      toast.success(strings.order.successTitle)
    } catch {
      toast.error('Could not place the order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setQuoteId(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {quoteId ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="text-primary mx-auto size-12" />
            <div>
              <DialogTitle className="mb-1">
                {strings.order.successTitle}
              </DialogTitle>
              <p className="text-muted-foreground text-sm">
                {strings.order.successBody}
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">{quoteId}</p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{strings.order.title}</DialogTitle>
              <DialogDescription>{strings.order.body}</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="order-email">{strings.order.emailLabel}</Label>
                <Input
                  id="order-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-country">
                  {strings.order.countryLabel}
                </Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="order-country" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EU_COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {strings.order.orderTotal}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatPln(displayTotal)}
                </span>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full"
                >
                  {strings.order.submit(formatPln(displayTotal))}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
