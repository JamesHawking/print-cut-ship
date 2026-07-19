// Dashboard (admin overhaul): KPI cards with sparklines and vs-yesterday
// deltas, 14-day trend chart, "must ship" list, recent orders. The full
// filterable board lives on /admin/orders. EN-only (i18n-exempt directory).

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  FileBox,
  Package,
  Wallet,
} from 'lucide-react'

import { PageHeader } from './-components/PageHeader'
import { StatusPill } from './-components/StatusPill'
import { EmptyState, OrdersTable, ShipByCell } from './-components/orders-table'
import { errorCode } from './-components/util'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { formatPln } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/')({
  component: Dashboard,
})

type OpsToday = components['schemas']['AdminOpsToday']
type OpsStats = components['schemas']['AdminOpsStats']

const MUST_SHIP_VISIBLE = 6
const RECENT_COUNT = 8

function Dashboard() {
  const stats = useQuery({
    queryKey: ['admin', 'ops', 'stats'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/stats')
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    refetchInterval: 60_000,
  })

  const ops = useQuery({
    queryKey: ['admin', 'ops', 'today'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/today')
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  const recent = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/orders', {
        params: { query: { limit: RECENT_COUNT, offset: 0 } },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        kicker="Operations / Overview"
        title="Dashboard"
        meta={stats.data?.date}
      />
      <KpiGrid stats={stats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <TrendCard stats={stats} className="lg:col-span-2" />
        <MustShipCard ops={ops} />
      </div>
      <RecentOrdersCard recent={recent} />
    </div>
  )
}

function KpiGrid({ stats }: { stats: UseQueryResult<OpsStats, Error> }) {
  if (stats.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Package className="text-muted-foreground size-4" />}
        label="Orders today"
        value={String(s.todayOrders)}
        spark={<Sparkline values={s.daily.map((d) => d.orders)} />}
        footer={<Delta now={s.todayOrders} prev={s.yesterdayOrders} />}
      />
      <KpiCard
        icon={<Wallet className="text-muted-foreground size-4" />}
        label="Gross today"
        value={formatPln(s.todayGrossPln, 'en')}
        spark={<Sparkline values={s.daily.map((d) => d.grossPln ?? 0)} />}
        footer={<Delta now={s.todayGrossPln} prev={s.yesterdayGrossPln} />}
      />
      <Link to="/admin/orders" className="block">
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
      </Link>
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
  spark,
  footer,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  spark?: React.ReactNode
  footer: React.ReactNode
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
      <CardContent className="flex flex-1 flex-col px-4">
        <div className="flex flex-1 items-end justify-between gap-2">
          <span className="font-mono text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </span>
          {spark}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-2">
          {footer}
        </div>
      </CardContent>
    </Card>
  )
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const flat = (
    <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
      — flat vs yesterday
    </span>
  )
  if (prev === 0) {
    return now === 0 ? (
      flat
    ) : (
      <span className="text-signal font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        ▲ new vs yesterday
      </span>
    )
  }
  const pct = Math.round(((now - prev) / prev) * 100)
  if (pct === 0) return flat
  const up = pct > 0
  return (
    <span
      className={cn(
        'font-mono text-[0.65rem] tracking-[0.14em] uppercase',
        up ? 'text-signal' : 'text-destructive',
      )}
    >
      {up ? '▲ +' : '▼ '}
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

function TrendCard({
  stats,
  className,
}: {
  stats: UseQueryResult<OpsStats, Error>
  className?: string
}) {
  if (stats.isPending) return <Skeleton className={cn('h-56', className)} />
  if (stats.error || !stats.data) {
    return (
      <p className={cn('text-destructive font-mono text-xs', className)}>
        {errorCode(stats.error)}
      </p>
    )
  }
  const daily = stats.data.daily
  const maxOrders = Math.max(...daily.map((d) => d.orders))
  const totalOrders = daily.reduce((a, d) => a + d.orders, 0)
  const totalGross = daily.reduce((a, d) => a + (d.grossPln ?? 0), 0)

  return (
    <Card className={cn('gap-0 py-4', className)}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
        <CardTitle className="font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          Orders — last 14 days
        </CardTitle>
        <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
          Σ {totalOrders} orders · {formatPln(totalGross, 'en')}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pt-4">
        {totalOrders === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              No orders in 14 days
            </p>
          </div>
        ) : (
          <div className="flex h-40 items-end gap-1.5">
            {daily.map((d, i) => (
              <Tooltip key={d.date}>
                <TooltipTrigger asChild>
                  <div className="flex h-full flex-1 items-end">
                    {d.orders === 0 ? (
                      <div className="bg-muted-foreground/15 h-0.5 w-full rounded-sm" />
                    ) : (
                      <div
                        className={cn(
                          'w-full rounded-sm transition-colors',
                          i === daily.length - 1
                            ? 'bg-primary'
                            : 'bg-muted-foreground/25 hover:bg-muted-foreground/50',
                        )}
                        style={{
                          height: `${Math.max(4, (d.orders / maxOrders) * 100)}%`,
                        }}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {d.date} · {d.orders} {d.orders === 1 ? 'order' : 'orders'} ·{' '}
                  {formatPln(d.grossPln ?? 0, 'en')}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        <div className="text-muted-foreground flex justify-between font-mono text-[0.55rem] uppercase">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// "What must ship today" (plan 07 Phase E), compressed for the 1/3 column.
function MustShipCard({ ops }: { ops: UseQueryResult<OpsToday, Error> }) {
  if (ops.isPending) return <Skeleton className="h-56" />
  if (ops.error) {
    return (
      <p className="text-destructive font-mono text-xs">
        {errorCode(ops.error)}
      </p>
    )
  }
  const data = ops.data
  const allClear = data.orders.length === 0
  const visible = data.orders.slice(0, MUST_SHIP_VISIBLE)
  const more = data.orders.length - visible.length

  return (
    <Card
      className={cn(
        'gap-0 py-4',
        allClear
          ? 'border-signal/40'
          : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          {allClear ? (
            <CheckCircle2 className="text-signal size-4" />
          ) : (
            <Package className="text-destructive size-4" />
          )}
          Must ship — {data.date}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col px-4 pt-3">
        {allClear ? (
          <p className="text-signal font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            Nothing due — all clear
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {visible.map((o) => (
                <li
                  key={o.orderId}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to="/admin/orders/$shortId"
                      params={{ shortId: o.orderId }}
                      className="font-mono text-xs font-bold underline underline-offset-4"
                    >
                      {o.orderId}
                    </Link>
                    <span className="text-muted-foreground truncate text-[11px]">
                      {o.email}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ShipByCell shipBy={o.shipBy} overdue={o.overdue} />
                    <StatusPill status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
            {more > 0 && (
              <Link
                to="/admin/orders"
                className="text-muted-foreground hover:text-foreground pt-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4"
              >
                +{more} more →
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecentOrdersCard({
  recent,
}: {
  recent: UseQueryResult<
    components['schemas']['AdminListOrdersResponse'],
    Error
  >
}) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
        <CardTitle className="font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          Recent orders
        </CardTitle>
        <Link
          to="/admin/orders"
          className="text-muted-foreground hover:text-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent className="px-4 pt-3">
        {recent.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : recent.error || !recent.data ? (
          <p className="text-destructive font-mono text-xs">
            {errorCode(recent.error)}
          </p>
        ) : recent.data.orders.length === 0 ? (
          <EmptyState label="No orders yet." />
        ) : (
          <OrdersTable orders={recent.data.orders} compact />
        )}
      </CardContent>
    </Card>
  )
}
