import { useState } from 'react'
import { useDemoPrice, useShipDates } from '@/hooks/useApi'
import { MATERIALS, VAT_RATE } from '@/lib/catalog-static'
import {
  formatDecimal,
  formatInt,
  formatPln,
  formatShipWeekday,
} from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { DropZone } from './DropZone'
import {
  DEMO_CONFIG,
  FALLBACK_BREAKDOWN,
  FALLBACK_QUOTE,
  SAMPLE_FILE,
} from './how-it-works/demo'

/**
 * Hero as a single "fused console" (design direction 15a): headline on top,
 * then one machine — your file goes in the left chamber, the itemized price
 * comes out the right. The dark chamber shows the demo bracket quoted by the
 * real engine (shared demo-price query; FALLBACK_* numbers pre-fetch).
 */
export function Hero({
  onFiles,
  onUrl,
  urlPending,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console

  // Replaying the demo remounts the dark chamber, re-running its
  // motion-safe CSS animations (no-op under prefers-reduced-motion).
  const [runId, setRunId] = useState(0)

  // Client-mounted only (React Query never fetches during prerender), so
  // static HTML carries the fallback numbers and hydration never mismatches.
  const part = useDemoPrice()
  const express = useShipDates()?.find((s) => s.leadTime === 'express')
  const expressWeekday = express
    ? formatShipWeekday(express.date, locale)
    : undefined

  const total = part?.lineTotalPln ?? FALLBACK_QUOTE.lineTotalPln
  const weightG = part?.weightG ?? FALLBACK_QUOTE.weightG
  const printHours = part?.printHours ?? FALLBACK_QUOTE.printHours
  const materialPln =
    part?.breakdown.find((l) => l.key === 'material')?.amountPln ??
    FALLBACK_BREAKDOWN.materialPln
  const machinePln =
    part?.breakdown.find((l) => l.key === 'machine')?.amountPln ??
    FALLBACK_BREAKDOWN.machinePln
  // Gross prices — VAT is extracted ("w tym"), never added on top.
  const vatIncluded = (total * VAT_RATE) / (1 + VAT_RATE)
  const printable = !(part?.blocked ?? false)
  const materialLabel =
    MATERIALS.find((m) => m.id === DEMO_CONFIG.process)?.label ?? ''

  return (
    <section id="top" className="border-b">
      <div className="blueprint-grid-faint">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-12 pb-14 sm:px-6 md:pt-16 md:pb-[72px]">
          <p className="text-muted-foreground flex items-center gap-3.5 text-center font-mono text-[0.7rem] tracking-[0.24em] uppercase">
            <span className="bg-primary text-primary-foreground px-1.5 py-1 font-bold tracking-[0.14em]">
              {strings.hero.kickerBadge}
            </span>
            {strings.hero.kicker}
          </p>

          <h1 className="mt-6 text-center text-[clamp(2.1rem,9vw,5.5rem)] leading-[0.92] font-black tracking-[-0.035em] text-balance uppercase md:leading-[0.9]">
            {strings.hero.headline1}{' '}
            <span className="text-stroke-ink">{strings.hero.headline2}</span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-[560px] text-center text-[17px] leading-relaxed text-pretty lg:text-lg">
            {strings.hero.sub}
          </p>

          {/* ============ fused console ============ */}
          <div className="bg-card mt-10 w-full max-w-[1080px] overflow-hidden rounded-lg border text-left shadow-2xl shadow-black/[0.12]">
            <div className="bg-secondary flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
              <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                {c.title}
              </span>
              <span className="text-muted-foreground flex items-center gap-2 text-right font-mono text-[10px] tracking-[0.18em] uppercase">
                <span
                  aria-hidden
                  className="bg-signal motion-safe:animate-led size-[7px] shrink-0 rounded-full"
                />
                {c.status(SAMPLE_FILE.name)}
              </span>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              {/* intake chamber */}
              <div className="border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
                <p className="mb-4 text-[19px] font-extrabold tracking-[-0.015em]">
                  {c.intakeHeading}
                </p>
                <DropZone
                  variant="console"
                  onFiles={onFiles}
                  onUrl={onUrl}
                  urlPending={urlPending}
                />
                <p className="text-muted-foreground/80 mt-3.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase">
                  {c.finePrint}
                </p>
              </div>

              {/* quote chamber — demo bracket priced by the live engine */}
              <div
                key={runId}
                className="dark bg-background text-foreground flex flex-col font-mono lg:min-h-[280px]"
              >
                <div className="px-5 pt-5 sm:px-6">
                  <p className="text-muted-foreground text-[9px] tracking-[0.16em] uppercase">
                    {c.demoCaption}
                  </p>
                  <div className="mt-2.5 flex items-baseline justify-between gap-4">
                    <span className="text-primary-text motion-safe:animate-price-flash-accent text-3xl leading-none font-bold tabular-nums">
                      {formatPln(total, locale)}
                    </span>
                    {printable && (
                      <span className="text-signal flex items-center gap-2 text-[11px] font-bold">
                        <span
                          aria-hidden
                          className="bg-signal size-[7px] rounded-full"
                        />
                        {c.printable}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-[10.5px]">
                    {expressWeekday
                      ? c.metaShip(expressWeekday)
                      : c.metaShipFallback}
                  </p>
                </div>

                <div
                  aria-hidden
                  className="border-foreground/15 mx-5 mt-4 border-t sm:mx-6"
                />

                <div className="text-muted-foreground grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-5 pt-3.5 pb-4 text-[10.5px] sm:px-6">
                  <span>
                    {c.rowMaterial(
                      formatInt(Math.round(weightG), locale),
                      materialLabel,
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatPln(materialPln, locale)}
                  </span>
                  <span>
                    {c.rowMachine(formatDecimal(printHours, locale, 1))}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatPln(machinePln, locale)}
                  </span>
                  <span
                    aria-hidden
                    className="border-foreground/10 col-span-2 mt-1 border-t"
                  />
                  <span>{c.rowVat}</span>
                  <span className="text-right tabular-nums">
                    {formatPln(vatIncluded, locale)}
                  </span>
                </div>

                <div className="border-foreground/15 mt-auto flex items-center justify-between gap-4 border-t px-5 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setRunId((n) => n + 1)}
                    className="text-primary-text focus-visible:ring-ring cursor-pointer text-[10px] font-bold tracking-[0.14em] uppercase focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {c.replay} <span aria-hidden>↻</span>
                  </button>
                  <span className="text-muted-foreground text-right text-[9px] tracking-[0.12em] uppercase">
                    {c.locked}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
