import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCatalog } from '@/hooks/useApi'
import type { DfmFlag } from '@/lib/api/client'

// Severity-coded mono chips: blocking = filled red, warning = panel
// aluminum, info = outlined. Hover/tap reveals the full engine message.
const CHIP: Record<DfmFlag['severity'], string> = {
  block: 'bg-destructive text-destructive-foreground border-transparent',
  warn: 'bg-secondary text-foreground border-transparent',
  info: 'bg-card text-foreground border-border',
}

export function DfmBadges({ flags }: { flags: DfmFlag[] }) {
  const catalog = useCatalog()
  if (flags.length === 0) return null
  const labelOf = (id: string) =>
    catalog?.processes.find((p) => p.id === id)?.label ?? id
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => {
        const suggestion =
          flag.suggestedProcesses && flag.suggestedProcesses.length > 0
            ? ` Try: ${flag.suggestedProcesses.map(labelOf).join(', ')}.`
            : ''
        return (
          <Tooltip key={flag.code}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex cursor-help items-center rounded border px-2 py-1 font-mono text-[0.59375rem] font-bold tracking-wider uppercase',
                  CHIP[flag.severity],
                )}
              >
                {label(flag.code)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {flag.message}
              {suggestion}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

function label(code: DfmFlag['code']): string {
  switch (code) {
    case 'exceeds_build_volume':
      return 'Too large'
    case 'small_feature':
      return 'Thin feature'
    case 'min_volume_billed':
      return 'Min. volume'
    case 'geometry_approximated':
      return 'Geometry approximated'
    case 'multi_plate':
      return 'Multi-plate'
  }
}
