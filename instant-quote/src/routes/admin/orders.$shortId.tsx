// Order detail (plan 07 Phase B): full order record, items with frozen
// snapshot breakdown + DFM codes, payment/invoice ledgers, model downloads,
// and the lifecycle transition actions. EN-only (i18n-exempt directory).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Download,
  PackageCheck,
  Play,
  Truck,
} from 'lucide-react'

import { StatusPill } from './-components/StatusPill'
import { errorCode } from './-components/util'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { formatPlacedDate, formatPln } from '@/lib/format'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/orders/$shortId')({
  component: OrderDetail,
})

type AdminOrderItem = components['schemas']['AdminOrderItem']
type OrderStatus = components['schemas']['OrderStatus']

type Snapshot = {
  breakdown?: Array<{
    key: string
    label?: string
    count?: number
    amountPln: number
  }>
  dfmFlags?: Array<{ code: string; severity: string }>
}

function OrderDetail() {
  const { shortId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'order', shortId],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/orders/{orderId}', {
        params: { path: { orderId: shortId } },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'order', shortId],
    })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
  }

  const transition = useMutation({
    mutationFn: async (vars: { to: OrderStatus; trackingNumber?: string }) => {
      const res = await api.POST('/api/v1/admin/orders/{orderId}/transition', {
        params: { path: { orderId: shortId } },
        body: {
          to: vars.to,
          ...(vars.trackingNumber && { trackingNumber: vars.trackingNumber }),
        },
      })
      if (res.error) throw new ApiRequestError(res.error)
    },
    onSuccess: invalidate,
    onError: (err) => toast.error(errorCode(err)),
  })

  const refund = useMutation({
    mutationFn: async () => {
      const res = await api.POST('/api/v1/admin/orders/{orderId}/refund', {
        params: { path: { orderId: shortId } },
      })
      if (res.error) throw new ApiRequestError(res.error)
    },
    onSuccess: invalidate,
    onError: (err) => toast.error(errorCode(err)),
  })

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <p className="text-destructive font-mono text-xs">{errorCode(error)}</p>
    )
  }

  const o = data.order
  const busy = transition.isPending || refund.isPending

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-background sticky top-14 z-10 -mx-1 flex flex-col gap-3 px-1 pt-1 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-extrabold tracking-tight tabular-nums">
              {o.orderId}
            </h1>
            <p className="text-muted-foreground mt-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {o.email} · placed {formatPlacedDate(o.createdAt, 'en')}
              {o.paidAt ? ` · paid ${formatPlacedDate(o.paidAt, 'en')}` : ''}
            </p>
          </div>
          <StatusPill status={o.status} />
        </div>

        <TransitionBar
          status={o.status}
          busy={busy}
          onTransition={(to, trackingNumber) =>
            transition.mutate({ to, trackingNumber })
          }
          onRefund={() => refund.mutate()}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <FactCard
          title="Customer"
          facts={[
            ['Email', o.email],
            ['Company', o.companyName ?? '—'],
            ['NIP', o.nip ?? '—'],
            ['Invoice', o.invoiceRequested ? 'requested' : 'no'],
            ['Locale', o.locale],
            ['Country', o.country],
          ]}
        />
        <FactCard
          title="Order"
          facts={[
            ['Gross', formatPln(o.grossTotalPln, 'en')],
            ['VAT', formatPln(o.vatPln, 'en')],
            ['Tracking', o.trackingNumber ?? '—'],
            ['Status token', o.statusToken],
            ['Pricing config', o.pricingConfigId],
          ]}
        />
        <FactCard
          title="Shipping address"
          facts={addressFacts(o.shippingAddress)}
        />
        <FactCard
          title="Billing address"
          facts={
            o.billingAddress
              ? addressFacts(o.billingAddress)
              : [['—', 'same as shipping']]
          }
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">Items</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Process</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Lead time</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead>DFM</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it, i) => (
                <ItemRow key={i} item={it} orderId={o.orderId} />
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground mt-2 font-mono text-[0.65rem] tracking-[0.1em] uppercase">
          Gross total {formatPln(o.totals.grossTotalPln, 'en')} · shipping{' '}
          {formatPln(o.totals.shippingPln, 'en')} · order fee{' '}
          {formatPln(o.totals.orderFeePln, 'en')}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">Payments</h2>
          {data.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.provider}
                        {p.paymentRef ? ` · ${p.paymentRef}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatPln(p.amountPln, 'en')}
                      </TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">Invoices</h2>
          {data.invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              None (seam until plan 18).
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((inv, i) => (
                    <TableRow key={i}>
                      <TableCell>{inv.kind}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.number ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.issuedAt
                          ? formatPlacedDate(inv.issuedAt, 'en')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function addressFacts(a: {
  name: string
  street: string
  city: string
  postalCode: string
}) {
  return [
    ['Name', a.name],
    ['Street', a.street],
    ['City', a.city],
    ['Postal code', a.postalCode],
  ] as Array<[string, string]>
}

function FactCard({
  title,
  facts,
}: {
  title: string
  facts: Array<[string, string]>
}) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-muted-foreground font-mono text-[0.6rem] font-normal tracking-[0.16em] uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <dl className="flex flex-col gap-1.5">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-[13px]">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="m-0 max-w-64 truncate text-right font-mono text-xs">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function ItemRow({
  item: it,
  orderId,
}: {
  item: AdminOrderItem
  orderId: string
}) {
  const snap = it.partQuoteSnapshot as Snapshot | undefined
  const codes = snap?.dfmFlags?.map((f) => f.code) ?? []
  return (
    <TableRow>
      <TableCell className="max-w-52">
        <span className="block truncate text-[13px] font-semibold">
          {it.fileName}
        </span>
        {snap?.breakdown && (
          <span className="text-muted-foreground mt-0.5 block font-mono text-[0.6rem] tracking-[0.08em] uppercase">
            {snap.breakdown
              .map(
                (l) =>
                  `${l.key}${l.count ? `×${l.count}` : ''} ${formatPln(l.amountPln, 'en')}`,
              )
              .join(' · ')}
          </span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs">{it.process}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {it.quantity}
      </TableCell>
      <TableCell className="font-mono text-xs">{it.leadTime}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatPln(it.unitPricePln, 'en')}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatPln(it.lineTotalPln, 'en')}
      </TableCell>
      <TableCell>
        {codes.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">
                <AlertTriangle className="text-highlight" />
                {codes.length} {codes.length === 1 ? 'flag' : 'flags'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{codes.join(', ')}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {it.fileId && (
          <Button variant="outline" size="icon-sm" asChild>
            <a
              href={`/api/v1/admin/orders/${orderId}/files/${it.fileId}`}
              download
              title={`Download ${it.fileName}`}
            >
              <Download />
            </a>
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function TransitionBar({
  status,
  busy,
  onTransition,
  onRefund,
}: {
  status: OrderStatus
  busy: boolean
  onTransition: (to: OrderStatus, trackingNumber?: string) => void
  onRefund: () => void
}) {
  const [shipOpen, setShipOpen] = useState(false)
  const [tracking, setTracking] = useState('')

  if (status !== 'paid' && status !== 'in_production' && status !== 'shipped') {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'paid' && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onTransition('in_production')}
        >
          <Play />
          Start production
        </Button>
      )}
      {status === 'in_production' && (
        <Dialog open={shipOpen} onOpenChange={setShipOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={busy}>
              <Truck />
              Ship…
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as shipped</DialogTitle>
              <DialogDescription>
                The tracking number is required — it goes into the shipped
                email.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input
                id="tracking"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="e.g. DPD 0001234567"
              />
            </div>
            <DialogFooter>
              <Button
                disabled={busy || tracking.trim() === ''}
                onClick={() => {
                  onTransition('shipped', tracking.trim())
                  setShipOpen(false)
                  setTracking('')
                }}
              >
                Mark shipped
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {status === 'shipped' && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onTransition('delivered')}
        >
          <PackageCheck />
          Mark delivered
        </Button>
      )}

      <ConfirmAction
        label="Cancel"
        title="Cancel this order?"
        description="Cancellation is a terminal state — the order cannot be resumed. A paid order cancelled here still needs a refund decision."
        busy={busy}
        onConfirm={() => onTransition('cancelled')}
      />
      {status === 'paid' && (
        <ConfirmAction
          label="Refund"
          title="Refund this order?"
          description="Requests a provider refund for the full gross amount. The status flips to refunded when the provider confirms."
          busy={busy}
          onConfirm={onRefund}
        />
      )}
    </div>
  )
}

function ConfirmAction({
  label,
  title,
  description,
  busy,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={busy}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
