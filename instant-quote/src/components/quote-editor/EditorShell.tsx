import { useCallback, useState } from 'react'
import type { QuoteSummary } from '@/components/SiteHeader'
import type { Part } from '@/hooks/useParts'
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts'
import type { CameraPreset } from '@/lib/camera-presets'
import { MAX_PARTS } from '@/lib/upload'
import { cn } from '@/lib/utils'
import type { OrderTotals, PartConfig, PartQuote } from '@/lib/api/client'
import { EditorTopBar } from './EditorTopBar'
import { InspectorPanel } from './InspectorPanel'
import { PartsOutliner } from './PartsOutliner'
import { StatusStrip } from './StatusStrip'
import { ViewportCanvas, type CanvasStatus } from './ViewportCanvas'
import { ViewportToolbar } from './ViewportToolbar'

interface Props {
  className?: string
  parts: Part[]
  selectedPart: Part | null
  selectedQuote: PartQuote | null
  quotesById: Map<string, PartQuote>
  totals: OrderTotals | null
  priceEpoch: number
  recalculating: boolean
  pricesExVat: boolean
  onTogglePricesExVat: (value: boolean) => void
  orderableEntries: Array<{ part: Part; quote: PartQuote }>
  blockedCount: number
  breakdownSwitched: boolean
  summary: QuoteSummary | undefined
  clock: string | null
  priceQueryPending: boolean
  priceQueryIsError: boolean
  priceQueryError: Error | null
  onRefetchPrice: () => void
  /** False below lg — the mobile layout owns the canvas and shortcuts. */
  viewerEnabled: boolean
  onSelectPart: (id: string) => void
  onRemovePart: (id: string) => void
  onRetryUpload: (id: string) => void
  onConfigChange: (id: string, patch: Partial<PartConfig>) => void
  onFiles: (files: File[]) => void
  onUrl: (url: string) => void
  urlPending: boolean
  onOrderClick: () => void
}

/**
 * Desktop (≥lg) editor layout for /quote: slim top bar, parts outliner,
 * full-bleed viewport, inspector rail, status strip. Owns viewport-only UI
 * state (grid, auto-rotate, camera requests); quote state stays in quote.tsx.
 */
export function EditorShell({
  className,
  parts,
  selectedPart,
  selectedQuote,
  quotesById,
  totals,
  priceEpoch,
  recalculating,
  pricesExVat,
  onTogglePricesExVat,
  orderableEntries,
  blockedCount,
  breakdownSwitched,
  summary,
  clock,
  priceQueryPending,
  priceQueryIsError,
  priceQueryError,
  onRefetchPrice,
  viewerEnabled,
  onSelectPart,
  onRemovePart,
  onRetryUpload,
  onConfigChange,
  onFiles,
  onUrl,
  urlPending,
  onOrderClick,
}: Props) {
  const [gridVisible, setGridVisible] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)
  const [viewRequest, setViewRequest] = useState<{
    preset: CameraPreset
    nonce: number
  } | null>(null)
  const [resetNonce, setResetNonce] = useState(0)

  const status: CanvasStatus =
    parts.length === 0
      ? 'empty'
      : selectedPart?.status === 'ready' &&
          selectedPart.positions &&
          selectedPart.metrics
        ? 'ready'
        : selectedPart?.status === 'error'
          ? 'error'
          : 'parsing'

  const requestPreset = useCallback(
    (preset: CameraPreset) => setViewRequest({ preset, nonce: Date.now() }),
    [],
  )
  const requestReset = useCallback(() => setResetNonce((n) => n + 1), [])
  const toggleGrid = useCallback(() => setGridVisible((v) => !v), [])
  const toggleAutoRotate = useCallback(() => setAutoRotate((v) => !v), [])

  // View tools only make sense with a part on stage.
  const toolsEnabled = viewerEnabled && status === 'ready'
  useEditorShortcuts({
    enabled: toolsEnabled,
    onPreset: requestPreset,
    onReset: requestReset,
    onToggleGrid: toggleGrid,
    onToggleAutoRotate: toggleAutoRotate,
  })

  return (
    <section className={cn('bg-background h-dvh flex-col', className)}>
      <EditorTopBar
        summary={summary}
        totals={totals}
        pricesExVat={pricesExVat}
        priceEpoch={priceEpoch}
        recalculating={recalculating}
        orderableCount={orderableEntries.length}
        onOrderClick={onOrderClick}
        toolbar={
          status === 'ready' ? (
            <ViewportToolbar
              onPreset={requestPreset}
              onReset={requestReset}
              gridVisible={gridVisible}
              onToggleGrid={toggleGrid}
              autoRotate={autoRotate}
              onToggleAutoRotate={toggleAutoRotate}
            />
          ) : null
        }
      />
      <div className="flex min-h-0 flex-1">
        <PartsOutliner
          parts={parts}
          quotes={quotesById}
          selectedId={selectedPart?.id ?? null}
          onSelect={onSelectPart}
          onRemove={onRemovePart}
          onRetryUpload={onRetryUpload}
          canAddMore={parts.length < MAX_PARTS}
          onFiles={onFiles}
          onUrl={onUrl}
          urlPending={urlPending}
        />
        <ViewportCanvas
          part={selectedPart}
          status={status}
          viewerEnabled={viewerEnabled}
          gridVisible={gridVisible}
          autoRotate={autoRotate}
          viewRequest={viewRequest}
          resetNonce={resetNonce}
          onFiles={onFiles}
          onUrl={onUrl}
          urlPending={urlPending}
        />
        <InspectorPanel
          empty={status === 'empty'}
          selectedPart={selectedPart}
          selectedQuote={selectedQuote}
          priceQueryPending={priceQueryPending}
          priceQueryIsError={priceQueryIsError}
          priceQueryError={priceQueryError}
          onRefetchPrice={onRefetchPrice}
          totals={totals}
          orderableEntries={orderableEntries}
          blockedCount={blockedCount}
          breakdownSwitched={breakdownSwitched}
          pricesExVat={pricesExVat}
          onTogglePricesExVat={onTogglePricesExVat}
          priceEpoch={priceEpoch}
          recalculating={recalculating}
          onConfigChange={onConfigChange}
          onRetryUpload={onRetryUpload}
          onOrderClick={onOrderClick}
        />
      </div>
      <StatusStrip part={selectedPart} quote={selectedQuote} clock={clock} />
    </section>
  )
}
