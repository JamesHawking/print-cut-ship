import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import {
  PRICING,
  PROCESS_IDS,
  LEAD_TIME_IDS,
  QUANTITY_CHIPS,
} from '@/lib/pricing-config'
import type { PartConfig, ProcessId, LeadTimeId } from '@/lib/pricing'
import { computeShipDate } from '@/lib/leadtime'
import { strings } from '@/lib/strings'

interface Props {
  config: PartConfig
  onChange: (patch: Partial<PartConfig>) => void
  now: Date
}

const LEAD_LABEL: Record<LeadTimeId, string> = {
  economy: strings.config.economy,
  standard: strings.config.standard,
  express: strings.config.express,
}

export function ConfigPanel({ config, onChange, now }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>{strings.config.process}</Label>
        <Select
          value={config.process}
          onValueChange={(v) => onChange({ process: v as ProcessId })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROCESS_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {PRICING.processes[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qty">{strings.config.quantity}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {QUANTITY_CHIPS.map((q) => (
            <Button
              key={q}
              type="button"
              size="sm"
              variant={config.quantity === q ? 'default' : 'outline'}
              onClick={() => onChange({ quantity: q })}
            >
              {q}
            </Button>
          ))}
          <Input
            id="qty"
            type="number"
            min={1}
            value={config.quantity}
            onChange={(e) =>
              onChange({ quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
            }
            className="w-20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{strings.config.leadTime}</Label>
        <RadioGroup
          value={config.leadTime}
          onValueChange={(v) => onChange({ leadTime: v as LeadTimeId })}
          className="gap-2"
        >
          {LEAD_TIME_IDS.map((id) => {
            const ship = computeShipDate(id, now)
            const mult = PRICING.leadTimes[id].mult
            const delta = Math.round((mult - 1) * 100)
            return (
              <label
                key={id}
                htmlFor={`lead-${id}`}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors',
                  config.leadTime === id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={id} id={`lead-${id}`} />
                  <div>
                    <div className="text-sm font-medium">{LEAD_LABEL[id]}</div>
                    <div className="text-muted-foreground text-xs">
                      Ships {ship.label}
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {delta === 0 ? 'base' : delta > 0 ? `+${delta}%` : `${delta}%`}
                </div>
              </label>
            )
          })}
        </RadioGroup>
        <p className="text-muted-foreground text-xs">
          {strings.config.warsawCutoff}
        </p>
      </div>
    </div>
  )
}
