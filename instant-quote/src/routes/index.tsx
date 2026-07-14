import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'

import { DropZone } from '@/components/DropZone'
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
import { useMeshWorker } from '@/hooks/useMeshWorker'
import {
  computePartQuote,
  computeOrderTotals,
  type PartConfig,
  type PartQuote,
} from '@/lib/pricing'
import { classifyFile, MAX_FILE_BYTES, MAX_PARTS } from '@/lib/upload'
import { track } from '@/lib/funnel'
import { formatWarsawClock } from '@/lib/leadtime'
import { strings } from '@/lib/strings'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { parts, addFile, markParsed, markFailed, updateConfig, remove } =
    useParts()
  const { analyze } = useMeshWorker()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pricesExVat, setPricesExVat] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Ready mesh parts get a live quote via TanStack Query (pure fn as fetcher).
  const readyMeshParts = parts.filter(
    (p): p is Part & { hash: string } =>
      p.kind === 'mesh' && p.status === 'ready' && !!p.hash && !!p.metrics,
  )

  const quoteResults = useQueries({
    queries: readyMeshParts.map((p) => ({
      queryKey: ['quote', p.hash, p.config] as const,
      queryFn: () => computePartQuote(p.metrics!, p.config),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })

  // At most 5 parts — cheap to rebuild each render, keeps the map in sync.
  const quotesById = new Map<string, PartQuote>()
  readyMeshParts.forEach((p, i) => {
    const data = quoteResults[i]?.data
    if (data) quotesById.set(p.id, data)
  })

  const orderableEntries = readyMeshParts
    .map((p) => ({ part: p as Part, quote: quotesById.get(p.id) }))
    .filter(
      (e): e is { part: Part; quote: PartQuote } => !!e.quote && !e.quote.blocked,
    )

  const totals = computeOrderTotals(orderableEntries.map((e) => e.quote))

  const selectedPart =
    parts.find((p) => p.id === selectedId) ?? parts[parts.length - 1] ?? null
  const selectedQuote = selectedPart
    ? (quotesById.get(selectedPart.id) ?? null)
    : null

  async function handleFiles(files: File[]) {
    let slots = MAX_PARTS - parts.length
    for (const file of files) {
      if (slots <= 0) {
        toast.error(strings.errors.tooManyParts)
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(strings.errors.tooLarge, { description: file.name })
        continue
      }
      const kind = classifyFile(file.name)
      if (kind === 'unsupported') {
        toast.error(strings.errors.unsupported, { description: file.name })
        continue
      }
      slots -= 1
      track('upload_started', {
        fileName: file.name,
        kind,
        sizeBytes: file.size,
      })
      const id = addFile(file)
      setSelectedId(id)
      if (kind === 'step') continue

      analyze(file)
        .then((res) => {
          markParsed(id, res.hash, res.metrics, res.positions)
          track('parse_succeeded', {
            fileName: file.name,
            volumeCm3: res.metrics.volumeCm3,
            triangles: res.metrics.triangleCount,
          })
          track('quote_shown', { fileName: file.name })
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : strings.errors.parseFailed
          markFailed(id, 'parse', message)
          track('parse_failed', { fileName: file.name, message })
          toast.error(strings.errors.corrupt, { description: file.name })
        })
    }
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

  const hasParts = parts.length > 0

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {strings.hero.headline}
        </h1>
        <p className="text-muted-foreground mt-2">{strings.hero.trust}</p>
      </header>

      {!hasParts ? (
        <DropZone onFiles={handleFiles} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:sticky lg:top-6 lg:self-start">
              {selectedPart?.kind === 'mesh' &&
              selectedPart.status === 'ready' &&
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
              {selectedPart?.kind === 'step' ? (
                <StepManualCard part={selectedPart} />
              ) : selectedPart?.status === 'parsing' ? (
                <QuoteSkeleton />
              ) : selectedPart?.status === 'error' ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-destructive text-sm">
                      {selectedPart.error?.message ??
                        strings.errors.parseFailed}
                    </p>
                  </CardContent>
                </Card>
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
            <DropZone onFiles={handleFiles} compact />
          )}

          <p className="text-muted-foreground text-center text-xs">
            Europe/Warsaw {formatWarsawClock(now)} ·{' '}
            {strings.config.warsawCutoff}
          </p>
        </div>
      )}

      <OrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        parts={orderableEntries}
        totals={totals}
        pricesExVat={pricesExVat}
      />
    </main>
  )
}
