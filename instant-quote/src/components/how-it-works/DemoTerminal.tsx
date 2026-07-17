import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
import type { LogLine } from './demo'

/**
 * The machine-log panel of the demo run. The FULL script is always in the
 * DOM — unrevealed lines are `invisible`, so the panel never changes height
 * mid-run (no layout shift below). The log itself is aria-hidden (the run is
 * summarized for screen readers by the sr-only paragraph in HowItWorks); the
 * Replay button is a real control outside that wrapper.
 */
export function DemoTerminal({
  lines,
  visible,
  running,
  onReplay,
}: {
  lines: LogLine[]
  visible: number
  running: boolean
  onReplay: () => void
}) {
  const strings = useStrings()
  const demo = strings.process.demo

  return (
    <div className="border-foreground/20 mt-10 border">
      <div className="border-foreground/20 flex items-center justify-between gap-4 border-b px-4 py-2 sm:px-5">
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          {demo.engineLabel}
        </span>
        <button
          type="button"
          onClick={onReplay}
          disabled={running}
          className="text-foreground focus-visible:ring-ring cursor-pointer font-mono text-[10px] tracking-[0.14em] uppercase transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-40"
        >
          {demo.replay} ↺
        </button>
      </div>
      <div
        aria-hidden
        className="px-4 py-4 font-mono text-[11px] leading-[1.95] sm:px-5"
      >
        {lines.map((line, i) => {
          const shown = i < visible
          const last = i === visible - 1
          return (
            <p
              key={i}
              className={cn(
                'flex gap-3',
                shown ? 'motion-safe:animate-log-line' : 'invisible',
              )}
            >
              {line.tag ? (
                <span className="text-primary-text w-16 shrink-0">
                  {line.tag}
                </span>
              ) : null}
              <span
                className={cn(
                  line.tag
                    ? line.strong
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground'
                    : 'text-foreground font-semibold',
                )}
              >
                {line.text}
                {running && last && (
                  <span className="motion-safe:animate-caret text-foreground ml-1">
                    ▊
                  </span>
                )}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
