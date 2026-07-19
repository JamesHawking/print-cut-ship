import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { api } from '@/lib/api/client'
import { formatPlacedDate, formatPln } from '@/lib/format'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  useStrings,
} from '@/lib/i18n'
import { seoHead } from '@/lib/seo'

// Public, tokenized order status page (plan 05): the statusToken in the URL
// is the bearer capability — no login required (guest promise). While the
// order is still 'draft' the page polls: the payment confirmation arrives
// through the provider event pipeline, never through the redirect.
export const Route = createFileRoute('/$locale/order/$statusToken')({
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return seoHead({
      locale,
      path: match.pathname,
      title: s.meta.orderStatus.title,
      description: s.meta.orderStatus.description,
      noindex: true,
    })
  },
  component: OrderStatus,
})

function OrderStatus() {
  const { statusToken } = Route.useParams()
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.orderStatus

  const { data, isPending, isError } = useQuery({
    queryKey: ['order-track', statusToken],
    queryFn: async () => {
      const res = await api.GET('/api/v1/orders/track/{statusToken}', {
        params: { path: { statusToken } },
      })
      if (!res.data) throw new Error('not found')
      return res.data
    },
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'draft' ? 3000 : false,
  })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
          <Link to="/$locale" params={{ locale }} className="font-bold">
            {strings.hero.wordmark}
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:px-6">
        <div className="bg-card w-full max-w-lg rounded-lg border p-8 shadow-xl shadow-black/[0.06]">
          {isPending ? (
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {strings.orders.loading}
            </p>
          ) : isError || !data ? (
            <NotFound />
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                  {s.heading} · {data.orderId}
                </p>
                {data.status === 'draft' ? (
                  <div className="mt-4 flex items-start gap-3">
                    <Loader2 className="text-primary mt-1 size-5 animate-spin" />
                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight">
                        {s.processingTitle}
                      </h1>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {s.processingBody}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <h1 className="text-xl font-extrabold tracking-tight">
                      {strings.orders.status[data.status]}
                    </h1>
                    {data.status === 'paid' && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {s.paidBody}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                  {s.items}
                </p>
                <ul className="space-y-2">
                  {data.items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {it.fileName}
                        <span className="text-muted-foreground ml-2 font-mono text-[0.65rem] uppercase">
                          {strings.config[it.leadTime]} ·{' '}
                          {s.quantity(it.quantity)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatPln(it.lineTotalPln, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                  <span className="text-muted-foreground text-[0.8125rem]">
                    {s.total}
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {formatPln(data.totals.grossTotalPln, locale)}
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.1em] uppercase">
                {s.placed} {formatPlacedDate(data.createdAt, locale)}
                {data.paidAt &&
                  ` · ${s.paidAt} ${formatPlacedDate(data.paidAt, locale)}`}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function NotFound() {
  const s = useStrings().orderStatus
  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight">
        {s.notFoundTitle}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">{s.notFoundBody}</p>
    </div>
  )
}
