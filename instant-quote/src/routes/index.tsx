import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'

import { DropZone } from '@/components/DropZone'
import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Materials } from '@/components/Materials'
import { SiteFooter } from '@/components/SiteFooter'
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
import {
  parseMakerworldUrl,
  MAKERWORLD_ERROR_MESSAGES,
  type MakerworldErrorCode,
} from '@/lib/makerworld'
import { fetchMakerworldModel } from '@/server/makerworld.functions'
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
  const [mwPending, setMwPending] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
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

  // Paste-a-MakerWorld-link intake: the server function downloads the 3MF
  // (browser CORS rules out a direct fetch), then the bytes re-enter the
  // normal pipeline as a synthesized File.
  async function handleMakerworldUrl(url: string) {
    const ref = parseMakerworldUrl(url)
    if (!ref) {
      toast.error(strings.errors.mwInvalidUrl)
      return
    }
    setMwPending(true)
    track('makerworld_fetch_started', { ...ref })
    try {
      const res = await fetchMakerworldModel({ data: ref })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: MakerworldErrorCode
        } | null
        track('makerworld_fetch_failed', { ...ref, code: body?.code })
        toast.error(
          (body?.code && MAKERWORLD_ERROR_MESSAGES[body.code]) ??
            strings.errors.mwDownloadFailed,
        )
        return
      }
      const buf = await res.arrayBuffer()
      const name =
        decodeURIComponent(res.headers.get('x-mw-filename') ?? '') ||
        `makerworld-${ref.designId}.3mf`
      track('makerworld_fetch_succeeded', { ...ref, sizeBytes: buf.byteLength })
      await handleFiles([new File([buf], name, { type: 'model/3mf' })])
    } catch {
      track('makerworld_fetch_failed', { ...ref, code: 'network' })
      toast.error(strings.errors.mwDownloadFailed)
    } finally {
      setMwPending(false)
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

  if (parts.length === 0) {
    return (
      <>
        <Hero
          onFiles={handleFiles}
          onUrl={handleMakerworldUrl}
          urlPending={mwPending}
        />
        <HowItWorks />
        <Materials />
        <SiteFooter />
      </>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex items-center justify-between border-b pb-4 font-mono text-xs tracking-widest uppercase">
        <span className="font-bold">{strings.hero.wordmark}</span>
        <span className="text-muted-foreground hidden sm:inline">
          {strings.hero.status}
        </span>
      </header>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:sticky lg:top-6 lg:self-start">
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
            onFiles={handleFiles}
            variant="compact"
            onUrl={handleMakerworldUrl}
            urlPending={mwPending}
          />
        )}

        <p className="text-muted-foreground text-center font-mono text-[0.7rem] tracking-wide uppercase">
          Europe/Warsaw {formatWarsawClock(now)} · {strings.config.warsawCutoff}
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
  )
}
