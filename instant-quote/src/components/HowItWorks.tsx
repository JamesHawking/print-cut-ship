import { useShipDates } from '@/hooks/useApi'
import { formatShipWeekday } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'

// Station flash delays match the traveling dot's dwell windows (0/40/80% of
// the shared 7s cycle — see the conveyor keyframes in styles.css).
const STATION_DELAYS = ['0s', '2.8s', '5.6s']
// Per-station tone of the accented trace-2 span: OK green, price orange,
// none (Process Section Redesign.dc.html, card 3a).
const TRACE_ACCENT = ['text-signal', 'text-primary-text', '']

/**
 * Landing process section as a conveyor + trace band: a dot travels along a
 * dashed production track, dwelling on three station markers that flash in
 * sync, and runs off to a SHIPS chip carrying the engine's real express
 * ship date.
 */
export function HowItWorks() {
  const strings = useStrings()
  const locale = useLocale()
  const { n, heading, intro, steps } = strings.process
  // Client-mounted only (React Query never fetches during prerender), so the
  // static HTML carries the D+1 fallback and hydration never mismatches.
  const express = useShipDates()?.find((s) => s.leadTime === 'express')

  return (
    <section id="how-it-works" className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} className="border-b-0 pb-0" />
        <p className="text-muted-foreground mt-4 max-w-[560px] text-[13.5px] leading-[1.55] text-pretty">
          {intro}
        </p>
        <div className="dark bg-background text-foreground mt-12 px-6 py-10 md:px-16 md:pt-14 md:pb-16">
          <div className="relative">
            <div
              aria-hidden
              className="conveyor-track motion-safe:animate-conveyor absolute inset-x-0 top-[11px] hidden h-0.5 md:block"
            />
            <div
              aria-hidden
              className="bg-primary motion-safe:animate-conveyor-dot absolute top-[5px] left-1 z-[1] hidden size-3.5 rounded-full md:block"
            />
            <div className="relative grid gap-10 md:grid-cols-[1fr_1fr_1fr_190px]">
              {steps.map((step, i) => (
                <div key={step.n} className="relative pt-11">
                  <span
                    aria-hidden
                    className="bg-background border-muted-foreground motion-safe:animate-station-flash absolute top-1 left-0 size-[22px] border-[3px]"
                    style={{ animationDelay: STATION_DELAYS[i] }}
                  />
                  <p className="text-primary-text font-mono text-xs font-bold tracking-[0.14em]">
                    {step.n} · {step.kicker}
                  </p>
                  <h3 className="mt-2.5 text-[19px] leading-[1.2] font-extrabold">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-[1.9]">
                    {step.trace1}
                    <br />
                    {step.trace2Pre}
                    {step.trace2Accent && (
                      <span className={TRACE_ACCENT[i]}>
                        {step.trace2Accent}
                      </span>
                    )}
                    {step.trace2Post}
                  </p>
                </div>
              ))}
              <div className="md:pt-9">
                <div className="border-foreground/20 flex flex-col gap-1.5 border px-5 py-[18px]">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="bg-signal motion-safe:animate-ship-pulse size-2 rounded-full"
                    />
                    <span className="font-mono text-[10.5px] font-bold tracking-[0.14em]">
                      {strings.process.ships}
                    </span>
                  </div>
                  <div className="text-[22px] leading-none font-extrabold">
                    {express
                      ? strings.process.shipsDate(
                          formatShipWeekday(express.date, locale),
                        )
                      : strings.process.shipsDateFallback}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10px]">
                    {strings.process.shipsCutoff}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
