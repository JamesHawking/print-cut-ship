import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { OrderAccessShell } from '@/components/OrderAccessShell'
import { api } from '@/lib/api/client'
import { clearSessionEmail, getSessionEmail } from '@/lib/session'
import { formatPln } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/orders')({ component: Orders })

type OrderSummary = components['schemas']['OrderSummary']

const placedOn = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
})

// Statuses that mean the factory is actively on it get the signal chip.
const ACTIVE_STATUSES = new Set(['submitted', 'ordered'])

function Orders() {
  const s = useStrings().orders
  const navigate = useNavigate()
  const email = getSessionEmail()

  // Not signed in — the login page owns this screen's access.
  useEffect(() => {
    if (!email) void navigate({ to: '/login', replace: true })
  }, [email, navigate])

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['orders', email],
    enabled: email !== null,
    queryFn: async () => {
      const res = await api.GET('/api/v1/orders', {
        params: { query: { email: email! } },
      })
      if (!res.data) throw new Error('orders fetch failed')
      return res.data.orders
    },
  })

  if (!email) return null

  return (
    <OrderAccessShell>
      <div>
        <p className="text-muted-foreground flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          <span className="bg-signal size-1.5 rounded-full" />
          {s.signedIn} {email}
        </p>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">
          {s.heading}
        </h2>
      </div>

      {isPending ? (
        <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
          {s.loading}
        </p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">{s.loadFailed}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-foreground cursor-pointer font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4"
          >
            {s.retry}
          </button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{s.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((o) => (
            <OrderRow key={o.quoteId} order={o} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-5 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {s.newQuote}
        </Link>
        <button
          type="button"
          onClick={() => {
            clearSessionEmail()
            void navigate({ to: '/login' })
          }}
          className="text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-4 transition-colors"
        >
          {s.signOut}
        </button>
      </div>
    </OrderAccessShell>
  )
}

function OrderRow({ order: o }: { order: OrderSummary }) {
  const strings = useStrings()
  const s = strings.orders
  const lead = strings.config[o.leadTime]
  const meta = [
    `${s.placed} ${placedOn.format(new Date(o.createdAt))}`,
    lead,
    formatPln(o.grossTotalPln),
  ].join(' · ')
  const title =
    o.partCount > 1
      ? `${o.fileName} ${s.moreParts(o.partCount - 1)}`
      : o.fileName

  return (
    <div className="hover:bg-primary/[0.045] flex items-center gap-3.5 rounded-lg border px-4 py-3.5 transition-colors">
      <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
        {o.quoteId}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground mt-0.5 block font-mono text-[0.6rem] tracking-[0.1em] uppercase">
          {meta}
        </span>
      </span>
      <span
        className={cn(
          'shrink-0 rounded px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em] uppercase',
          ACTIVE_STATUSES.has(o.status)
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {s.status[o.status] ?? o.status}
      </span>
    </div>
  )
}
