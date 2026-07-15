import { AlertTriangle, Ban, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCatalog } from '@/hooks/useApi'
import type { DfmFlag } from '@/lib/api/client'

const ICON = {
  block: Ban,
  warn: AlertTriangle,
  info: Info,
} as const

const VARIANT = {
  block: 'destructive',
  warn: 'secondary',
  info: 'outline',
} as const

export function DfmBadges({ flags }: { flags: DfmFlag[] }) {
  const catalog = useCatalog()
  if (flags.length === 0) return null
  const labelOf = (id: string) =>
    catalog?.processes.find((p) => p.id === id)?.label ?? id
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => {
        const Icon = ICON[flag.severity]
        const suggestion =
          flag.suggestedProcesses && flag.suggestedProcesses.length > 0
            ? ` Try: ${flag.suggestedProcesses.map(labelOf).join(', ')}.`
            : ''
        return (
          <Tooltip key={flag.code}>
            <TooltipTrigger asChild>
              <Badge
                variant={VARIANT[flag.severity]}
                className="cursor-help gap-1"
              >
                <Icon className="size-3" />
                {label(flag.code)}
              </Badge>
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
