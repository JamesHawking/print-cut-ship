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
import { useLocale, useStrings } from '@/lib/i18n'
import { ApiRequestError, apiErrorMessage } from '@/lib/api/errors'
import { formatPln } from '@/lib/format'
import {
  api,
  toApiMetrics,
  EU_COUNTRIES,
  type EuCountry,
  type OrderTotals,
  type PartQuote,
} from '@/lib/api/client'
import { track } from '@/lib/funnel'
import type { Part } from '@/hooks/useParts'

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
  const strings = useStrings()
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<string>('PL')
  const [submitting, setSubmitting] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)

  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  async function submit() {
    if (!email) return
    setSubmitting(true)
    try {
      // The backend re-prices the order from the raw metrics; the displayed
      // total rides along only so server logs catch UI/engine drift.
      const res = await api.POST('/api/v1/quotes', {
        body: {
          email,
          country: country as EuCountry,
          parts: parts.map(({ part }) => ({
            fileName: part.fileName,
            hash: part.hash ?? '',
            ...(part.fileId && { fileId: part.fileId }),
            metrics: toApiMetrics(part.metrics!),
            process: part.config.process,
            quantity: part.config.quantity,
            leadTime: part.config.leadTime,
          })),
          clientGrossTotalPln: totals.grossTotalPln,
          // Persisted with the quote — downstream emails/invoices render in
          // the language the customer ordered in (plans 05/06).
          locale,
        },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      setQuoteId(res.data.quoteId)
      track('order_submitted', {
        quoteId: res.data.quoteId,
        grossTotalPln: res.data.totals.grossTotalPln,
        parts: parts.length,
      })
      toast.success(strings.order.successTitle)
    } catch (err) {
      toast.error(apiErrorMessage(err, strings, strings.order.failed))
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
          // The one high-emotion moment in the app: the block settles in and
          // the check lands with a slight overshoot (crossfade only under
          // reduced motion).
          <div className="animate-in fade-in zoom-in-95 motion-reduce:zoom-in-100 space-y-4 py-2 text-center duration-300 ease-out">
            <span className="border-primary text-primary-text animate-check-pop mx-auto flex size-12 items-center justify-center rounded-full border-[2.5px] motion-reduce:animate-none">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <DialogTitle className="mb-1 text-xl font-extrabold tracking-tight">
                {strings.order.successTitle}
              </DialogTitle>
              <p className="text-muted-foreground text-[0.8125rem]">
                {strings.order.successBody}
              </p>
              <p className="mt-2.5 font-mono text-lg font-bold">{quoteId}</p>
            </div>
            <Button
              onClick={() => handleOpenChange(false)}
              className="w-full font-bold"
            >
              {strings.order.done}
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
              <div className="space-y-2">
                <Label
                  htmlFor="order-email"
                  className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase"
                >
                  {strings.order.emailLabel}
                </Label>
                <Input
                  id="order-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={strings.login.emailPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="order-country"
                  className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase"
                >
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
              <div className="flex items-baseline justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground text-[0.8125rem]">
                  {strings.order.orderTotal}
                </span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {formatPln(displayTotal)}
                </span>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full font-bold"
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
