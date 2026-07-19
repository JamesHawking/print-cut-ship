import { useEffect, useState } from 'react'
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
import { useSession } from '@/lib/useSession'
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

interface AddressForm {
  name: string
  street: string
  city: string
  postalCode: string
}

const emptyAddress: AddressForm = {
  name: '',
  street: '',
  city: '',
  postalCode: '',
}

const labelClass =
  'text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase'

export function OrderDialog({
  open,
  onOpenChange,
  parts,
  totals,
  pricesExVat,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const session = useSession()
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<string>('PL')
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress)
  const [b2b, setB2b] = useState(false)
  const [company, setCompany] = useState('')
  const [nip, setNip] = useState('')
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [billingDifferent, setBillingDifferent] = useState(false)
  const [billing, setBilling] = useState<AddressForm>(emptyAddress)
  const [submitting, setSubmitting] = useState(false)

  const displayTotal = pricesExVat ? totals.netTotalPln : totals.grossTotalPln

  // Signed-in customers get their email prefilled (still editable — a guest
  // path stays possible for B2B assistants ordering for a shared inbox).
  useEffect(() => {
    if (session.data?.email && !email) setEmail(session.data.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.email])

  async function submit() {
    if (!email) return
    setSubmitting(true)
    try {
      // The backend re-prices the order from the raw metrics; the displayed
      // total rides along only so server logs catch UI/engine drift.
      const quote = await api.POST('/api/v1/quotes', {
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
      if (!quote.data) throw new ApiRequestError(quote.error)

      // No prices below: the order copies money from the stored quote.
      const cleanNip = nip.replace(/\D/g, '')
      const order = await api.POST('/api/v1/orders', {
        body: {
          quoteId: quote.data.quoteId,
          email,
          country: country as EuCountry,
          ...(b2b && company ? { companyName: company } : {}),
          ...(b2b && cleanNip ? { nip: cleanNip } : {}),
          ...(!b2b && invoiceRequested ? { invoiceRequested: true } : {}),
          shippingAddress: shipping,
          ...(b2b && billingDifferent ? { billingAddress: billing } : {}),
        },
      })
      if (!order.data) throw new ApiRequestError(order.error)

      const checkout = await api.POST('/api/v1/orders/{orderId}/checkout', {
        params: { path: { orderId: order.data.orderId } },
      })
      if (!checkout.data) throw new ApiRequestError(checkout.error)

      track('order_submitted', {
        quoteId: quote.data.quoteId,
        orderId: order.data.orderId,
        grossTotalPln: quote.data.totals.grossTotalPln,
        parts: parts.length,
      })
      // Provider-hosted page (stub today, Stripe in plan 18): full redirect,
      // the browser never asserts payment itself.
      window.location.assign(checkout.data.url)
    } catch (err) {
      toast.error(apiErrorMessage(err, strings, strings.order.failed))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="order-email" className={labelClass}>
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
            <Label htmlFor="order-country" className={labelClass}>
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

          <fieldset className="space-y-3 border-t pt-3">
            <legend className={labelClass}>
              {strings.order.shippingHeading}
            </legend>
            <Input
              aria-label={strings.order.nameLabel}
              placeholder={strings.order.nameLabel}
              required
              value={shipping.name}
              onChange={(e) =>
                setShipping((a) => ({ ...a, name: e.target.value }))
              }
            />
            <Input
              aria-label={strings.order.streetLabel}
              placeholder={strings.order.streetLabel}
              required
              value={shipping.street}
              onChange={(e) =>
                setShipping((a) => ({ ...a, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                aria-label={strings.order.cityLabel}
                placeholder={strings.order.cityLabel}
                required
                value={shipping.city}
                onChange={(e) =>
                  setShipping((a) => ({ ...a, city: e.target.value }))
                }
              />
              <Input
                aria-label={strings.order.postalCodeLabel}
                placeholder={strings.order.postalCodeLabel}
                required
                className="w-28"
                value={shipping.postalCode}
                onChange={(e) =>
                  setShipping((a) => ({ ...a, postalCode: e.target.value }))
                }
              />
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2.5 border-t pt-3 text-sm">
            <input
              type="checkbox"
              checked={b2b}
              onChange={(e) => setB2b(e.target.checked)}
              className="accent-primary size-4"
            />
            {strings.order.b2bLabel}
          </label>

          {b2b ? (
            <fieldset className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  aria-label={strings.order.companyLabel}
                  placeholder={strings.order.companyLabel}
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
                <Input
                  aria-label={strings.order.nipLabel}
                  placeholder={strings.order.nipLabel}
                  required
                  inputMode="numeric"
                  className="w-36"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={billingDifferent}
                  onChange={(e) => setBillingDifferent(e.target.checked)}
                  className="accent-primary size-4"
                />
                {strings.order.billingToggle}
              </label>
              {billingDifferent && (
                <fieldset className="space-y-3">
                  <legend className={labelClass}>
                    {strings.order.billingHeading}
                  </legend>
                  <Input
                    aria-label={strings.order.nameLabel}
                    placeholder={strings.order.nameLabel}
                    required
                    value={billing.name}
                    onChange={(e) =>
                      setBilling((a) => ({ ...a, name: e.target.value }))
                    }
                  />
                  <Input
                    aria-label={strings.order.streetLabel}
                    placeholder={strings.order.streetLabel}
                    required
                    value={billing.street}
                    onChange={(e) =>
                      setBilling((a) => ({ ...a, street: e.target.value }))
                    }
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      aria-label={strings.order.cityLabel}
                      placeholder={strings.order.cityLabel}
                      required
                      value={billing.city}
                      onChange={(e) =>
                        setBilling((a) => ({ ...a, city: e.target.value }))
                      }
                    />
                    <Input
                      aria-label={strings.order.postalCodeLabel}
                      placeholder={strings.order.postalCodeLabel}
                      required
                      className="w-28"
                      value={billing.postalCode}
                      onChange={(e) =>
                        setBilling((a) => ({
                          ...a,
                          postalCode: e.target.value,
                        }))
                      }
                    />
                  </div>
                </fieldset>
              )}
            </fieldset>
          ) : (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={invoiceRequested}
                onChange={(e) => setInvoiceRequested(e.target.checked)}
                className="accent-primary size-4"
              />
              {strings.order.invoiceLabel}
            </label>
          )}

          <div className="flex items-baseline justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground text-[0.8125rem]">
              {strings.order.orderTotal}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatPln(displayTotal, locale)}
            </span>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !email}
              className="w-full font-bold"
            >
              {submitting
                ? strings.order.redirecting
                : strings.order.submit(formatPln(displayTotal, locale))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
