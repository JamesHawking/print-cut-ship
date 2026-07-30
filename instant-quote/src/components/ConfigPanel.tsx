import { useEffect, useMemo, useRef, useState } from 'react'
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
  ColorId,
  InfillId,
  LeadTimeId,
  NozzleId,
  OptionPrice,
  PartConfig,
  PartQuote,
  ProcessId,
} from '@/lib/api/client'
import type { Part } from '@/hooks/useParts'
import { useCatalog, usePartCompare, useShipDates } from '@/hooks/useApi'
import {
  formatDecimal,
  formatInt,
  formatPercent,
  formatPln,
  formatShipDate,
} from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'

interface Props {
  config: PartConfig
  onChange: (patch: Partial<PartConfig>) => void
  /** Enables the material meta line (weight / print-time estimates). */
  quote?: PartQuote
  /** Set for real parts: unlocks per-material deltas in the dropdown. */
  part?: Part
  /** Editor only: shows the materials-bench toggle next to the label. */
  compareOpen?: boolean
  onToggleCompare?: () => void
}

// Chips and selects requote instantly; the free-form quantity input debounces
// so typing "125" doesn't fire a pricing request per keystroke.
const QTY_DEBOUNCE_MS = 250

/** Section label — the mono kicker every group opens with. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-muted-foreground font-mono text-[0.625rem] font-normal tracking-[0.2em] uppercase">
      {children}
    </Label>
  )
}

/** The right-hand mono tag that echoes the current selection. */
function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground font-mono text-[0.625rem] tracking-wider tabular-nums">
      {children}
    </span>
  )
}

