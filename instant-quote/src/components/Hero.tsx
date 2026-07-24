import { useState } from 'react'
import { useDemoPrice, useShipDates } from '@/hooks/useApi'
import { useHeroLiveQuote } from '@/hooks/useHeroLiveQuote'
import type { PartQuote } from '@/lib/api/client'
import { MATERIALS, VAT_RATE } from '@/lib/catalog-static'
import {
  formatDecimal,
  formatInt,
  formatPln,
  formatShipWeekday,
} from '@/lib/format'
import { track } from '@/lib/funnel'
import { useLocale, useStrings } from '@/lib/i18n'
import { DropZone } from './DropZone'
import { RateTicker } from './RateTicker'
import {
  DEMO_CONFIG,
  FALLBACK_BREAKDOWN,
  FALLBACK_QUOTE,
  SAMPLE_FILE,
} from './how-it-works/demo'

/**
 * Hero as the page's opening dark block (design direction 17b): utility bar
 * and nav sit on dark surfaces above, the rate ticker fuses to the bottom
 * edge as a baseplate, and the fused console is the hero's only object. The
 * light intake chamber is the one bright surface — exactly where the file
 * goes. The dark chamber quotes the demo bracket by default and switches to
 * the user's own part when a file lands (then the editor opens itself).
 */
