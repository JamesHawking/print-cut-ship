import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { DropZone } from '@/components/DropZone'
import { SiteHeader } from '@/components/SiteHeader'
import { QuoteCard } from '@/components/QuoteCard'
import { QuoteSkeleton } from '@/components/QuoteSkeleton'
import { OrderPanel } from '@/components/OrderPanel'
import { OrderDialog } from '@/components/OrderDialog'
import { PartsList } from '@/components/PartsList'
import { StepManualCard } from '@/components/StepManualCard'
import { ViewerFrame } from '@/components/ViewerFrame'
import { ViewerPane } from '@/components/ViewerPane'
import { ViewerFallback } from '@/components/ViewerFallback'
import { Card, CardContent } from '@/components/ui/card'

import { useParts, type Part } from '@/hooks/useParts'
import {
  api,
  toApiMetrics,
  type PartConfig,
  type PartQuote,
} from '@/lib/api/client'
import { MAX_PARTS } from '@/lib/upload'
import { track } from '@/lib/funnel'
import { formatWarsawClock } from '@/lib/clock'
import { useLocale, useStrings } from '@/lib/i18n'

export const Route = createFileRoute('/$locale/quote')({
  component: QuoteWorkspace,
})

function QuoteWorkspace() {
  const strings = useStrings()
  const locale = useLocale()
  const {
    parts,
    handleFiles,
    handleMakerworldUrl,
    mwPending,
    updateConfig,
    remove,
  } = useParts()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pricesExVat, setPricesExVat] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Parts live in memory only — a refresh or deep link lands here empty, and
  // an upload whose every file was rejected does too. Bounce to the landing.
  useEffect(() => {
    if (parts.length === 0)
      void navigate({ to: '/$locale', params: { locale }, replace: true })
  }, [parts.length, navigate, locale])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Ready parts get a live quote from the pricing API. One request covers
  // every part and the order totals; keepPreviousData stops prices from
  // flashing while a config change is in flight.
  const readyParts = parts.filter(
    (p): p is Part & { hash: string } =>
      p.status === 'ready' && !!p.hash && !!p.metrics,
  )

  const priceQuery = useQuery({
    queryKey: [
      'price',
      readyParts.map((p) => [
        p.hash,
        p.config.process,
        p.config.quantity,
        p.config.leadTime,
      ]),
    ],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: readyParts.map((p) => ({
            metrics: toApiMetrics(p.metrics!),
            process: p.config.process,
            quantity: p.config.quantity,
            leadTime: p.config.leadTime,
          })),
        },
      })
      if (!res.data) throw new Error(strings.errors.priceFailed)
      return res.data
    },
    enabled: readyParts.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })

  // At most 5 parts — cheap to rebuild each render, keeps the map in sync.
  // Response parts come back in request order.
  const quotesById = new Map<string, PartQuote>()
  if (priceQuery.data && priceQuery.data.parts.length === readyParts.length) {
    readyParts.forEach((p, i) => {
      quotesById.set(p.id, priceQuery.data.parts[i])
    })
  }

  const orderableEntries = readyParts
    .map((p) => ({ part: p as Part, quote: quotesById.get(p.id) }))
    .filter(
      (e): e is { part: Part; quote: PartQuote } =>
        !!e.quote && !e.quote.blocked,
    )

  const totals = priceQuery.data?.totals ?? null

  const selectedPart =
    parts.find((p) => p.id === selectedId) ?? parts[parts.length - 1] ?? null
  const selectedQuote = selectedPart
    ? (quotesById.get(selectedPart.id) ?? null)
    : null

  async function handleMoreFiles(files: File[]) {
    const added = await handleFiles(files)
    const last = added[added.length - 1]
    if (last) setSelectedId(last)
  }

  function handleConfigChange(id: string, patch: Partial<PartConfig>) {
    updateConfig(id, patch)
    track('config_changed', { partId: id, ...patch })
  }

  function handleOrderClick() {
    track('order_clicked', {
      grossTotalPln: totals?.grossTotalPln,
      parts: orderableEntries.length,
    })
    setOrderOpen(true)
  }

  return (
    <>
      <SiteHeader variant="quote" />
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:sticky lg:top-20 lg:self-start">
              {selectedPart?.status === 'ready' &&
              selectedPart.positions &&
              selectedPart.metrics ? (
                <ViewerFrame
                  part={selectedPart}
                  index={parts.indexOf(selectedPart)}
                  quote={selectedQuote}
                >
                  <ViewerPane
                    key={selectedPart.id}
                    positions={selectedPart.positions}
                    bboxMm={selectedPart.metrics.bboxMm}
                  />
                </ViewerFrame>
              ) : selectedPart?.status === 'error' ? (
                <ViewerFallback />
              ) : (
                <div className="bg-muted/30 flex h-full min-h-[340px] items-center justify-center rounded-lg border">
                  <p className="text-muted-foreground text-sm">
                    {strings.dropzone.parsing}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {selectedPart?.status === 'parsing' ? (
                <QuoteSkeleton />
              ) : selectedPart?.status === 'error' ? (
                // STEP files that OCCT can't read fall back to a manual quote.
                selectedPart.kind === 'step' ? (
                  <StepManualCard part={selectedPart} />
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-destructive text-sm">
                        {selectedPart.error?.message ??
                          strings.errors.parseFailed}
                      </p>
                    </CardContent>
                  </Card>
                )
              ) : selectedPart && !selectedQuote && priceQuery.isError ? (
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <p className="text-destructive text-sm">
                      {strings.errors.priceFailed}
                    </p>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                      onClick={() => void priceQuery.refetch()}
                    >
                      Retry
                    </button>
                  </CardContent>
                </Card>
              ) : selectedPart && selectedQuote ? (
                <QuoteCard
                  part={selectedPart}
                  quote={selectedQuote}
                  onConfigChange={(patch) =>
                    handleConfigChange(selectedPart.id, patch)
                  }
                />
              ) : null}

              {totals && orderableEntries.length > 0 && (
                <OrderPanel
                  breakdownQuote={
                    selectedQuote && !selectedQuote.blocked
                      ? selectedQuote
                      : orderableEntries[0].quote
                  }
                  totals={totals}
                  pricesExVat={pricesExVat}
                  onTogglePricesExVat={setPricesExVat}
                  orderableCount={orderableEntries.length}
                  onOrderClick={handleOrderClick}
                />
              )}
            </div>
          </div>

          {parts.length > 1 && (
            <PartsList
              parts={parts}
              quotes={quotesById}
              selectedId={selectedPart?.id ?? null}
              onSelect={setSelectedId}
              onRemove={remove}
            />
          )}

          {parts.length < MAX_PARTS && (
            <DropZone
              onFiles={handleMoreFiles}
              variant="compact"
              onUrl={handleMakerworldUrl}
              urlPending={mwPending}
            />
          )}

          <p className="text-muted-foreground text-center font-mono text-[0.625rem] tracking-[0.16em] uppercase tabular-nums">
            Europe/Warsaw {formatWarsawClock(now)} ·{' '}
            {strings.config.warsawCutoff}
          </p>
        </div>

        {totals && (
          <OrderDialog
            open={orderOpen}
            onOpenChange={setOrderOpen}
            parts={orderableEntries}
            totals={totals}
            pricesExVat={pricesExVat}
          />
        )}
      </main>
    </>
  )
}
