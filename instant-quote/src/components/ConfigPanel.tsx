import { useEffect, useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type {
  LeadTimeId,
  PartConfig,
  PartQuote,
  ProcessId,
} from '@/lib/api/client'
import { useCatalog, useShipDates } from '@/hooks/useApi'
import { formatDecimal, formatInt, formatShipDate } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'

interface Props {
  config: PartConfig
  onChange: (patch: Partial<PartConfig>) => void
  /** Enables the material meta line (weight / print-time estimates). */
  quote?: PartQuote
}

// Chips and selects requote instantly; the free-form quantity input debounces
// so typing "125" doesn't fire a pricing request per keystroke.
const QTY_DEBOUNCE_MS = 250

export function ConfigPanel({ config, onChange, quote }: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const catalog = useCatalog()
  const shipDates = useShipDates()

  const LEAD_LABEL: Record<LeadTimeId, string> = {
    economy: strings.config.economy,
    standard: strings.config.standard,
    express: strings.config.express,
  }

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

  const process = catalog?.processes.find((p) => p.id === config.process)
  const shipByLead = new Map(shipDates?.map((s) => [s.leadTime, s]))
  const discountAt = (q: number) =>
    catalog?.discountTiers.find((t) => t.quantity === q)?.fraction ?? 0
  const loading = !catalog

  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="space-y-2">
        <Label className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
          {strings.config.process}
        </Label>
        <Select
          value={config.process}
          onValueChange={(v) => onChange({ process: v as ProcessId })}
        >
          <SelectTrigger className="w-full font-semibold" disabled={loading}>
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
        {process && quote && !quote.blocked && (
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-wider tabular-nums">
            {formatDecimal(process.densityGCm3, locale, 2, 2)} g/cm³ ·{' '}
            {process.plnPerKg} zł/kg ·{' '}
            {strings.config.printMeta(
              formatInt(Math.round(quote.weightG), locale),
              formatDecimal(quote.printHours, locale, 1),
            )}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="qty"
          className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase"
        >
          {strings.config.quantity}
        </Label>
        <div className="flex flex-wrap items-stretch gap-2">
          {(catalog?.quantityChips ?? []).map((q) => {
            const active = config.quantity === q
            const disc = discountAt(q)
            return (
              <button
                key={q}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ quantity: q })}
                className={cn(
                  // Near-imperceptible press acknowledgment — felt, not seen.
                  'min-h-[44px] min-w-[52px] cursor-pointer rounded-md border px-3 py-1.5 text-center font-mono transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.98] motion-reduce:active:scale-100',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card hover:bg-secondary/60',
                )}
              >
                <span className="block text-[0.8125rem] font-bold tabular-nums">
                  {q}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block text-[0.5625rem]',
                    active ? 'text-background/75' : 'text-muted-foreground',
                  )}
                >
                  {disc > 0 ? `−${Math.round(disc * 100)}%` : ' '}
                </span>
              </button>
            )
          })}
          <Input
            id="qty"
            type="number"
            min={1}
            value={qtyText}
            onChange={(e) => handleQtyInput(e.target.value)}
            disabled={loading}
            className="h-auto min-h-11 w-24 self-stretch font-mono text-[0.8125rem]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
          {strings.config.leadTime}
        </Label>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : (
          <RadioGroup
            value={config.leadTime}
            onValueChange={(v) => onChange({ leadTime: v as LeadTimeId })}
            className="gap-2"
          >
            {(catalog?.leadTimes ?? []).map((lt) => {
              const active = config.leadTime === lt.id
              const ship = shipByLead.get(lt.id)
              const delta = Math.round((lt.mult - 1) * 100)
              return (
                <label
                  key={lt.id}
                  htmlFor={`lead-${lt.id}`}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3.5 py-3 transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.98] motion-reduce:active:scale-100',
                    active
                      ? 'border-foreground bg-secondary/50'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={lt.id} id={`lead-${lt.id}`} />
                    <div>
                      <div className="text-[0.8125rem] font-semibold">
                        {LEAD_LABEL[lt.id]}
                      </div>
                      {ship && (
                        <div className="text-muted-foreground mt-0.5 text-[0.6875rem]">
                          {/* The API's `label` is the engine's canonical EN
                            form — display formats the structured date. */}
                          {strings.config.ships(
                            formatShipDate(ship.date, locale),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
                    {delta === 0
                      ? strings.config.base
                      : delta > 0
                        ? `+${delta}%`
                        : `${delta}%`}
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        )}
        <p className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider uppercase">
          {strings.config.warsawCutoff}
        </p>
      </div>
    </div>
  )
}
