import { Box, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDecimal } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { MESH_STAGES, stagePercent, type MeshStage } from '@/lib/mesh/types'

/**
 * The intake's measuring face (Mobile Audit 5a `vWork`). It occupies the same
 * fixed panel box as the three tabs, so the drop → measuring swap cannot move
 * the quote chamber or the fold (5c: "the fold never moves").
 *
 * Every mark here is backed by work that actually finished: the four stages
 * are real await boundaries in the pipeline (bytes + hash, parser, geometry
 * check, engine), reported by the mesh worker and the price query. The bar is
 * their completed fraction — so it is checkable against the list beside it,
 * and it only ever moves forward. There is deliberately no indeterminate
 * spinner and no timed fill: 5c's rule is that progress is honest.
 */
export function MeasuringPanel({
  fileName,
  fileSize,
  stage,
}: {
  fileName: string
  fileSize: number
  /** Last stage that completed; undefined until the first one lands. */
  stage?: MeshStage
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console
  const done = stage ? MESH_STAGES.indexOf(stage) + 1 : 0
  const pct = stagePercent(stage)

  const labels: Record<MeshStage, string> = {
    read: c.stageRead,
    mesh: c.stageMesh,
    solid: c.stageSolid,
    price: c.stagePrice,
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:ease-enter flex h-full flex-col gap-4 motion-safe:duration-(--duration-panel)">
      {/* The dropzone's medallion becomes the file it accepted. */}
      <div className="flex shrink-0 items-center gap-3.5 rounded-lg border p-3">
        <span
          aria-hidden
          className="border-muted-foreground/25 flex size-9 shrink-0 items-center justify-center rounded-md border"
        >
          <Box className="text-primary-text size-5" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12.5px] font-bold">
            {fileName}
          </span>
          <span className="text-muted-foreground mt-0.5 block font-mono text-[9.6px] tracking-[0.08em] uppercase">
            {/* Floor at 0.1 so tiny files don't read "0 MB". */}
            {c.chipSize(
              formatDecimal(Math.max(fileSize / 1e6, 0.1), locale, 1),
            )}
          </span>
        </span>
        <span className="text-primary-text shrink-0 font-mono text-[13px] font-bold tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Linear only — 5b forbids easing on progress; an eased bar implies a
        speed the work doesn't have. */}
      <span
        role="progressbar"
        aria-label={c.progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-secondary block h-1 shrink-0 overflow-hidden rounded-full"
      >
        <span
          className="bg-primary block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-(--duration-flip) motion-safe:ease-linear"
          style={{ width: `${pct}%` }}
        />
      </span>

      <ol className="flex flex-col gap-2">
        {MESH_STAGES.map((s, i) => {
          const complete = i < done
          return (
            <li
              key={s}
              className={cn(
                'flex items-center gap-2.5 font-mono text-[11.5px] tracking-[0.04em] motion-safe:transition-opacity motion-safe:duration-(--duration-flip)',
                complete ? 'opacity-100' : 'opacity-35',
              )}
            >
              <span
                aria-hidden
                className="text-primary-text flex w-3 shrink-0 justify-center"
              >
                {complete ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <span className="bg-muted-foreground size-1 rounded-full" />
                )}
              </span>
              {labels[s]}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
