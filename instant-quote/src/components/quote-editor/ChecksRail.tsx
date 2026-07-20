import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
import type { DfmFlag, PartQuote } from '@/lib/api/client'

// Severity → dot/accent color, mirrored by the 3D overlay.
const SEV_COLOR: Record<DfmFlag['severity'], string> = {
  block: 'var(--destructive)',
  warn: 'var(--highlight)',
  info: 'var(--info)',
}

interface Props {
  quote: PartQuote | null
  /** Code under the cursor — previews the overlay + message. */
  hovered: string | null
  /** Code clicked in place — survives mouse-out. */
  pinned: string | null
  onHover: (code: string | null) => void
  onTogglePin: (code: string) => void
}

/**
 * DFM checks rail overlaid on the editor viewport (bottom-left). One chip
 * per engine flag — hover previews, click pins; the pinned/hovered flag's
 * message floats above the chips. With a clean part, a single pulsing
 * "checks pass" chip.
 */
export function ChecksRail({
  quote,
  hovered,
  pinned,
  onHover,
  onTogglePin,
}: Props) {
  const strings = useStrings()
  const flags = quote?.dfmFlags ?? []
  const activeCode = hovered ?? pinned
  const activeFlag = flags.find((f) => f.code === activeCode)

  return (
    <div className="absolute bottom-2 left-2 flex max-w-[300px] flex-col items-start gap-1.5">
      {activeFlag && (
        <div className="border-border bg-card/95 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/[0.08] backdrop-blur duration-150">
          {strings.dfm.messages[activeFlag.code]?.(activeFlag.params ?? {}) ??
            strings.dfm.unknown}
        </div>
      )}
      {flags.length === 0 && quote ? (
        <span className="border-border bg-card/90 inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[0.59375rem] font-bold tracking-wider uppercase backdrop-blur">
          <span
            aria-hidden
            className="bg-signal motion-safe:animate-led inline-block size-1.5 rounded-full"
          />
          {strings.editor.checksPass}
        </span>
      ) : (
        flags.map((flag) => {
          const active = activeCode === flag.code
          const color = SEV_COLOR[flag.severity]
          return (
            <button
              key={flag.code}
              type="button"
              aria-pressed={pinned === flag.code}
              onMouseEnter={() => onHover(flag.code)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onTogglePin(flag.code)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[0.59375rem] font-bold tracking-wider uppercase backdrop-blur transition-colors',
                !active && 'border-border bg-card/90',
              )}
              style={
                active
                  ? {
                      borderColor: color,
                      background: `color-mix(in oklab, ${color} 12%, var(--card))`,
                    }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ background: color }}
              />
              {strings.dfm.labels[flag.code] ?? strings.dfm.unknownLabel}
            </button>
          )
        })
      )}
    </div>
  )
}
