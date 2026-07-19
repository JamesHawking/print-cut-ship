// Orders board (plan 07 Phase B, UI pass): status filter, paginated table,
// row-click navigation, relative ship-by urgency, DFM flags, tracking.
// EN-only (i18n-exempt directory).

import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Package,
  Truck,
} from 'lucide-react'

import { STATUS_VARIANT, errorCode, formatShipBy } from './-components/util'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/')({
  component: Board,
})

type AdminOrderSummary = components['schemas']['AdminOrderSummary']
type OrderStatus = components['schemas']['OrderStatus']
type OpsToday = components['schemas']['AdminOpsToday']

const PAGE_SIZE = 50
const STATUS_OPTIONS: Array<OrderStatus | 'all'> = [
  'all',
  'draft',
  'paid',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]

function Board() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [offset, setOffset] = useState(0)

  const ops = useQuery({
    queryKey: ['admin', 'ops', 'today'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/today')
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'orders', { status, offset }],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/orders', {
        params: {
          query: {
            ...(status !== 'all' && { status }),
            limit: PAGE_SIZE,
            offset,
          },
        },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <OpsCard ops={ops} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-extrabold tracking-tight">Orders</h1>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as OrderStatus | 'all')
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt === 'all' ? 'All statuses' : opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <BoardSkeleton />
      ) : error ? (
        <p className="text-destructive font-mono text-xs">{errorCode(error)}</p>
      ) : data.orders.length === 0 ? (
        <EmptyState
          label={status === 'all' ? 'No orders yet.' : `No ${status} orders.`}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead>Ship by</TableHead>
                  <TableHead>DFM</TableHead>
                  <TableHead>Tracking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => (
                  <BoardRow key={o.orderId} order={o} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {data.total} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= data.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BoardRow({ order: o }: { order: AdminOrderSummary }) {
  const navigate = useNavigate()
  const open = () =>
    void navigate({
      to: '/admin/orders/$shortId',
      params: { shortId: o.orderId },
    })

  return (
    <TableRow
      className="cursor-pointer"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
    >
      <TableCell className="font-mono text-xs font-bold tabular-nums">
        <Link
          to="/admin/orders/$shortId"
          params={{ shortId: o.orderId }}
          className="underline underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          {o.orderId}
        </Link>
      </TableCell>
      <TableCell className="max-w-52 truncate text-[13px]">{o.email}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
          {o.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatPln(o.grossTotalPln, 'en')}
      </TableCell>
      <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
        {formatPlacedDate(o.createdAt, 'en')}
      </TableCell>
      <TableCell>
        <ShipByCell shipBy={o.shipBy} overdue={o.overdue} />
      </TableCell>
      <TableCell>
        {o.dfmFlagged && o.dfmCodes ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">
                <AlertTriangle className="text-highlight" />
                {o.dfmCodes.length} {o.dfmCodes.length === 1 ? 'flag' : 'flags'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{o.dfmCodes.join(', ')}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {o.trackingNumber ? (
          <span className="inline-flex items-center gap-1.5">
            <Truck className="text-muted-foreground size-3.5" />
            {o.trackingNumber}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  )
}

function ShipByCell({
  shipBy,
  overdue,
}: {
  shipBy: string | null | undefined
  overdue: boolean | undefined
}) {
  const label = formatShipBy(shipBy, overdue)
  if (!shipBy) return <span className="text-muted-foreground">—</span>
  const text = (
    <span
      className={cn(
        'font-mono text-[0.65rem] uppercase',
        overdue ? 'text-destructive font-bold' : 'text-muted-foreground',
      )}
    >
      {overdue && <AlertTriangle className="mr-1 inline size-3" />}
      {label}
    </span>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent>Ship by {shipBy}</TooltipContent>
    </Tooltip>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12">
      <Inbox className="text-muted-foreground size-6" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

// "What must ship today" (plan 07 Phase E): the ops card pins the board's
// top. Overdue rows are destructive-accented; the empty state is the all-clear.
function OpsCard({ ops }: { ops: UseQueryResult<OpsToday, Error> }) {
  if (ops.isPending) return null
  if (ops.error) {
    return (
      <p className="text-destructive font-mono text-xs">
        {errorCode(ops.error)}
      </p>
    )
  }
  const data = ops.data
  const allClear = data.orders.length === 0
  return (
    <Card
      className={cn(
        'gap-0 py-4',
        allClear
          ? 'border-signal/40'
          : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          {allClear ? (
            <CheckCircle2 className="text-signal size-4" />
          ) : (
            <Package className="text-destructive size-4" />
          )}
          Must ship — {data.date}
        </CardTitle>
        {allClear && (
          <p className="text-signal font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            Nothing due — all clear
          </p>
        )}
      </CardHeader>
      {!allClear && (
        <CardContent>
          <Table>
            <TableBody>
              {data.orders.map((o) => (
                <TableRow key={o.orderId}>
                  <TableCell className="font-mono text-xs font-bold">
                    <Link
                      to="/admin/orders/$shortId"
                      params={{ shortId: o.orderId }}
                      className="underline underline-offset-4"
                    >
                      {o.orderId}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-52 truncate text-[13px]">
                    {o.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ShipByCell shipBy={o.shipBy} overdue={o.overdue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  )
}
