import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { DropZone } from '@/components/DropZone'
import { SiteHeader } from '@/components/SiteHeader'
import { QuoteEmptyState } from '@/components/QuoteEmptyState'
import { OrderDialog } from '@/components/OrderDialog'
import { PartsList } from '@/components/PartsList'
import { ViewerFrame } from '@/components/ViewerFrame'
import { ViewerPane } from '@/components/ViewerPane'
import { ViewerFallback } from '@/components/ViewerFallback'
import { EditorShell } from '@/components/quote-editor/EditorShell'
import { QuoteColumnContent } from '@/components/quote-editor/QuoteColumnContent'
import { Button } from '@/components/ui/button'

import { useParts, type Part } from '@/hooks/useParts'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  api,
  toApiMetrics,
  type PartConfig,
  type PartQuote,
} from '@/lib/api/client'
import { MAX_PARTS } from '@/lib/upload'
import { ApiRequestError } from '@/lib/api/errors'
import { pickSelectedPart } from '@/lib/select-part'
import { track } from '@/lib/funnel'
import { useWarsawClock } from '@/hooks/useWarsawClock'
import { useCatalog, useShipDates } from '@/hooks/useApi'
import { formatPln, formatShipWeekday } from '@/lib/format'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  useStrings,
} from '@/lib/i18n'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/quote')({
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return seoHead({
      locale,
      path: match.pathname,
      title: s.meta.quote.title,
      description: s.meta.quote.description,
      noindex: true,
    })
  },
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
    retryUpload,
  } = useParts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pricesExVat, setPricesExVat] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const clock = useWarsawClock()
  // Desktop (≥lg) gets the editor shell; below lg the shipped mobile layout
  // renders. Gates which breakpoint owns the R3F canvas + shortcuts.
  const isDesktop = useMediaQuery('(min-width: 1024px)', true)

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
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    enabled: readyParts.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })

  // Minimum on-screen beat for the reprice sequence. Local dev answers in
  // ~50 ms — without this, dim+dot never paint and the flash reads as a
  // blink. First load commits immediately (the skeleton covers that wait).
  const MIN_RECALC_MS = 500
  const fetching = priceQuery.isFetching && !priceQuery.isPending
  const [shown, setShown] = useState<{
    data: NonNullable<typeof priceQuery.data>
    epoch: number
  } | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const busySinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (fetching) {
      busySinceRef.current = Date.now()
      setRecalculating(true)
      return
    }
    if (!priceQuery.data) {
      // Failed first fetch — the error card takes over; don't stay busy.
      if (priceQuery.isError) {
        busySinceRef.current = null
        setRecalculating(false)
      }
      return
    }
    const data = priceQuery.data
    const elapsed =
      busySinceRef.current == null
        ? MIN_RECALC_MS
        : Date.now() - busySinceRef.current
    busySinceRef.current = null
    const commit = () => {
      setShown({ data, epoch: Date.now() })
      setRecalculating(false)
    }
    if (elapsed >= MIN_RECALC_MS) {
      commit()
      return
    }
    const t = setTimeout(commit, MIN_RECALC_MS - elapsed)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetching, priceQuery.data, priceQuery.isError])

  // At most 5 parts — cheap to rebuild each render, keeps the map in sync.
  // Response parts come back in request order. Reads from `shown`, not the
  // raw query (see above).
  const quotesById = new Map<string, PartQuote>()
  if (shown && shown.data.parts.length === readyParts.length) {
    readyParts.forEach((p, i) => {
      quotesById.set(p.id, shown.data.parts[i])
    })
  }

  const orderableEntries = readyParts
    .map((p) => ({ part: p as Part, quote: quotesById.get(p.id) }))
    .filter(
      (e): e is { part: Part; quote: PartQuote } =>
        !!e.quote && !e.quote.blocked,
    )

  const totals = shown?.data.totals ?? null

  // The keyed price elements flash exactly when `shown` commits (see above).
  const priceEpoch = shown?.epoch ?? 0

  // Blocked parts are quoted but excluded from the order — say so.
  const blockedCount = readyParts.filter(
    (p) => quotesById.get(p.id)?.blocked,
  ).length

  const selectedPart = pickSelectedPart(parts, selectedId)
  const selectedQuote = selectedPart
    ? (quotesById.get(selectedPart.id) ?? null)
    : null
  // When the selected part is blocked, OrderPanel shows another part's
  // breakdown — name it so the switch isn't silent.
  const breakdownSwitched = !!selectedQuote?.blocked

  // Running-quote summary for the header sub-bar. Reflects the selected part's
  // material/lead/ship (parts can differ) and the order total; shown only once
  // a price exists — the same gate as OrderPanel.
  const catalog = useCatalog()
  const shipDates = useShipDates()
  const summaryShip = selectedPart
    ? shipDates?.find((s) => s.leadTime === selectedPart.config.leadTime)
    : undefined
  const summary =
    totals && selectedPart
      ? {
          partCount: orderableEntries.length,
          materialLabel:
            catalog?.processes.find((p) => p.id === selectedPart.config.process)
              ?.label ?? '',
          leadLabel: strings.config[selectedPart.config.leadTime],
          shipLabel: summaryShip
            ? formatShipWeekday(summaryShip.date, locale)
            : undefined,
          grossTotalPln: totals.grossTotalPln,
        }
      : undefined

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
      {/* Mobile/tablet (<lg): the shipped layout, untouched. */}
      <div className="lg:hidden">
        {parts.length === 0 ? (
          // No parts — a refresh, a deep link, or the last part removed. Stay
          // here with a welcoming intake instead of bouncing to the landing.
          <>
            <SiteHeader variant="quote" />
            <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
              <QuoteEmptyState
                onFiles={handleMoreFiles}
                onUrl={handleMakerworldUrl}
                urlPending={mwPending}
              />
              <p className="text-muted-foreground text-center font-mono text-[0.625rem] tracking-[0.16em] uppercase tabular-nums">
                {strings.config.warsawTz}{' '}
                <span className={clock ? undefined : 'opacity-40'}>
                  {clock ?? '--:--'}
                </span>{' '}
                · {strings.config.warsawCutoff}
              </p>
            </main>
          </>
        ) : (
          <>
            <SiteHeader variant="quote" summary={summary} />
            <main
              className={`mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6${
                totals && orderableEntries.length > 0 ? 'pb-24 lg:pb-10' : ''
              }`}
            >
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* min-w-0 on both columns: the R3F canvas carries an inline
                      pixel size, and without this the grid item's min-width:auto
                      propagates it — the track can't shrink on desktop→mobile
                      resize, the ResizeObserver never sees the new size, and the
                      canvas stays stuck at desktop width (overflow + blank view). */}
                  <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
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
                          enabled={!isDesktop}
                          positions={selectedPart.positions}
                          bboxMm={selectedPart.metrics.bboxMm}
                        />
                      </ViewerFrame>
                    ) : selectedPart?.status === 'error' ? (
                      <ViewerFallback />
                    ) : (
                      <div className="bg-muted/30 flex h-full min-h-[240px] items-center justify-center rounded-lg border sm:min-h-[340px]">
                        <p className="text-muted-foreground text-sm">
                          {strings.dropzone.parsing}
                        </p>
                      </div>
                    )}
                  </div>

                  <QuoteColumnContent
                    selectedPart={selectedPart}
                    selectedQuote={selectedQuote}
                    priceQueryPending={priceQuery.isPending}
                    priceQueryIsError={priceQuery.isError}
                    priceQueryError={priceQuery.error}
                    onRefetchPrice={() => void priceQuery.refetch()}
                    totals={totals}
                    orderableEntries={orderableEntries}
                    blockedCount={blockedCount}
                    breakdownSwitched={breakdownSwitched}
                    pricesExVat={pricesExVat}
                    onTogglePricesExVat={setPricesExVat}
                    priceEpoch={priceEpoch}
                    recalculating={recalculating}
                    onConfigChange={handleConfigChange}
                    onRetryUpload={retryUpload}
                    onOrderClick={handleOrderClick}
                  />
                </div>

                {parts.length > 1 && (
                  <PartsList
                    parts={parts}
                    quotes={quotesById}
                    selectedId={selectedPart?.id ?? null}
                    onSelect={setSelectedId}
                    onRemove={remove}
                    onRetryUpload={retryUpload}
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
                  {strings.config.warsawTz}{' '}
                  <span className={clock ? undefined : 'opacity-40'}>
                    {clock ?? '--:--'}
                  </span>{' '}
                  · {strings.config.warsawCutoff}
                </p>
              </div>

              {/* Mobile: persistent total + order CTA (desktop has OrderPanel). */}
              {totals && orderableEntries.length > 0 && (
                <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur duration-300 lg:hidden">
                  <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                    <div className="min-w-0">
                      <p className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider uppercase">
                        {strings.order.orderTotal}
                      </p>
                      <p
                        key={priceEpoch}
                        aria-live="polite"
                        className="motion-safe:animate-price-flash font-mono text-lg font-bold tabular-nums"
                      >
                        {formatPln(
                          pricesExVat
                            ? totals.netTotalPln
                            : totals.grossTotalPln,
                          locale,
                        )}
                      </p>
                    </div>
                    <Button
                      className="ml-auto font-bold"
                      onClick={handleOrderClick}
                    >
                      {strings.quote.orderButton(
                        formatPln(
                          pricesExVat
                            ? totals.netTotalPln
                            : totals.grossTotalPln,
                          locale,
                        ),
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>

      {/* Desktop (≥lg): the editor shell — full-bleed viewport, outliner,
          inspector, top bar. Same state, different presentation. */}
      <EditorShell
        className="hidden lg:flex"
        parts={parts}
        selectedPart={selectedPart}
        selectedQuote={selectedQuote}
        quotesById={quotesById}
        totals={totals}
        priceEpoch={priceEpoch}
        recalculating={recalculating}
        pricesExVat={pricesExVat}
        onTogglePricesExVat={setPricesExVat}
        orderableEntries={orderableEntries}
        blockedCount={blockedCount}
        breakdownSwitched={breakdownSwitched}
        summary={summary}
        clock={clock}
        priceQueryPending={priceQuery.isPending}
        priceQueryIsError={priceQuery.isError}
        priceQueryError={priceQuery.error}
        onRefetchPrice={() => void priceQuery.refetch()}
        viewerEnabled={isDesktop}
        onSelectPart={setSelectedId}
        onRemovePart={remove}
        onRetryUpload={retryUpload}
        onConfigChange={handleConfigChange}
        onFiles={handleMoreFiles}
        onUrl={handleMakerworldUrl}
        urlPending={mwPending}
        onOrderClick={handleOrderClick}
      />

      {totals && (
        <OrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          parts={orderableEntries}
          totals={totals}
          pricesExVat={pricesExVat}
        />
      )}
    </>
  )
}
