import { Fragment, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDims, formatInt } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import type { MeshMetrics } from '@/lib/mesh/types'

/**
 * The intake card's measuring face (Mobile Audit 2a-02). Deliberately the
 * SAME white card the idle state occupies — same position, same width, same
 * 56px button slot — so idle → measuring reads as one object changing state
 * rather than two surfaces swapping. Contents: the file, a bar that runs the
 * measuring floor, and the geometry facts as the local parse lands them
 * (the honesty beat: nothing has been uploaded yet).
 */
export function MeasuringCard({
  fileName,
  metrics,
  className,
}: {
  fileName: string
  metrics?: MeshMetrics
  className?: string
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console

  // The fill starts just after mount so the width transition runs (a value
  // set during the first paint would snap). A timer, not rAF: rAF is frozen
  // in backgrounded tabs, which would leave the bar parked at its start.
  const [running, setRunning] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setRunning(true), 30)
    return () => clearTimeout(id)
  }, [])

  // Facts appear together when the worker returns; before that the card
  // carries the file and the bar alone.
  const facts: Array<{ label: string; value: string; ok?: boolean }> = metrics
    ? [
        {
          label: c.factsTriangles,
          value: formatInt(metrics.triangleCount, locale),
        },
        { label: c.factsBbox, value: formatDims(metrics.bboxMm, locale) },
        ...(metrics.watertight
          ? [{ label: c.factsWatertight, value: c.factsYes, ok: true }]
          : []),
      ]
    : []

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in flex flex-1 flex-col motion-safe:duration-300',
        className,
      )}
    >
      <p className="text-muted-foreground font-mono text-[0.6rem] font-bold tracking-[0.18em] uppercase">
        {c.measuring}
      </p>
      <p className="mt-2.5 font-mono text-sm font-bold break-all">{fileName}</p>
      {/* Runs the measuring floor, stopping short of full: the quote, not the
        bar, is what completes it. */}
      <span
        aria-hidden
        className="bg-secondary mt-3 block h-1 overflow-hidden rounded-full"
      >
        <span
          className="bg-primary block h-full rounded-full motion-safe:transition-[width] motion-safe:ease-out"
          style={{
            width: running ? '92%' : '6%',
            transitionDuration: '2400ms',
          }}
        />
      </span>
      {facts.length > 0 && (
        <dl className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in mt-3.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 font-mono text-[11px]">
          {facts.map((f) => (
            <Fragment key={f.label}>
              <dt>{f.label}</dt>
              <dd
                className={cn('text-right tabular-nums', f.ok && 'text-signal')}
              >
                {f.value}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
      {/* The idle card's orange button, greyed in place. */}
      <span
        aria-hidden
        className="bg-secondary text-muted-foreground mt-auto flex h-14 items-center justify-center rounded-lg pt-px text-[15px] font-bold"
      >
        {c.pricing}
      </span>
    </div>
  )
}
