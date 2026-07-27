import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useDemoPrices, useShipDates } from '@/hooks/useApi'
import type { HeroLiveState } from '@/hooks/useHeroLiveQuote'
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
import { IntakeTabs } from './hero/IntakeTabs'
import { MeasuringCard } from './hero/MeasuringCard'
import { RateTicker } from './RateTicker'
import { DEMO_PARTS, type DemoId } from './how-it-works/demo'

/**
 * Hero as the page's opening dark block (design direction 17b): utility bar
 * and nav sit on dark surfaces above, the rate ticker fuses to the bottom
 * edge as a baseplate, and the fused console is the hero's only object. The
 * light intake chamber is the one bright surface — exactly where the file
 * goes. The dark chamber quotes the demo bracket by default and switches to
 * the user's own part when a file lands; the quoted state then stays put —
 * OPEN FULL QUOTE is the only route into the editor (handoff 1c).
 */
export function Hero({
  onFiles,
  onUrl,
  urlPending,
  live,
  onOpenQuote,
  linkOpenSignal,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
  /** Live-quote state — owned by the route so the sticky bar shares it. */
  live: HeroLiveState
  /** Opens the editor (the quoted-state footer button). */
  onOpenQuote: () => void
  /** Bumped by the sticky bar's link button — opens the MakerWorld form. */
  linkOpenSignal?: number
}) {
  const strings = useStrings()
  const locale = useLocale()
  const c = strings.hero.console

  // Replaying the demo remounts the dark chamber, re-running its
  // motion-safe CSS animations (no-op under prefers-reduced-motion).
  const [runId, setRunId] = useState(0)
  // Which sample part the Demo tab is showing — it drives the chamber.
  const [selectedDemoId, setSelectedDemoId] = useState<DemoId>('bracket')
  // DropZone's sr-only input opener — the ≤sm "price mine" CTA and the
  // received-file chip must go through it (not useFilePicker, which would
  // skip the inline hero flow). Stable identity: DropZone registers on mount.
  const openPickerRef = useRef<(() => void) | null>(null)
  const registerPicker = useCallback((open: () => void) => {
    openPickerRef.current = open
  }, [])

  // Client-mounted only (React Query never fetches during prerender), so
  // static HTML carries the fallback numbers and hydration never mismatches.
  const demoQuotes = useDemoPrices()
  const demoIndex = DEMO_PARTS.findIndex((d) => d.id === selectedDemoId)
  const demo = DEMO_PARTS[demoIndex]
  const demoPart = demoQuotes?.[demoIndex]
  // Row prices for the Demo tab, fallback-resolved so the panel never shows
  // a gap before the engine answers.
  const demoTotals = DEMO_PARTS.map(
    (d, i) => demoQuotes?.[i]?.lineTotalPln ?? d.fallbackQuote.lineTotalPln,
  )
  const express = useShipDates()?.find((s) => s.leadTime === 'express')
  const expressWeekday = express
    ? formatShipWeekday(express.date, locale)
    : undefined

  // The chamber's displayed quote: the user's live part when it has landed,
  // the selected demo otherwise (with engine-captured fallbacks pre-fetch).
  const shown: PartQuote | undefined =
    live.kind === 'quoted' ? live.quote : demoPart
  const isLive = live.kind === 'quoted'
  const total = shown?.lineTotalPln ?? demo.fallbackQuote.lineTotalPln
  const weightG = shown?.weightG ?? demo.fallbackQuote.weightG
  const printHours = shown?.printHours ?? demo.fallbackQuote.printHours
  const materialPln =
    shown?.breakdown.find((l) => l.key === 'material')?.amountPln ??
    demo.fallbackBreakdown.materialPln
  const machinePln =
    shown?.breakdown.find((l) => l.key === 'machine')?.amountPln ??
    demo.fallbackBreakdown.machinePln
  // Any further engine lines a real part can carry (extra plates etc.) —
  // rendered generically so the rows always sum to the displayed total.
  const extraLines =
    shown?.breakdown.filter(
      (l) => l.key !== 'material' && l.key !== 'machine' && l.amountPln !== 0,
    ) ?? []
  // Engine keys the dictionary doesn't know yet fall back to the raw code —
  // never an empty label beside a live price.
  function breakdownLabel(key: string): string {
    const label = (strings.breakdown as Record<string, unknown>)[key]
    return typeof label === 'string' ? label : key
  }
  // Gross prices — VAT is extracted ("w tym"), never added on top.
  const vatIncluded = (total * VAT_RATE) / (1 + VAT_RATE)
  const blocked = shown?.blocked ?? false
  const processId = isLive ? live.process : demo.config.process
  const materialLabel = MATERIALS.find((m) => m.id === processId)?.label ?? ''

  const statusLabel =
    live.kind === 'demo'
      ? c.status(demo.file.name)
      : c.statusLive(live.fileName)

  return (
    <section id="top" className="dark bg-background text-foreground border-b">
      {/* full-bleed ghost grid; the content column sits on top of it */}
      <div className="blueprint-grid-ghost">
        <div className="mx-auto max-w-6xl px-4 pt-7 pb-14 sm:px-6 sm:pt-12 md:pt-[60px] md:pb-16">
          {/* eyebrow row: kicker left, static status dot right (the console
            LED below is the page's single animated liveness carrier).
            Dropped ≤sm so intake + CTA fit a 360×640 first screen. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 max-sm:hidden">
            <p className="text-muted-foreground flex items-center gap-3 font-mono text-[0.66rem] tracking-[0.2em] uppercase">
              <span className="bg-primary text-primary-foreground px-1.5 py-1 font-bold tracking-[0.14em]">
                {strings.hero.kickerBadge}
              </span>
              {strings.hero.kicker}
            </p>
            <span aria-hidden className="bg-signal size-[7px] rounded-full" />
          </div>

          {/* Each phrase is an unbreakable unit: EN fits one line at desktop
            (6.9rem cap — 7rem left it 2px short), PL breaks between the
            phrases, never inside one. ≤sm the phrases stack as blocks at a
            locale-capped display size (Mobile Audit 1b/2c): EN "Price out."
            holds 44px at 390; PL "Wychodzi cena." is 14 chars and must cap
            at 36px — cap the clamp lower rather than letting the stroke
            line break. Both floors stay 1.9rem so 320px screens still fit.
            Stroke width steps with the type size — 2.5px clogs the counters
            at mobile sizes. Leading rides the size/leading shorthand, not a
            separate `leading-*`: tailwind-merge treats an arbitrary `text-[…]`
            in a later cn() argument as a font-size that carries line-height
            and would drop a standalone one. */}
          <h1
            className={cn(
              'mt-5 font-black tracking-[-0.035em] uppercase motion-safe:transition-opacity motion-safe:duration-500 max-sm:mt-0 sm:text-[clamp(1.9rem,9.5vw,6.9rem)]/[0.88]',
              locale === 'pl'
                ? 'text-[clamp(1.9rem,9.2vw,2.25rem)]/[0.88]'
                : 'text-[clamp(1.9rem,11.3vw,2.75rem)]/[0.88]',
              // The page recedes while the machine works (design 2a-02).
              live.kind === 'measuring' && 'max-sm:opacity-35',
            )}
          >
            <span className="whitespace-nowrap max-sm:block">
              {strings.hero.headline1}
            </span>{' '}
            <span className="text-stroke-ink whitespace-nowrap [-webkit-text-stroke-width:1.8px] max-sm:block sm:[-webkit-text-stroke-width:2px] lg:[-webkit-text-stroke-width:2.5px]">
              {strings.hero.headline2}
            </span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-[540px] text-base leading-relaxed text-pretty max-sm:mt-3.5 max-sm:text-[15px]">
            <span className="max-sm:hidden">{strings.hero.sub}</span>
            <span className="sm:hidden">{strings.hero.subShort}</span>
          </p>

          {/* ============ fused console ============ */}
          {/* ≤sm the frame dissolves (Mobile Audit 1b/2a): the intake and the
            quote are rounded cards floating on the hero's grid, so a state
            change moves one card instead of redrawing a bordered console. */}
          <div className="border-foreground/20 mt-9 max-sm:mt-5 sm:border">
            {/* ≤sm the strip goes — the intake card carries its own kicker
              (Mobile Audit 1b) and the status line wrapped at 390 anyway. */}
            <div className="bg-card flex items-center justify-between gap-4 border-b px-4 py-2.5 max-sm:hidden sm:px-6">
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

            {/* Once a real quote lands the intake yields floor space to the
              price: the shared chamber border slides left (grid-template-
              columns interpolates in modern engines; snaps elsewhere and
              under reduced motion). */}
            <div
              className={cn(
                'grid motion-safe:transition-[grid-template-columns] motion-safe:duration-500 motion-safe:ease-out',
                isLive
                  ? 'lg:grid-cols-[0.7fr_1.3fr]'
                  : 'lg:grid-cols-[1.1fr_0.9fr]',
              )}
            >
              {/* intake chamber — the hero's only bright surface (.light island;
                semantic tokens only in here, no dark: variants). ≤sm it is the
                floating intake card: idle and measuring are two faces of it
                (min-h keeps the swap from resizing the card), and the quoted
                state collapses it into the chip below (Mobile Audit 2a). */}
              <div
                className={cn(
                  // min-w-0: this is a grid item, so it defaults to
                  // min-width:auto and would refuse to shrink below its
                  // content — the Demo tab's nowrap rows pushed it 128px past
                  // its cell at 360px until this was added.
                  'light bg-card text-foreground flex min-w-0 flex-col p-5 max-sm:min-h-[16.75rem] max-sm:rounded-lg sm:border-b sm:p-6 lg:border-r lg:border-b-0',
                  isLive && 'max-sm:hidden',
                )}
              >
                {live.kind === 'measuring' && (
                  <MeasuringCard
                    fileName={live.fileName}
                    metrics={live.metrics}
                    className="sm:hidden"
                  />
                )}
                <div
                  className={cn(
                    'flex flex-1 flex-col',
                    live.kind === 'measuring' && 'max-sm:hidden',
                  )}
                >
                  {/* ≤sm card kicker — replaces the hidden console strip. */}
                  <p className="text-muted-foreground mb-1.5 font-mono text-[0.6rem] font-bold tracking-[0.18em] uppercase sm:hidden">
                    {c.title}
                  </p>
                  <p className="mb-4 text-[21px]/[1.15] font-extrabold tracking-[-0.015em]">
                    {c.intakeHeading}
                  </p>
                  {/* Quoted (sm+): the taller quote chamber stretches this
                    island, so the collapsed row + receipt center in the
                    leftover height — deliberate calm, not a half-empty panel. */}
                  <div
                    className={cn(
                      isLive && 'flex flex-1 flex-col justify-center',
                    )}
                  >
                    <IntakeTabs
                      onFiles={onFiles}
                      onUrl={onUrl}
                      urlPending={urlPending}
                      quoted={isLive}
                      linkOpenSignal={linkOpenSignal}
                      onPickerReady={registerPicker}
                      selectedDemoId={selectedDemoId}
                      onSelectDemo={(id) => {
                        track('demo_selected', { demo: id })
                        setSelectedDemoId(id)
                      }}
                      demoTotals={demoTotals}
                    />
                    {/* The received-file receipt; the idle fine print lives
                      inside the tabs, which change it per panel. */}
                    {live.kind === 'quoted' && (
                      <p className="text-muted-foreground/80 mt-3.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase max-sm:hidden">
                        {/* Floor at 0.1 so tiny files don't read "0 MB". */}
                        {`${c.received(
                          live.fileName,
                          formatDecimal(
                            Math.max(live.fileSize / 1e6, 0.1),
                            locale,
                            1,
                          ),
                        )}${live.watertight ? ` · ${c.watertightOk}` : ''}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* quote chamber — demo bracket, or the user's part live.
                ≤sm it is a card floating under the intake (sm+ keeps the flat
                column that shares the console frame). */}
              <div
                key={`${runId}-${live.kind === 'measuring' ? 'measuring' : isLive ? `live-${live.fileName}` : `demo-${selectedDemoId}`}`}
                aria-live="polite"
                className="sm:bg-card flex flex-col font-mono max-sm:mt-3 lg:min-h-[280px]"
              >
                {/* ≤sm the whole intake collapses into this chip (2a-03):
                  what was received, and the way back to add another file. */}
                {isLive && (
                  <button
                    type="button"
                    onClick={() => openPickerRef.current?.()}
                    className="light bg-card text-foreground focus-visible:ring-ring mb-3 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-3 text-left opacity-75 focus-visible:ring-2 focus-visible:outline-none sm:hidden"
                  >
                    <span
                      aria-hidden
                      className="bg-signal size-2 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold break-all">
                        {live.fileName}
                      </span>
                      <span className="text-muted-foreground mt-px block text-[9px] tracking-[0.1em] uppercase">
                        {c.chipSize(
                          formatDecimal(
                            Math.max(live.fileSize / 1e6, 0.1),
                            locale,
                            1,
                          ),
                        )}
                        {live.watertight ? ` · ${c.watertightOk}` : ''}
                      </span>
                    </span>
                    <span className="text-primary-text shrink-0 text-[9.5px] font-bold tracking-[0.1em] uppercase">
                      {c.addFile}
                    </span>
                  </button>
                )}
                {live.kind === 'measuring' ? (
                  <>
                    {/* sm+ readout — ≤sm the white card above IS the measuring
                      surface, and only this note sits on the grid (2a-02). */}
                    <div className="flex flex-1 flex-col px-5 pt-5 pb-4 max-sm:hidden sm:px-6">
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
                    <p className="text-muted-foreground text-[0.6rem] tracking-[0.12em] uppercase sm:hidden">
                      {c.measuredLocal}
                    </p>
                  </>
                ) : (
                  <div className="border-foreground/15 max-sm:bg-card flex flex-1 flex-col max-sm:rounded-lg max-sm:border">
                    {/* The demo quote renders in full at every width now: the
                      Demo tab above is what carries "see a real quote first",
                      so the collapsed ≤sm strip it replaced is gone. */}
                    <div className="flex flex-1 flex-col">
                      <div className="px-5 pt-5 sm:px-6">
                        <p className="text-muted-foreground text-[9px] tracking-[0.16em] uppercase">
                          {isLive ? c.liveCaption : c.demoCaption}
                        </p>
                        <div className="mt-2.5 flex items-baseline justify-between gap-4">
                          <span
                            className={cn(
                              'text-primary-text motion-safe:animate-price-flash-accent text-3xl leading-none font-bold tabular-nums',
                              // ≤sm the live payoff is display-size (2a-03).
                              isLive && 'max-sm:text-[40px]',
                            )}
                          >
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
                        {isLive && (
                          // The number carries assumptions — name them before
                          // the user commits to the editor.
                          <p className="text-muted-foreground mt-1 text-[10.5px]">
                            {c.assumptions(materialLabel)}
                          </p>
                        )}
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
                                : breakdownLabel(l.key)}
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

                      <div
                        className={cn(
                          'border-foreground/15 mt-auto border-t px-5 py-3 sm:px-6',
                          // Live: the primary CTA must never wrap — stack the
                          // footer below sm instead of squeezing it. ≤sm the
                          // card ends at the assumptions line: the sticky
                          // price bar carries the handoff there (2a-03).
                          isLive
                            ? 'flex gap-3 max-sm:hidden sm:items-center sm:justify-between sm:gap-4'
                            : 'flex items-center justify-between gap-4',
                        )}
                      >
                        {isLive ? (
                          // The explicit handoff: the quote stays put until
                          // this button opens the editor (no timer).
                          <button
                            type="button"
                            onClick={onOpenQuote}
                            className="bg-primary text-primary-foreground focus-visible:ring-ring cursor-pointer rounded-md px-5 py-3 text-center text-[11px] font-bold tracking-[0.1em] whitespace-nowrap uppercase focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:transition-transform motion-safe:hover:-translate-y-px max-sm:w-full"
                          >
                            {c.openQuote} <span aria-hidden>→</span>
                          </button>
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
                        <span
                          className={cn(
                            'text-muted-foreground text-right text-[9px] tracking-[0.12em] uppercase',
                            isLive && 'max-sm:text-center',
                          )}
                        >
                          {isLive ? c.staysPut : c.locked}
                        </span>
                      </div>

                      {live.kind === 'demo' && (
                        // ≤sm expanded-demo exit (2a-04): the demo has made
                        // its case — hand the flow back to the intake.
                        <div className="px-5 pb-4 sm:hidden">
                          <button
                            type="button"
                            onClick={() => {
                              track('cta_upload_clicked', {
                                source_page: 'hero-demo',
                              })
                              openPickerRef.current?.()
                            }}
                            className="bg-primary text-primary-foreground focus-visible:ring-ring flex h-14 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg font-sans text-[15px] font-bold focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {c.priceMine} <span aria-hidden>→</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ≤sm trust line (finding 01): the utility-bar promises, folded
            into the hero after that bar is hidden on mobile. */}
          <p className="text-muted-foreground mt-3.5 font-mono text-[0.6rem] tracking-[0.12em] uppercase sm:hidden">
            {strings.hero.trustChips.map((t, i) => (
              <span key={t}>
                {i > 0 && (
                  <span aria-hidden className="text-primary-text">
                    {' · '}
                  </span>
                )}
                {t}
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* rate ticker fused to the hero's bottom edge as its baseplate */}
      <RateTicker className="bg-card border-t" />
    </section>
  )
}
