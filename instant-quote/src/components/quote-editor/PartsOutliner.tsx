import { X } from 'lucide-react'
import { DropZone } from '@/components/DropZone'
import { Button } from '@/components/ui/button'
import { formatPln } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCatalog } from '@/hooks/useApi'
import type { Part } from '@/hooks/useParts'
import { MAX_PARTS } from '@/lib/upload'
import { useLocale, useStrings } from '@/lib/i18n'
import type { PartQuote } from '@/lib/api/client'

interface Props {
  parts: Part[]
  quotes: Map<string, PartQuote>
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onRetryUpload: (id: string) => void
  canAddMore: boolean
  onFiles: (files: File[]) => void
  onUrl: (url: string) => void
  urlPending: boolean
}

/**
 * Scene outliner for the desktop editor: every loaded part as a tree row
 * (selection drives the viewport + inspector), with the add-part intake
 * docked at the bottom. Denser variant of the mobile PartsList row.
 */
export function PartsOutliner({
  parts,
  quotes,
  selectedId,
  onSelect,
  onRemove,
  onRetryUpload,
  canAddMore,
  onFiles,
  onUrl,
  urlPending,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const catalog = useCatalog()
  const processLabel = (id: string) =>
    catalog?.processes.find((p) => p.id === id)?.label ?? id

  return (
    <aside
      aria-label={strings.editor.partsHeading(parts.length, MAX_PARTS)}
      className="flex w-64 shrink-0 flex-col border-r"
    >
      <div className="text-muted-foreground border-b px-3 py-2.5 font-mono text-[0.625rem] tracking-[0.2em] uppercase">
        {strings.editor.partsHeading(parts.length, MAX_PARTS)}
      </div>

      {parts.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-center text-sm">
          {strings.editor.outlinerEmpty}
        </p>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {parts.map((part) => {
            const quote = quotes.get(part.id)
            const selected = selectedId === part.id
            const ext =
              part.status === 'parsing'
                ? '…'
                : (part.fileName.split('.').pop() ?? '').toUpperCase()
            return (
              <li key={part.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={selected || undefined}
                  onClick={() => onSelect(part.id)}
                  onKeyDown={(e) => {
                    // Bubbled keydowns from the inner remove/retry buttons:
                    // preventDefault here would cancel their activation.
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(part.id)
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors',
                    'animate-in fade-in slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0 duration-200 ease-out',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    selected
                      ? 'border-foreground bg-secondary/50'
                      : 'border-border bg-card hover:bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'bg-secondary min-w-10 shrink-0 rounded px-1.5 py-1 text-center font-mono text-[0.59375rem] font-bold tracking-wider',
                      part.status === 'error'
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {ext}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[0.8125rem] font-semibold"
                      title={part.fileName}
                    >
                      {part.fileName}
                    </span>
                    <span
                      key={part.status}
                      className="text-muted-foreground motion-safe:animate-status-settle mt-0.5 block truncate font-mono text-[0.59375rem] tracking-wider uppercase tabular-nums"
                    >
                      {part.status === 'parsing'
                        ? strings.partsList.reading
                        : part.status === 'error'
                          ? part.kind === 'step'
                            ? strings.partsList.manualQuote
                            : strings.partsList.failed
                          : `${processLabel(part.config.process)} · ×${part.config.quantity}`}
                    </span>
                    {part.uploadStatus === 'failed' && (
                      <button
                        type="button"
                        className="text-destructive mt-0.5 block font-mono text-[0.59375rem] tracking-wider uppercase underline underline-offset-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRetryUpload(part.id)
                        }}
                      >
                        {strings.partsList.uploadFailed} ·{' '}
                        {strings.partsList.retryUpload}
                      </button>
                    )}
                  </span>
                  <span className="font-mono text-[0.75rem] font-bold whitespace-nowrap tabular-nums">
                    {quote && !quote.blocked
                      ? formatPln(quote.lineTotalPln, locale)
                      : quote?.blocked
                        ? '—'
                        : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-6 shrink-0"
                    aria-label={strings.partsList.remove(part.fileName)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(part.id)
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canAddMore && (
        <div className="border-t p-3">
          <DropZone
            variant="compact"
            onFiles={onFiles}
            onUrl={onUrl}
            urlPending={urlPending}
          />
        </div>
      )}
    </aside>
  )
}
