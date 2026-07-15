import { useEffect, useRef, useState } from 'react'
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
import type { LeadTimeId, PartConfig, ProcessId } from '@/lib/api/client'
import { useCatalog, useShipDates } from '@/hooks/useApi'
import { strings } from '@/lib/strings'

interface Props {
  config: PartConfig
  onChange: (patch: Partial<PartConfig>) => void
}

const LEAD_LABEL: Record<LeadTimeId, string> = {
  economy: strings.config.economy,
  standard: strings.config.standard,
  express: strings.config.express,
}

// Chips and selects requote instantly; the free-form quantity input debounces
// so typing "125" doesn't fire a pricing request per keystroke.
const QTY_DEBOUNCE_MS = 250

export function ConfigPanel({ config, onChange }: Props) {
  const catalog = useCatalog()
  const shipDates = useShipDates()

  const [qtyText, setQtyText] = useState(String(config.quantity))
  const qtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync when quantity changes elsewhere (chips).
  useEffect(() => {
    setQtyText(String(config.quantity))
  }, [config.quantity])

  useEffect(
    () => () => {
      if (qtyTimer.current) clearTimeout(qtyTimer.current)
    },
    [],
  )

  function handleQtyInput(raw: string) {
    setQtyText(raw)
    if (qtyTimer.current) clearTimeout(qtyTimer.current)
    qtyTimer.current = setTimeout(() => {
      onChange({ quantity: Math.max(1, Math.floor(Number(raw) || 1)) })
    }, QTY_DEBOUNCE_MS)
  }

  const quantityChips = catalog?.quantityChips ?? []
  const shipByLead = new Map(shipDates?.map((s) => [s.leadTime, s]))

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
            {(catalog?.processes ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qty">{strings.config.quantity}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {quantityChips.map((q) => (
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
            value={qtyText}
            onChange={(e) => handleQtyInput(e.target.value)}
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
          {(catalog?.leadTimes ?? []).map((lt) => {
            const ship = shipByLead.get(lt.id)
            const delta = Math.round((lt.mult - 1) * 100)
            return (
              <label
                key={lt.id}
                htmlFor={`lead-${lt.id}`}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors',
                  config.leadTime === lt.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={lt.id} id={`lead-${lt.id}`} />
                  <div>
                    <div className="text-sm font-medium">
                      {LEAD_LABEL[lt.id]}
                    </div>
                    {ship && (
                      <div className="text-muted-foreground text-xs">
                        Ships {ship.label}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {delta === 0
                    ? 'base'
                    : delta > 0
                      ? `+${delta}%`
                      : `${delta}%`}
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
