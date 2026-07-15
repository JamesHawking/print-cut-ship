import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'

import { DropZone } from '@/components/DropZone'
import { SiteHeader } from '@/components/SiteHeader'
import { QuoteCard } from '@/components/QuoteCard'
import { QuoteSkeleton } from '@/components/QuoteSkeleton'
import { OrderPanel } from '@/components/OrderPanel'
import { OrderDialog } from '@/components/OrderDialog'
import { PartsList } from '@/components/PartsList'
import { StepManualCard } from '@/components/StepManualCard'
import { ViewerPane } from '@/components/ViewerPane'
import { ViewerFallback } from '@/components/ViewerFallback'
import { Card, CardContent } from '@/components/ui/card'

import { useParts, type Part } from '@/hooks/useParts'
import {
  computePartQuote,
  computeOrderTotals,
  type PartConfig,
  type PartQuote,
} from '@/lib/pricing'
import { MAX_PARTS } from '@/lib/upload'
import { track } from '@/lib/funnel'
import { formatWarsawClock } from '@/lib/leadtime'
import { strings } from '@/lib/strings'

export const Route = createFileRoute('/quote')({ component: QuoteWorkspace })

function QuoteWorkspace() {
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
    if (parts.length === 0) void navigate({ to: '/', replace: true })
  }, [parts.length, navigate])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Ready parts get a live quote via TanStack Query (pure fn as fetcher).
  const readyParts = parts.filter(
    (p): p is Part & { hash: string } =>
      p.status === 'ready' && !!p.hash && !!p.metrics,
  )

  const quoteResults = useQueries({
    queries: readyParts.map((p) => ({
      queryKey: ['quote', p.hash, p.config] as const,
      queryFn: () => computePartQuote(p.metrics!, p.config),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })

  // At most 5 parts — cheap to rebuild each render, keeps the map in sync.
  const quotesById = new Map<string, PartQuote>()
  readyParts.forEach((p, i) => {
    const data = quoteResults[i]?.data
    if (data) quotesById.set(p.id, data)
  })

  const orderableEntries = readyParts
    .map((p) => ({ part: p as Part, quote: quotesById.get(p.id) }))
    .filter(
      (e): e is { part: Part; quote: PartQuote } =>
        !!e.quote && !e.quote.blocked,
    )

  const totals = computeOrderTotals(orderableEntries.map((e) => e.quote))

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
      grossTotalPln: totals.grossTotalPln,
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
                <ViewerPane
                  key={selectedPart.id}
                  positions={selectedPart.positions}
                  bboxMm={selectedPart.metrics.bboxMm}
                />
              ) : selectedPart?.status === 'error' ? (
                <ViewerFallback />
              ) : (
                <div className="bg-muted/30 flex h-full min-h-64 items-center justify-center rounded-xl border">
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
              ) : selectedPart && selectedQuote ? (
                <QuoteCard
                  part={selectedPart}
                  quote={selectedQuote}
                  onConfigChange={(patch) =>
                    handleConfigChange(selectedPart.id, patch)
                  }
                  now={now}
                />
              ) : null}

              {orderableEntries.length > 0 && (
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

          <p className="text-muted-foreground text-center font-mono text-[0.7rem] tracking-wide uppercase">
            Europe/Warsaw {formatWarsawClock(now)} ·{' '}
            {strings.config.warsawCutoff}
          </p>
        </div>

        <OrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          parts={orderableEntries}
          totals={totals}
          pricesExVat={pricesExVat}
        />
      </main>
    </>
  )
}