export function ConfigPanel({
  config,
  onChange,
  quote,
  part,
  compareOpen,
  onToggleCompare,
}: Props) {
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
  const loading = !catalog

  // Per-material prices for this exact part. Shares a query key with the
  // materials bench, so opening both costs one request.
  const comparePart =
    part && part.hash && part.metrics ? (part as Part & { hash: string }) : null
  const compare = usePartCompare(comparePart)
  const materialUnit = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const row of compare.data?.rows ?? []) {
      m.set(row.process, row.quote.blocked ? null : row.quote.unitPricePln)
    }
    return m
  }, [compare.data])

  // Every option's price, keyed axis+id. The engine computes these from the
  // same code path that prices the part, so what a choice is advertised to
  // cost is what it charges once picked.
  const optionUnit = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of quote?.optionPrices ?? ([] as OptionPrice[])) {
      m.set(`${o.axis}:${o.id}`, o.unitPricePln)
    }
    return m
  }, [quote])

  /**
   * The zł a choice would add or remove versus the current selection.
   * `null` when there is nothing to compare against yet — an empty slot, not
   * a "±0", because a delta we can't compute is not a delta of zero.
   */
  function deltaLabel(price: number | null | undefined, active: boolean) {
    if (active) return strings.config.selected
    if (price == null || quote == null || quote.blocked) return null
    const diff = price - quote.unitPricePln
    if (Math.abs(diff) < 0.005) return strings.config.noChange
    return strings.config.delta(formatPln(Math.abs(diff), locale), diff < 0)
  }

  function axisDelta(axis: string, id: string, active: boolean) {
    return deltaLabel(optionUnit.get(`${axis}:${id}`), active)
  }

  const colors = catalog?.colors ?? []
  const colorName = (id: string) =>
    strings.config.colorNames[id] ??
    colors.find((c) => c.id === id)?.label ??
    id
  const currentColor = colors.find((c) => c.id === config.color)
  const surchargePct = formatPercent(catalog?.colorSurchargeFraction ?? 0.05)

  return (
    <div className="space-y-5" aria-busy={loading}>
      {/* Material ------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>{strings.config.process}</SectionLabel>
          {onToggleCompare && (
            <button
              type="button"
              aria-pressed={compareOpen}
              onClick={onToggleCompare}
              className="text-primary-text hover:text-foreground cursor-pointer font-mono text-[0.625rem] font-bold tracking-[0.14em] uppercase transition-colors"
            >
              {strings.editor.compare} ↗
            </button>
          )}
        </div>
        <Select
          value={config.process}
          onValueChange={(v) => onChange({ process: v as ProcessId })}
        >
          <SelectTrigger className="w-full font-semibold" disabled={loading}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(catalog?.processes ?? []).map((p) => {
              // Deltas render inside the item rather than in a bespoke
              // popover, so Radix keeps typeahead and focus management.
              const delta = deltaLabel(
                materialUnit.get(p.id),
                p.id === config.process,
              )
              return (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex w-full items-baseline justify-between gap-3">
                    <span>{p.label}</span>
                    {delta && (
                      <span className="text-muted-foreground font-mono text-[0.59375rem] tabular-nums">
                        {delta}
                      </span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
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

      {/* Colour --------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>{strings.config.color}</SectionLabel>
          <SectionTag>
            {strings.config.colorTag(
              colorName(config.color),
              currentColor?.inStock ?? true,
            )}
          </SectionTag>
        </div>
        {/* Grouped by stock status so the cost of a colour is legible before
          it is clicked, not after. */}
        {(
          [
            [true, strings.config.colorInStock],
            [
              false,
              strings.config.colorOnRequest(
                surchargePct,
                catalog?.colorSurchargeLeadDays ?? 1,
              ),
            ],
          ] as const
        ).map(([inStock, groupLabel]) => {
          const group = colors.filter((c) => c.inStock === inStock)
          if (group.length === 0) return null
          return (
            <div key={String(inStock)} className="space-y-1.5">
              <p className="text-muted-foreground font-mono text-[0.5625rem] tracking-[0.16em] uppercase">
                {groupLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.map((c) => {
                  const active = c.id === config.color
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      // A title is not an accessible name — swatches carry no
                      // text, so the colour has to be spoken from here.
                      aria-label={strings.config.pickColor(colorName(c.id))}
                      title={colorName(c.id)}
                      onClick={() => onChange({ color: c.id as ColorId })}
                      style={{ background: c.hex }}
                      className={cn(
                        'border-foreground/15 size-7 cursor-pointer rounded-full border transition-[box-shadow,transform] duration-100 active:scale-[0.94] motion-reduce:active:scale-100',
                        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                        active &&
                          'ring-background ring-offset-foreground ring-2 ring-offset-2',
                      )}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Print quality (nozzle) ----------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>{strings.config.printQuality}</SectionLabel>
          <SectionTag>
            {strings.config.nozzleTag(
              formatDecimal(
                catalog?.nozzles.find((n) => n.id === config.nozzle)
                  ?.diameterMm ?? 0.4,
                locale,
                1,
                1,
              ),
            )}
          </SectionTag>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(catalog?.nozzles ?? []).map((n) => {
            const active = config.nozzle === n.id
            const delta = axisDelta('nozzle', n.id, active)
            return (
              <button
                key={n.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ nozzle: n.id as NozzleId })}
                className={cn(
                  'flex min-h-[44px] cursor-pointer flex-col items-start gap-[3px] rounded-md border px-3 py-2.5 text-left transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.98] motion-reduce:active:scale-100',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card hover:bg-secondary/60',
                )}
              >
                <span className="flex w-full items-baseline justify-between gap-1.5">
                  <span className="text-[0.8125rem] font-bold">
                    {strings.config.nozzleNames[n.id] ?? n.id}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[0.5625rem] font-bold whitespace-nowrap tabular-nums',
                      active ? 'text-background/75' : 'text-muted-foreground',
                    )}
                  >
                    {delta}
                  </span>
                </span>
                <span
                  className={cn(
                    'font-mono text-[0.5625rem]',
                    active ? 'text-background/75' : 'text-muted-foreground',
                  )}
                >
                  {strings.config.nozzleSpecs[n.id] ?? ''}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider">
          {strings.config.nozzleMeta[config.nozzle] ?? ''}
        </p>
      </div>

      {/* Strength (infill) ---------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>{strings.config.strength}</SectionLabel>
          <SectionTag>
            {strings.config.infillTag(
              strings.config.infillNames[config.infill] ?? config.infill,
              formatPercent(
                catalog?.infills.find((i) => i.id === config.infill)
                  ?.fraction ?? 0.2,
              ),
            )}
          </SectionTag>
        </div>
        <div className="flex gap-2">
          {(catalog?.infills ?? []).map((i) => {
            const active = config.infill === i.id
            const delta = axisDelta('infill', i.id, active)
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ infill: i.id as InfillId })}
                className={cn(
                  'min-h-[54px] flex-1 cursor-pointer rounded-md border px-1 py-2 text-center transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.98] motion-reduce:active:scale-100',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card hover:bg-secondary/60',
                )}
              >
                <span className="block text-[0.71875rem] font-bold">
                  {strings.config.infillNames[i.id] ?? i.id}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block font-mono text-[0.5625rem] tabular-nums',
                    active ? 'text-background/75' : 'text-muted-foreground',
                  )}
                >
                  {formatPercent(i.fraction)}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block font-mono text-[0.53125rem] whitespace-nowrap tabular-nums',
                    active ? 'text-background/75' : 'text-muted-foreground',
                  )}
                >
                  {delta}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider">
          {strings.config.infillMeta[config.infill] ?? ''}
        </p>
      </div>

      {/* Quantity ------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label
            htmlFor="qty"
            className="text-muted-foreground font-mono text-[0.625rem] font-normal tracking-[0.2em] uppercase"
          >
            {strings.config.quantity}
          </Label>
          <SectionTag>{strings.config.perPartPrice}</SectionTag>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {(catalog?.quantityChips ?? []).map((q) => {
            const active = config.quantity === q
            // The resulting per-part price at that tier, straight from the
            // engine's price-break table — a discount percentage tells you
            // nothing about what you would actually pay.
            const unit = quote?.priceBreaks.find(
              (b) => b.quantity === q,
            )?.unitPricePln
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
                    'mt-0.5 block text-[0.5625rem] tabular-nums',
                    active ? 'text-background/75' : 'text-muted-foreground',
                  )}
                >
                  {unit == null ? ' ' : formatDecimal(unit, locale, 2, 2)}
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

      {/* Delivery ------------------------------------------------------- */}
      <div className="space-y-2">
        <SectionLabel>{strings.config.leadTime}</SectionLabel>
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
              const delta = axisDelta('leadTime', lt.id, active)
              // An on-request colour pushes every date out, so the row has to
              // promise the date that part actually ships on.
              const date =
                currentColor && !currentColor.inStock
                  ? ship?.datePlusColorDelay
                  : ship?.date
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
                      {date && (
                        <div className="text-muted-foreground mt-0.5 text-[0.6875rem]">
                          {/* The API's `label` is the engine's canonical EN
                            form — display formats the structured date. */}
                          {strings.config.ships(formatShipDate(date, locale))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
                    {delta}
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
