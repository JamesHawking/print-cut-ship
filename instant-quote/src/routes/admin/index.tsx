// Orders board (plan 07 Phase B, UI pass): status filter, paginated table,
// row-click navigation, relative ship-by urgency, DFM flags, tracking.
// EN-only (i18n-exempt directory).

import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  FileBox,
  Inbox,
  Package,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'

import { STATUS_VARIANT, errorCode, formatShipBy } from './-components/util'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
type OpsStats = components['schemas']['AdminOpsStats']

const PAGE_SIZE = 50

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

  const stats = useQuery({
    queryKey: ['admin', 'ops', 'stats'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/stats')
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
      <KpiStrip stats={stats} />
      <OpsCard ops={ops} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-extrabold tracking-tight">Orders</h1>
        <StatusPills
          stats={stats.data}
          active={status}
          onChange={(s) => {
            setStatus(s)
            setOffset(0)
          }}
        />
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

// KPI strip (ops-console pattern): today vs yesterday deltas, overdue
// attention card, STEP queue link, 14-day sparkline on the orders card.
function KpiStrip({ stats }: { stats: UseQueryResult<OpsStats, Error> }) {
  if (stats.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }
  if (stats.error || !stats.data) {
    return (
      <p className="text-destructive font-mono text-xs">
        {errorCode(stats.error)}
      </p>
    )
  }
  const s = stats.data
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<Package className="text-muted-foreground size-4" />}
        label="Orders today"
        value={String(s.todayOrders)}
        delta={<Delta now={s.todayOrders} prev={s.yesterdayOrders} />}
        spark={<Sparkline values={s.daily.map((d) => d.orders)} />}
      />
      <KpiCard
        icon={<Wallet className="text-muted-foreground size-4" />}
        label="Gross today"
        value={formatPln(s.todayGrossPln, 'en')}
        delta={<Delta now={s.todayGrossPln} prev={s.yesterdayGrossPln} />}
      />
      <KpiCard
        icon={
          <AlertTriangle
            className={cn(
              'size-4',
              s.overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
        }
        label="Overdue"
        value={String(s.overdue)}
        tone={s.overdue > 0 ? 'destructive' : undefined}
        footer={
          s.overdue === 0 ? (
            <span className="text-signal font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              on schedule
            </span>
          ) : (
            <span className="text-destructive font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              ship-by passed
            </span>
          )
        }
      />
      <Link to="/admin/step-requests" className="block">
        <KpiCard
          icon={<FileBox className="text-muted-foreground size-4" />}
          label="New STEP requests"
          value={String(s.stepNew)}
          footer={
            <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              open queue →
            </span>
          }
        />
      </Link>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  spark,
  footer,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: React.ReactNode
  spark?: React.ReactNode
  footer?: React.ReactNode
  tone?: 'destructive'
}) {
  return (
    <Card
      className={cn(
        'h-full gap-0 py-4',
        tone === 'destructive' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-mono text-[0.6rem] font-normal tracking-[0.16em] uppercase">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex items-end justify-between gap-2">
          <span className="text-2xl font-extrabold tracking-tight tabular-nums">
            {value}
          </span>
          {spark}
        </div>
        {(delta ?? footer) && (
          <div className="flex items-center gap-2">{delta ?? footer}</div>
        )}
      </CardContent>
    </Card>
  )
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) {
    return now === 0 ? (
      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        flat vs yesterday
      </span>
    ) : (
      <span className="text-signal inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        <TrendingUp className="size-3" /> new vs yesterday
      </span>
    )
  }
  const pct = Math.round(((now - prev) / prev) * 100)
  if (pct === 0) {
    return (
      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        flat vs yesterday
      </span>
    )
  }
  const up = pct > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase',
        up ? 'text-signal' : 'text-destructive',
      )}
    >
      {up ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {up ? '+' : ''}
      {pct}% vs yesterday
    </span>
  )
}

function Sparkline({ values }: { values: Array<number> }) {
  const max = Math.max(1, ...values)
  return (
    <span className="flex h-8 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            'w-1.5 rounded-sm',
            i === values.length - 1 ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  )
}

// Count-pill status filter (ops-console pattern) fed by the stats endpoint —
// zero-count statuses stay hidden unless they are the active filter.
function StatusPills({
  stats,
  active,
  onChange,
}: {
  stats: OpsStats | undefined
  active: OrderStatus | 'all'
  onChange: (s: OrderStatus | 'all') => void
}) {
  const counts = new Map(
    (stats?.byStatus ?? []).map((s) => [s.status, s.count]),
  )
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const statuses = (stats?.byStatus ?? [])
    .map((s) => s.status as OrderStatus)
    .filter((s) => (counts.get(s) ?? 0) > 0 || s === active)

  const pill = (key: OrderStatus | 'all', label: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-[0.1em] uppercase transition-colors',
        active === key
          ? 'bg-primary-tint border-primary/40 font-bold'
          : 'text-muted-foreground hover:text-foreground hover:border-foreground/30',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 tabular-nums',
          active === key ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {count}
      </span>
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pill('all', 'All', total)}
      {statuses.map((s) => pill(s, s, counts.get(s) ?? 0))}
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
