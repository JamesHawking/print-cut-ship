// Orders board (plan 07 Phase B): status filter, paginated table, ship-by
// with overdue accent, DFM flags, tracking. EN-only (i18n-exempt directory).

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { STATUS_VARIANT, errorCode } from './-components/util'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
        <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
          Loading…
        </p>
      ) : error ? (
        <p className="text-destructive font-mono text-xs">{errorCode(error)}</p>
      ) : data.orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No orders.</p>
      ) : (
        <>
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
  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-bold tabular-nums">
        <Link
          to="/admin/orders/$shortId"
          params={{ shortId: o.orderId }}
          className="underline underline-offset-4"
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
      <TableCell
        className={cn(
          'font-mono text-[0.65rem] uppercase',
          o.overdue ? 'text-destructive font-bold' : 'text-muted-foreground',
        )}
      >
        {o.shipBy ?? '—'}
        {o.overdue ? ' (overdue)' : ''}
      </TableCell>
      <TableCell>
        {o.dfmFlagged && o.dfmCodes ? (
          <Badge variant="outline">{o.dfmCodes.join(', ')}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {o.trackingNumber ?? '—'}
      </TableCell>
    </TableRow>
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
  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          Must ship — {data.date}
        </h2>
        {data.orders.length === 0 && (
          <span className="text-signal flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            <span className="bg-signal size-1.5 rounded-full" />
            Nothing due — all clear
          </span>
        )}
      </div>
      {data.orders.length > 0 && (
        <Table className="mt-3">
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
                <TableCell
                  className={cn(
                    'font-mono text-[0.65rem] uppercase',
                    o.overdue
                      ? 'text-destructive font-bold'
                      : 'text-muted-foreground',
                  )}
                >
                  ship by {o.shipBy}
                  {o.overdue ? ' (overdue)' : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
