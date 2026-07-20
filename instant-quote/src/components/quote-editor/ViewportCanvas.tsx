import { CornerMarks } from '@/components/DropZone'
import { QuoteEmptyState } from '@/components/QuoteEmptyState'
import { ViewerFallback } from '@/components/ViewerFallback'
import { ViewerPane } from '@/components/ViewerPane'
import type { Part } from '@/hooks/useParts'
import { useStrings } from '@/lib/i18n'
import type { CameraPreset } from '@/lib/camera-presets'
import type { PartQuote, ProcessId } from '@/lib/api/client'
import { ChecksRail } from './ChecksRail'
import { MaterialsBench } from './MaterialsBench'

export type CanvasStatus = 'empty' | 'parsing' | 'error' | 'ready'

interface Props {
  part: Part | null
  quote: PartQuote | null
  status: CanvasStatus
  viewerEnabled: boolean
  gridVisible: boolean
  autoRotate: boolean
  viewRequest: { preset: CameraPreset; nonce: number } | null
  resetNonce: number
  /** Checks rail: hovered previews, pinned survives mouse-out. */
  checkHovered: string | null
  checkPinned: string | null
  onCheckHover: (code: string | null) => void
  onCheckTogglePin: (code: string) => void
  compareOpen: boolean
  onCloseCompare: () => void
  onSelectProcess: (process: ProcessId) => void
  onFiles: (files: File[]) => void
  onUrl: (url: string) => void
  urlPending: boolean
}

/**
 * The desktop editor's full-bleed stage: the R3F canvas with corner
 * registration marks, the DFM checks rail (bottom-left), the dims badge
 * (bottom-right) and the slide-up materials bench — or, with no parts, the
 * blueprint intake. Chrome (metrics) lives in the StatusStrip below.
 */
export function ViewportCanvas({
  part,
  quote,
  status,
  viewerEnabled,
  gridVisible,
  autoRotate,
  viewRequest,
  resetNonce,
  checkHovered,
  checkPinned,
  onCheckHover,
  onCheckTogglePin,
  compareOpen,
  onCloseCompare,
  onSelectProcess,
  onFiles,
  onUrl,
  urlPending,
}: Props) {
  const strings = useStrings()

  const activeCheck = checkHovered ?? checkPinned
  const overlay =
    activeCheck === 'multi_plate' &&
    quote?.dfmFlags.some((f) => f.code === 'multi_plate')
      ? ('multi_plate' as const)
      : null

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      {status === 'ready' && part?.positions && part.metrics ? (
        <div className="relative flex-1">
          <ViewerPane
            key={part.id}
            enabled={viewerEnabled}
            showGrid={gridVisible}
            autoRotate={autoRotate}
            viewRequest={viewRequest}
            resetNonce={resetNonce}
            positions={part.positions}
            bboxMm={part.metrics.bboxMm}
            overlay={overlay}
            dimsBadgeCorner="right"
          />
          <CornerMarks />
          <ChecksRail
            quote={quote}
            hovered={checkHovered}
            pinned={checkPinned}
            onHover={onCheckHover}
            onTogglePin={onCheckTogglePin}
          />
          {compareOpen && part.hash && (
            <MaterialsBench
              part={{ ...part, hash: part.hash }}
              onSelectProcess={onSelectProcess}
              onClose={onCloseCompare}
            />
          )}
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-1 p-4">
          <ViewerFallback />
        </div>
      ) : status === 'empty' ? (
        <QuoteEmptyState
          onFiles={onFiles}
          onUrl={onUrl}
          urlPending={urlPending}
        />
      ) : (
        <div className="bg-muted/30 flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {strings.dropzone.parsing}
          </p>
        </div>
      )}
    </div>
  )
}
