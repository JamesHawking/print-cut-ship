import { Box, FileClock, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatPln } from '@/lib/format'
import { PRICING } from '@/lib/pricing-config'
import type { Part } from '@/hooks/useParts'
import type { PartQuote } from '@/lib/pricing'

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
  return (
    <ul className="space-y-2">
      {parts.map((part) => {
        const quote = quotes.get(part.id)
        return (
          <li key={part.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(part.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(part.id)
                }
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                selectedId === part.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                {part.status === 'parsing' ? (
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                ) : part.status === 'error' && part.kind === 'step' ? (
                  <FileClock className="text-muted-foreground size-4" />
                ) : (
                  <Box className="text-primary size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{part.fileName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {part.status === 'parsing'
                    ? 'Reading…'
                    : part.status === 'error'
                      ? part.kind === 'step'
                        ? 'Manual quote'
                        : 'Failed'
                      : `${PRICING.processes[part.config.process].label} · ×${part.config.quantity}`}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                {quote && !quote.blocked
                  ? formatPln(quote.lineTotalPln)
                  : quote?.blocked
                    ? '—'
                    : ''}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
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
