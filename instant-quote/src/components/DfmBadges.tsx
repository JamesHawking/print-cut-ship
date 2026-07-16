import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCatalog } from '@/hooks/useApi'
import { useStrings } from '@/lib/i18n'
import type { DfmFlag } from '@/lib/api/client'

// Severity-coded mono chips: blocking = filled red, warning = panel
// aluminum, info = outlined. Hover/tap reveals the full engine message.
const CHIP: Record<DfmFlag['severity'], string> = {
  block: 'bg-destructive text-destructive-foreground border-transparent',
  warn: 'bg-secondary text-foreground border-transparent',
  info: 'bg-card text-foreground border-border',
}

export function DfmBadges({ flags }: { flags: DfmFlag[] }) {
  const strings = useStrings()
  const catalog = useCatalog()
  if (flags.length === 0) return null
  const labelOf = (id: string) =>
    catalog?.processes.find((p) => p.id === id)?.label ?? id
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => {
        const suggestion =
          flag.suggestedProcesses && flag.suggestedProcesses.length > 0
            ? strings.dfm.suggestion(
                flag.suggestedProcesses.map(labelOf).join(', '),
              )
            : ''
        // Copy renders from code+params; flag.message is debug-only.
        // TODO(plan 11): Sentry breadcrumb when an unknown code falls through.
        const message =
          strings.dfm.messages[flag.code]?.(flag.params ?? {}) ??
          strings.dfm.unknown
        return (
          <Tooltip key={flag.code}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex cursor-help items-center rounded border px-2 py-1 font-mono text-[0.59375rem] font-bold tracking-wider uppercase',
                  CHIP[flag.severity],
                )}
              >
                {strings.dfm.labels[flag.code] ?? strings.dfm.unknownLabel}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {message}
              {suggestion}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