export function Hero({
  onFiles,
  onUrl,
  urlPending,
  livePartId,
  onLiveQuoteDone,
  onLiveQuoteFailed,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
  /** Part id to quote inline in the dark chamber (single-file drops). */
  livePartId: string | null
  onLiveQuoteDone: () => void
  onLiveQuoteFailed: () => void
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console

  // Replaying the demo remounts the dark chamber, re-running its
  // motion-safe CSS animations (no-op under prefers-reduced-motion).
  const [runId, setRunId] = useState(0)

  // Client-mounted only (React Query never fetches during prerender), so
  // static HTML carries the fallback numbers and hydration never mismatches.
  const demoPart = useDemoPrice()
  const express = useShipDates()?.find((s) => s.leadTime === 'express')
  const expressWeekday = express
    ? formatShipWeekday(express.date, locale)
    : undefined

  const live = useHeroLiveQuote({
    livePartId,
    onDone: onLiveQuoteDone,
    onFailed: onLiveQuoteFailed,
  })

  // The chamber's displayed quote: the user's live part when it has landed,
  // the demo bracket otherwise (with engine-captured fallbacks pre-fetch).
  const shown: PartQuote | undefined =
    live.kind === 'quoted' ? live.quote : demoPart
  const isLive = live.kind === 'quoted'
  const total = shown?.lineTotalPln ?? FALLBACK_QUOTE.lineTotalPln
  const weightG = shown?.weightG ?? FALLBACK_QUOTE.weightG
  const printHours = shown?.printHours ?? FALLBACK_QUOTE.printHours
  const materialPln =
    shown?.breakdown.find((l) => l.key === 'material')?.amountPln ??
    FALLBACK_BREAKDOWN.materialPln
  const machinePln =
    shown?.breakdown.find((l) => l.key === 'machine')?.amountPln ??
    FALLBACK_BREAKDOWN.machinePln
  // Any further engine lines a real part can carry (extra plates etc.) —
  // rendered generically so the rows always sum to the displayed total.
  const extraLines =
    shown?.breakdown.filter(
      (l) => l.key !== 'material' && l.key !== 'machine' && l.amountPln !== 0,
    ) ?? []
  // Gross prices — VAT is extracted ("w tym"), never added on top.
  const vatIncluded = (total * VAT_RATE) / (1 + VAT_RATE)
  const blocked = shown?.blocked ?? false
  const processId = isLive ? live.process : DEMO_CONFIG.process
  const materialLabel = MATERIALS.find((m) => m.id === processId)?.label ?? ''

  const statusLabel =
    live.kind === 'demo'
      ? c.status(SAMPLE_FILE.name)
      : c.statusLive(live.fileName)

  return (
    <section id="top" className="dark bg-background text-foreground border-b">
      {/* full-bleed ghost grid; the content column sits on top of it */}
      <div className="blueprint-grid-ghost">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 md:pt-[60px] md:pb-16">
          {/* eyebrow row: kicker left, engine LED right */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <p className="text-muted-foreground flex items-center gap-3 font-mono text-[0.66rem] tracking-[0.2em] uppercase">
              <span className="bg-primary text-primary-foreground px-1.5 py-1 font-bold tracking-[0.14em]">
                {strings.hero.kickerBadge}
              </span>
              {strings.hero.kicker}
            </p>
            <span className="text-muted-foreground flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
              <span
                aria-hidden
                className="bg-signal motion-safe:animate-led size-[7px] rounded-full"
              />
              {strings.hero.engineLive}
            </span>
          </div>

          {/* Each phrase is an unbreakable unit: EN fits one line at desktop
            (6.9rem cap — 7rem left it 2px short), PL breaks between the
            phrases, never inside one. */}
          <h1 className="mt-5 text-[clamp(2.4rem,8.5vw,6.9rem)] leading-[0.88] font-black tracking-[-0.035em] uppercase">
            <span className="whitespace-nowrap">{strings.hero.headline1}</span>{' '}
            <span className="text-stroke-ink whitespace-nowrap [-webkit-text-stroke-width:2.5px]">
              {strings.hero.headline2}
            </span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-[540px] text-base leading-relaxed text-pretty">
            {strings.hero.sub}
          </p>

          {/* ============ fused console ============ */}
          <div className="border-foreground/20 mt-9 border">
            <div className="bg-card flex items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-6">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
                {c.title}
              </span>
              <span className="text-muted-foreground flex items-center gap-2 text-right font-mono text-[10px] tracking-[0.18em] uppercase">
                <span
                  aria-hidden
                  className="bg-signal motion-safe:animate-led size-[7px] shrink-0 rounded-full"
                />
                {statusLabel}
              </span>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              {/* intake chamber — the hero's only bright surface (.light island;
                semantic tokens only in here, no dark: variants) */}
              <div className="light bg-card text-foreground border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
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

              {/* quote chamber — demo bracket, or the user's part live */}
              <div
                key={`${runId}-${live.kind === 'measuring' ? 'measuring' : isLive ? `live-${live.fileName}` : 'demo'}`}
                aria-live="polite"
                className="bg-background flex flex-col font-mono lg:min-h-[280px]"
              >
                {live.kind === 'measuring' ? (
                  <div className="flex flex-1 flex-col px-5 pt-5 pb-4 sm:px-6">
                    <p className="text-muted-foreground text-[9px] tracking-[0.16em] uppercase">
                      {c.liveCaption}
                    </p>
                    <p className="mt-2.5 text-sm font-bold break-all">
                      {live.fileName}
                    </p>
                    <p className="text-muted-foreground mt-3 text-[10.5px] motion-safe:animate-pulse">
                      {c.measuring}
                    </p>
                    <div className="border-foreground/15 mt-auto flex items-center justify-end border-t pt-3">
                      <span className="text-muted-foreground text-right text-[9px] tracking-[0.12em] uppercase">
                        {c.locked}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-5 pt-5 sm:px-6">
                      <p className="text-muted-foreground text-[9px] tracking-[0.16em] uppercase">
                        {isLive ? c.liveCaption : c.demoCaption}
                      </p>
                      <div className="mt-2.5 flex items-baseline justify-between gap-4">
                        <span className="text-primary-text motion-safe:animate-price-flash-accent text-3xl leading-none font-bold tabular-nums">
                          {formatPln(total, locale)}
                        </span>
                        {blocked ? (
                          <span className="text-destructive flex items-center gap-2 text-[11px] font-bold">
                            <span
                              aria-hidden
                              className="bg-destructive size-[7px] rounded-full"
                            />
                            {c.blocked}
                          </span>
                        ) : (
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
                      {extraLines.map((l) => (
                        <span key={l.key} className="contents">
                          <span>
                            {l.key === 'plates'
                              ? strings.breakdown.plates(l.count ?? 0)
                              : strings.breakdown[
                                  l.key as 'material' | 'machine' | 'finishing'
                                ]}
                          </span>
                          <span className="text-right tabular-nums">
                            {formatPln(l.amountPln, locale)}
                          </span>
                        </span>
                      ))}
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
                      {isLive ? (
                        <span className="text-primary-text text-[10px] font-bold tracking-[0.14em] uppercase">
                          {c.redirecting}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            track('demo_replayed')
                            setRunId((n) => n + 1)
                          }}
                          className="text-primary-text focus-visible:ring-ring cursor-pointer text-[10px] font-bold tracking-[0.14em] uppercase focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {c.replay} <span aria-hidden>↻</span>
                        </button>
                      )}
                      <span className="text-muted-foreground text-right text-[9px] tracking-[0.12em] uppercase">
                        {c.locked}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* rate ticker fused to the hero's bottom edge as its baseplate */}
      <RateTicker className="bg-card border-t" />
    </section>
  )
}
