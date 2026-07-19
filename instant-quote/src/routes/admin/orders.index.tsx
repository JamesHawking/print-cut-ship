// Orders board (admin overhaul): full filterable table with status pills and
// pagination; the overview lives on /admin. EN-only (i18n-exempt directory).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from './-components/PageHeader'
import {
  BoardSkeleton,
  EmptyState,
  OrdersTable,
} from './-components/orders-table'
import { errorCode } from './-components/util'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/orders/')({
  component: OrdersBoard,
})

type OrderStatus = components['schemas']['OrderStatus']
type OpsStats = components['schemas']['AdminOpsStats']

const PAGE_SIZE = 50

function OrdersBoard() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [offset, setOffset] = useState(0)

  const stats = useQuery({
    queryKey: ['admin', 'ops', 'stats'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/stats')
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    refetchInterval: 60_000,
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
      <PageHeader
        kicker="Commerce / Orders"
        title="Orders"
        action={
          <StatusPills
            stats={stats.data}
            active={status}
            onChange={(s) => {
              setStatus(s)
              setOffset(0)
            }}
          />
        }
      />

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
          <OrdersTable orders={data.orders} />
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

// Count-pill status filter fed by the stats endpoint — zero-count statuses
// stay hidden unless they are the active filter.
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
      {statuses.map((s) => pill(s, s.replace('_', ' '), counts.get(s) ?? 0))}
    </div>
  )
}
