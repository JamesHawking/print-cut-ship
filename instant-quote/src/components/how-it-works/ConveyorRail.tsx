import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
import type { StationReadouts } from './demo'

const DOT_SIZE = 14 // matches size-3.5
const GHOST_SIZE = 8 // matches size-2

/**
 * The production line of the demo run: three station markers + the SHIPS
 * chip, connected by a dashed track — horizontal on md+, a vertical left
 * rail below. The dot's position is MEASURED (anchor centers via
 * getBoundingClientRect), not keyframed, so one mechanism serves both
 * orientations and survives any grid change; CSS transitions do the travel,
 * with a smaller ghost dot trailing 150ms behind to sell the motion.
 *
 * Stations fill in as the run commits them: the active one gets a status
 * LED, passed ones reveal their committed value (file, live price, ship
 * date — the same numbers as the log, via `readouts`) and a ✓.
 *
 * `anchorIdx`: 0-2 = stations, 3 = SHIPS chip, null = idle (dot parked at 0,
 * all stations pending).
 */
export function ConveyorRail({
  anchorIdx,
  readouts,
  shipsDateLabel,
}: {
  anchorIdx: 0 | 1 | 2 | 3 | null
  readouts: StationReadouts
  shipsDateLabel: string
}) {
  const strings = useStrings()
  const { steps, ships, shipsCutoff } = strings.process
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRefs = useRef<(HTMLElement | null)[]>([])
  const [dotXY, setDotXY] = useState<{ x: number; y: number } | null>(null)

  const dotAnchor = anchorIdx ?? 0

  // Measure the active anchor's center relative to the container. Re-runs on
  // stage change AND on any container resize (breakpoint flips re-layout the
  // rail, invalidating the previous measurement).
  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current
      const anchor = anchorRefs.current[dotAnchor]
      if (!container || !anchor) return
      const c = container.getBoundingClientRect()
      const a = anchor.getBoundingClientRect()
      setDotXY({
        x: a.left - c.left + a.width / 2,
        y: a.top - c.top + a.height / 2,
      })
    }
    measure()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [dotAnchor])

  // The dot only becomes visible after the first client-side measurement —
  // the server can't know pixel positions, so SSR ships no misplaced dot.
  const [measured, setMeasured] = useState(false)
  useEffect(() => {
    if (dotXY && !measured) setMeasured(true)
  }, [dotXY, measured])

  return (
    <div ref={containerRef} className="relative">
      {/* Tracks: horizontal on md+ (through the station squares), vertical
          left rail below (through the same squares). */}
      <div
        aria-hidden
        className="conveyor-track motion-safe:animate-conveyor absolute inset-x-0 top-[11px] hidden h-0.5 md:block"
      />
      <div
        aria-hidden
        className="conveyor-track-y absolute inset-y-0 left-[10px] w-0.5 md:hidden"
      />
      {/* The ghost — same measured travel, trailing 150ms behind the dot. */}
      <div
        aria-hidden
        className={cn(
          'bg-primary/40 absolute top-0 left-0 size-2 rounded-full transition-opacity motion-safe:transition-[transform,opacity] motion-safe:delay-150 motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.5,0,0.3,1)]',
          measured && anchorIdx !== null ? 'opacity-100' : 'opacity-0',
        )}
        style={
          dotXY
            ? {
                transform: `translate(${dotXY.x - GHOST_SIZE / 2}px, ${dotXY.y - GHOST_SIZE / 2}px)`,
              }
            : undefined
        }
      />
      {/* The traveling dot — position measured, travel by CSS transition. */}
      <div
        aria-hidden
        className={cn(
          'bg-primary absolute top-0 left-0 z-[1] size-3.5 rounded-full transition-opacity motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.5,0,0.3,1)]',
          measured ? 'opacity-100' : 'opacity-0',
        )}
        style={
          dotXY
            ? {
                transform: `translate(${dotXY.x - DOT_SIZE / 2}px, ${dotXY.y - DOT_SIZE / 2}px)`,
              }
            : undefined
        }
      />
      <div className="relative grid gap-10 pl-10 md:grid-cols-[1fr_1fr_1fr_190px] md:pl-0">
        {steps.map((step, i) => {
          const active = anchorIdx === i
          const passed = anchorIdx !== null && anchorIdx > i
          return (
            <div key={step.n} className="relative pt-1 md:pt-11">
              <span
                ref={(el) => {
                  anchorRefs.current[i] = el
                }}
                aria-hidden
                className={cn(
                  'absolute top-1 -left-10 size-[22px] border-[3px] transition-[background-color,border-color,transform] duration-300 md:left-0',
                  active
                    ? 'bg-primary border-primary scale-125'
                    : passed
                      ? 'bg-background border-primary/60'
                      : 'bg-background border-muted-foreground',
                )}
              />
              <p className="text-primary-text flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.14em]">
                {active && (
                  <span
                    aria-hidden
                    className="bg-primary motion-safe:animate-led size-1.5 rounded-full"
                  />
                )}
                {step.n} · {step.kicker}
                {passed && (
                  <span aria-hidden className="text-signal">
                    ✓
                  </span>
                )}
              </p>
              <h3 className="mt-2 text-[19px] leading-[1.2] font-extrabold">
                {step.title}
              </h3>
              {/* Committed value — always in the DOM (invisible until the
                  stage passes) so the rail never shifts layout mid-run. */}
              <p
                className={cn(
                  'text-muted-foreground mt-1.5 font-mono text-[11px] tabular-nums',
                  passed ? 'motion-safe:animate-log-line' : 'invisible',
                )}
              >
                {readouts[i]}
              </p>
            </div>
          )
        })}
        <div className="md:pt-9">
          <div
            className={cn(
              'flex flex-col gap-1.5 border px-5 py-[18px] transition-colors duration-300',
              anchorIdx === 3 ? 'border-signal/60' : 'border-foreground/20',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                ref={(el) => {
                  anchorRefs.current[3] = el
                }}
                aria-hidden
                className="bg-signal motion-safe:animate-ship-pulse size-2 rounded-full"
              />
              <span className="font-mono text-[10.5px] font-bold tracking-[0.14em]">
                {ships}
              </span>
            </div>
            <div className="text-[22px] leading-none font-extrabold">
              {shipsDateLabel}
            </div>
            <div className="text-muted-foreground font-mono text-[10px]">
              {shipsCutoff}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
