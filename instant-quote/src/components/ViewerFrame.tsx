import type { ReactNode } from 'react'
import { CornerMarks } from './DropZone'
import { formatDims, formatInt, formatVolume } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import type { Part } from '@/hooks/useParts'
import type { PartQuote } from '@/lib/api/client'

/**
 * Instrument-panel chrome around the 3D preview: part header with format
 * badge, corner registration marks over the canvas, and a measured-facts
 * strip (bounding box · billable volume · triangles) under it.
 */
export function ViewerFrame({
  part,
  index,
  quote,
  children,
}: {
  part: Part
  index: number
  quote: PartQuote | null
  children: ReactNode
}) {
  const strings = useStrings()
  const locale = useLocale()
  const ext = (part.fileName.split('.').pop() ?? '').toUpperCase()
  const metrics = part.metrics
  return (
    // Mounts when a part finishes parsing — settle in instead of snapping
    // (fade only under reduced motion).
    <div className="bg-card animate-in fade-in zoom-in-[0.98] motion-reduce:zoom-in-100 overflow-hidden rounded-lg border duration-200 ease-out">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
          {strings.viewer.partPreview(String(index + 1).padStart(2, '0'))}
        </span>
        <span className="rounded border px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tracking-wider">
          {ext}
        </span>
      </div>
      <div className="relative h-[340px]">
        {children}
        <CornerMarks />
      </div>
      {metrics && (
        <dl className="bg-border grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-px border-t">
          <div className="bg-card px-4 py-3">
            <dt className="font-mono text-xs leading-none font-bold whitespace-nowrap tabular-nums">
              {formatDims(metrics.bboxMm, locale)}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              {strings.viewer.boundingBox}
            </dd>
          </div>
          <div className="bg-card px-4 py-3">
            <dt className="font-mono text-xs leading-none font-bold tabular-nums">
              {formatVolume(
                quote?.billableVolumeCm3 ?? metrics.volumeCm3,
                locale,
              )}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              {strings.viewer.billableVolume}
            </dd>
          </div>
          <div className="bg-card px-4 py-3">
            <dt className="font-mono text-xs leading-none font-bold tabular-nums">
              {formatInt(metrics.triangleCount, locale)}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              {strings.viewer.triangles}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
