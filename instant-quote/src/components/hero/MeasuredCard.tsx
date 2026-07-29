import { Check, Plus } from 'lucide-react'
import { formatDims } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import type { MeshMetrics } from '@/lib/mesh/types'

/**
 * The intake once the quote has landed (Mobile Audit 5a `vFile`): the island's
 * job is done, so it states what it measured and offers the one thing left to
 * do. It replaces both the dashed "add another" row and the separate
 * received-file receipt line the two of them used to share.
 *
 * The mock also draws Re-measure and Swap file. Re-measure would push
 * identical bytes through the worker for an identical result, and this app's
 * model is additive — a second file opens the full quote rather than replacing
 * the first — so a single "add another file" carries both.
 */
export function MeasuredCard({
  fileName,
  metrics,
  onAdd,
}: {
  fileName: string
  metrics?: MeshMetrics
  onAdd: () => void
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console

  // Both facts come out of the user's own geometry — that is what makes the
  // check mark mean something.
  const facts = [
    metrics?.watertight ? c.watertightOk : null,
    metrics ? formatDims(metrics.bboxMm, locale) : null,
  ].filter(Boolean)

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:ease-enter flex h-full flex-col gap-3 motion-safe:duration-(--duration-panel)">
      <div className="border-signal/40 bg-signal/5 flex shrink-0 items-center gap-3.5 rounded-lg border-[1.5px] p-3.5">
        <span
          aria-hidden
          className="bg-signal flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <Check className="text-background size-[18px]" strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12.5px] font-bold">
            {fileName}
          </span>
          {facts.length > 0 && (
            <span className="text-muted-foreground mt-0.5 block truncate font-mono text-[9.6px] tracking-[0.08em] uppercase">
              {facts.join(' · ')}
            </span>
          )}
        </span>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="border-muted-foreground/45 hover:border-primary/60 focus-visible:ring-ring text-muted-foreground flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed px-4 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Plus aria-hidden className="size-5 shrink-0" strokeWidth={1.8} />
        <span className="text-foreground text-[15px] font-bold">
          {c.addAnotherFile}
        </span>
        <span className="font-mono text-[9.6px] tracking-[0.1em] uppercase">
          {c.finePrintDrag}
        </span>
      </button>
    </div>
  )
}
