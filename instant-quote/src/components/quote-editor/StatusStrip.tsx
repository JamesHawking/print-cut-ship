import { formatDims, formatInt, formatVolume } from '@/lib/format'
import type { Part } from '@/hooks/useParts'
import { useLocale, useStrings } from '@/lib/i18n'
import type { PartQuote } from '@/lib/api/client'

interface Props {
  part: Part | null
  quote: PartQuote | null
  clock: string | null
}

/**
 * Instrument strip along the bottom of the desktop editor: measured facts
 * about the part on stage (dims · billable volume · triangles) left, the
 * Warsaw clock + cutoff right. Horizontal variant of ViewerFrame's strip.
 */
export function StatusStrip({ part, quote, clock }: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const metrics = part?.metrics

  return (
    <footer className="text-muted-foreground flex h-8 shrink-0 items-center gap-4 border-t px-4 font-mono text-[0.625rem] tracking-[0.16em] uppercase tabular-nums">
      {metrics && (
        <>
          <span>
            {strings.viewer.boundingBox}{' '}
            <span className="text-foreground font-bold">
              {formatDims(metrics.bboxMm, locale)}
            </span>
          </span>
          <span>
            {strings.viewer.billableVolume}{' '}
            <span className="text-foreground font-bold">
              {formatVolume(
                quote?.billableVolumeCm3 ?? metrics.volumeCm3,
                locale,
              )}
            </span>
          </span>
          <span>
            {strings.viewer.triangles}{' '}
            <span className="text-foreground font-bold">
              {formatInt(metrics.triangleCount, locale)}
            </span>
          </span>
        </>
      )}
      <span className="ml-auto">
        {strings.config.warsawTz}{' '}
        <span className={clock ? undefined : 'opacity-40'}>
          {clock ?? '--:--'}
        </span>{' '}
        · {strings.config.warsawCutoff}
      </span>
    </footer>
  )
}
