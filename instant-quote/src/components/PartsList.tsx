import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatPln } from '@/lib/format'
import { useCatalog } from '@/hooks/useApi'
import type { Part } from '@/hooks/useParts'
import type { PartQuote } from '@/lib/api/client'

interface Props {
  parts: Part[]
  quotes: Map<string, PartQuote>
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export function PartsList({
  parts,
  quotes,
  selectedId,
  onSelect,
  onRemove,
}: Props) {
  const catalog = useCatalog()
  const processLabel = (id: string) =>
    catalog?.processes.find((p) => p.id === id)?.label ?? id
  return (
    <ul className="space-y-2">
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
              aria-pressed={selected}
              onClick={() => onSelect(part.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(part.id)
                }
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                selected
                  ? 'border-foreground bg-secondary/50'
                  : 'border-border bg-card hover:bg-primary/5',
              )}
            >
              <span
                className={cn(
                  'bg-secondary min-w-11 shrink-0 rounded px-1.5 py-1 text-center font-mono text-[0.59375rem] font-bold tracking-wider',
                  part.status === 'error'
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                {ext}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-semibold"
                  title={part.fileName}
                >
                  {part.fileName}
                </span>
                <span className="text-muted-foreground mt-1 block truncate font-mono text-[0.59375rem] tracking-wider uppercase tabular-nums">
                  {part.status === 'parsing'
                    ? 'Reading…'
                    : part.status === 'error'
                      ? part.kind === 'step'
                        ? 'Manual quote'
                        : 'Failed'
                      : `${processLabel(part.config.process)} · ×${part.config.quantity}`}
                </span>
              </span>
              <span className="font-mono text-[0.8125rem] font-bold whitespace-nowrap tabular-nums">
                {quote && !quote.blocked
                  ? formatPln(quote.lineTotalPln)
                  : quote?.blocked
                    ? '—'
                    : ''}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                aria-label={`Remove ${part.fileName}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(part.id)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
