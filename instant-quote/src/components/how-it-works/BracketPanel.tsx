import { cn } from '@/lib/utils'
import { formatInt, formatMm } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { BRACKET_WIREFRAME } from './bracket-svg'
import { SAMPLE_METRICS, STAGE_ORDER, type Stage } from './demo'

const MEASURE_IDX = STAGE_ORDER.indexOf('measure')

/**
 * The part the demo run quotes, as an engineering wireframe — the REAL
 * bracket's crease edges (bracket-svg.ts is drift-pinned to the STL fixture).
 * Edges draw in when the log reaches MEASURE, dimension callouts fade in
 * behind them. Like the terminal, the SSR/reduced-motion done-state ships
 * fully drawn; the whole drawing is aria-hidden (the sr-only summary in
 * HowItWorks carries its substance).
 */
export function BracketPanel({ stage }: { stage: Stage }) {
  const strings = useStrings()
  const locale = useLocale()
  const demo = strings.process.demo
  const drawn = STAGE_ORDER.indexOf(stage) >= MEASURE_IDX
  const w = BRACKET_WIREFRAME

  return (
    <div className="border-foreground/20 bg-background flex h-full flex-col border">
      <div className="border-foreground/20 flex items-center gap-2 border-b px-4 py-2 sm:px-5">
        <span
          aria-hidden
          className={cn(
            'bg-primary size-1.5 rounded-full transition-opacity',
            drawn ? 'motion-safe:animate-led opacity-100' : 'opacity-30',
          )}
        />
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          {demo.meshLabel(formatInt(SAMPLE_METRICS.triangleCount, locale))}
        </span>
      </div>
      <div aria-hidden className="flex flex-1 items-center px-4 py-5 sm:px-5">
        <svg
          viewBox={w.viewBox}
          className="mx-auto h-auto w-full max-w-[340px]"
          role="presentation"
        >
          <polygon
            points={w.topFace.map((p) => `${p.x},${p.y}`).join(' ')}
            className={cn(
              'fill-foreground/8 transition-opacity duration-700',
              drawn ? 'opacity-100' : 'opacity-0',
            )}
            style={drawn ? { transitionDelay: '700ms' } : undefined}
          />
          {w.edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={drawn ? 0 : 1}
              className="stroke-foreground/80 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
              style={
                drawn
                  ? { transitionDelay: `${Math.min(i * 45, 900)}ms` }
                  : undefined
              }
              strokeWidth={1.1}
            />
          ))}
          <g
            className={cn(
              'transition-opacity duration-500',
              drawn ? 'opacity-100' : 'opacity-0',
            )}
            style={drawn ? { transitionDelay: '1050ms' } : undefined}
          >
            {w.dims.map((d, i) => (
              <g key={i}>
                <line
                  {...d.line}
                  className="stroke-muted-foreground"
                  strokeWidth={0.7}
                />
                {d.ticks.map((t, j) => (
                  <line
                    key={j}
                    {...t}
                    className="stroke-muted-foreground"
                    strokeWidth={0.7}
                  />
                ))}
                <text
                  x={d.labelX}
                  y={d.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground font-mono text-[8px]"
                >
                  {formatMm(d.mm, locale)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
