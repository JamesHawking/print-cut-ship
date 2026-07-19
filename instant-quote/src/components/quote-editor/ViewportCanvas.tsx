import { CornerMarks } from '@/components/DropZone'
import { QuoteEmptyState } from '@/components/QuoteEmptyState'
import { ViewerFallback } from '@/components/ViewerFallback'
import { ViewerPane } from '@/components/ViewerPane'
import type { Part } from '@/hooks/useParts'
import { useStrings } from '@/lib/i18n'
import type { CameraPreset } from '@/lib/camera-presets'

export type CanvasStatus = 'empty' | 'parsing' | 'error' | 'ready'

interface Props {
  part: Part | null
  status: CanvasStatus
  viewerEnabled: boolean
  gridVisible: boolean
  autoRotate: boolean
  viewRequest: { preset: CameraPreset; nonce: number } | null
  resetNonce: number
  onFiles: (files: File[]) => void
  onUrl: (url: string) => void
  urlPending: boolean
}

/**
 * The desktop editor's full-bleed stage: the R3F canvas with corner
 * registration marks, or — with no parts — the blueprint intake. Chrome
 * (metrics) lives in the StatusStrip below, not boxed around the canvas.
 */
export function ViewportCanvas({
  part,
  status,
  viewerEnabled,
  gridVisible,
  autoRotate,
  viewRequest,
  resetNonce,
  onFiles,
  onUrl,
  urlPending,
}: Props) {
  const strings = useStrings()

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
          />
          <CornerMarks />
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
