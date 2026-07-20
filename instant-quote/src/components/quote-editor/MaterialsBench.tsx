import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Part } from '@/hooks/useParts'
import { useCatalog } from '@/hooks/useApi'
import { api, toApiMetrics, type ProcessId } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { formatDecimal, formatPln } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useLocale, useStrings } from '@/lib/i18n'

interface Props {
  /** The part being compared — priced against every catalog process. */
  part: Part & { hash: string }
  onSelectProcess: (process: ProcessId) => void
  onClose: () => void
}

/**
 * Materials bench: the slide-up compare panel docked to the bottom of the
 * editor viewport. One live-priced row per catalog process at the part's
 * current quantity/lead time; clicking a row switches the part's process.
 */
export function MaterialsBench({ part, onSelectProcess, onClose }: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const catalog = useCatalog()

  const compareQuery = useQuery({
    queryKey: [
      'price-compare',
      part.hash,
      part.config.quantity,
      part.config.leadTime,
    ],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price/compare', {
        body: {
          metrics: toApiMetrics(part.metrics!),
          quantity: part.config.quantity,
          leadTime: part.config.leadTime,
        },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })

  const rows = compareQuery.data?.rows ?? []
  const priceOf = (id: string) => rows.find((r) => r.process === id)?.quote
  const currentUnit = priceOf(part.config.process)?.unitPricePln

  return (
    <div className="border-border bg-card/95 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in absolute inset-x-0 bottom-0 z-10 max-h-[320px] overflow-y-auto border-t backdrop-blur duration-200">
      <div className="border-border bg-card sticky top-0 flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
        <span className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
          {strings.editor.compareTitle} —{' '}
          {strings.editor.compareContext(
            part.config.quantity,
            strings.config[part.config.leadTime],
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-6"
          aria-label={strings.editor.compareClose}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {compareQuery.isPending &&
        Array.from({ length: catalog?.processes.length ?? 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-3.5 my-2 h-8 rounded-md" />
        ))}
      {compareQuery.isError && (
        <p className="text-destructive px-3.5 py-3 text-sm">
          {strings.editor.compareFailed}
        </p>
      )}

      {rows.map((row) => {
        const proc = catalog?.processes.find((p) => p.id === row.process)
        const current = row.process === part.config.process
        const blocked = row.quote.blocked
        const deltaPct =
          !current && currentUnit
            ? Math.round((row.quote.unitPricePln / currentUnit - 1) * 100)
            : 0
        return (
          <div
            key={row.process}
            role={blocked ? undefined : 'button'}
            tabIndex={blocked ? undefined : 0}
            aria-disabled={blocked || undefined}
            onClick={() => !blocked && onSelectProcess(row.process)}
            onKeyDown={(e) => {
              if (blocked) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectProcess(row.process)
              }
            }}
            className={cn(
              'border-border flex items-center gap-3.5 border-t px-3.5 py-2 transition-colors',
              blocked ? 'opacity-50' : 'hover:bg-primary/5 cursor-pointer',
              current &&
                'bg-secondary/50 shadow-[inset_2px_0_0_var(--foreground)]',
            )}
          >
            <span className="w-[110px] shrink-0 text-[0.8125rem] font-bold">
              {proc?.label ?? row.process}
            </span>
            <span className="text-muted-foreground w-[170px] shrink-0 font-mono text-[0.625rem] tracking-wider whitespace-nowrap tabular-nums">
              {proc &&
                `${formatDecimal(proc.densityGCm3, locale, 2, 2)} g/cm³ · ${proc.plnPerKg} zł/kg`}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-[0.71875rem]">
              {strings.editor.compareTaglines[row.process]}
            </span>
            <span
              className={cn(
                'w-[70px] shrink-0 text-right font-mono text-[0.59375rem] font-bold tracking-wider uppercase tabular-nums',
                current
                  ? 'text-signal'
                  : deltaPct > 0
                    ? 'text-primary-text'
                    : 'text-muted-foreground',
              )}
            >
              {blocked
                ? ''
                : current
                  ? strings.editor.compareCurrent
                  : deltaPct === 0
                    ? '±0%'
                    : deltaPct > 0
                      ? `+${deltaPct}%`
                      : `${deltaPct}%`}
            </span>
            <span className="w-[100px] shrink-0 text-right font-mono text-[0.8125rem] font-bold tabular-nums">
              {blocked
                ? strings.editor.compareUnavailable
                : formatPln(row.quote.unitPricePln, locale)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
