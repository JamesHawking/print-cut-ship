import type { ReactNode } from 'react'
import { CornerMarks } from './DropZone'
import { formatDims, formatVolume } from '@/lib/format'
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
  const ext = (part.fileName.split('.').pop() ?? '').toUpperCase()
  const metrics = part.metrics
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
          Part {String(index + 1).padStart(2, '0')} · Preview
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
              {formatDims(metrics.bboxMm)}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              Bounding box
            </dd>
          </div>
          <div className="bg-card px-4 py-3">
            <dt className="font-mono text-xs leading-none font-bold tabular-nums">
              {formatVolume(quote?.billableVolumeCm3 ?? metrics.volumeCm3)}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              Billable volume
            </dd>
          </div>
          <div className="bg-card px-4 py-3">
            <dt className="font-mono text-xs leading-none font-bold tabular-nums">
              {metrics.triangleCount.toLocaleString('pl-PL')}
            </dt>
            <dd className="text-muted-foreground mt-2 font-mono text-[0.5625rem] tracking-wider uppercase">
              Triangles
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
