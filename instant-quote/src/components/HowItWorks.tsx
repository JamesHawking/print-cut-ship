import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { useShipDates } from '@/hooks/useApi'
import { api, toApiMetrics } from '@/lib/api/client'
import { formatPln, formatShipWeekday } from '@/lib/format'
import { track } from '@/lib/funnel'
import { useLocale, useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'
import {
  DEMO_CONFIG,
  FALLBACK_QUOTE,
  SAMPLE_METRICS,
  STAGE_ANCHOR,
  buildScript,
} from './how-it-works/demo'
import { useDemoRun } from './how-it-works/useDemoRun'
import { ConveyorRail } from './how-it-works/ConveyorRail'
import { DemoTerminal } from './how-it-works/DemoTerminal'

/**
 * Landing process section as a LIVE DEMO RUN: scrolling it into view plays a
 * machine log that quotes the sample bracket for real — mesh numbers are
 * drift-pinned to generated geometry (demo.spec.ts), the PRICE line comes
 * from POST /api/v1/price, the ship date from GET /api/v1/ship-dates. The
 * dot travels the rail as the log advances. "The machine answers", proven.
 */
export function HowItWorks() {
  const strings = useStrings()
  const locale = useLocale()
  const { n, heading, intro, demo } = strings.process

  // Client-mounted only (React Query never fetches during prerender), so the
  // static HTML carries the fallback numbers and hydration never mismatches.
  const express = useShipDates()?.find((s) => s.leadTime === 'express')
  const expressWeekday = express
    ? formatShipWeekday(express.date, locale)
    : undefined

  // The demo's real engine call — same request the quote page would send for
  // this part. Fired on mount (client-only by construction): by the time the
  // user scrolls here, the PRICE line answers with live numbers.
  const priceQuery = useQuery({
    queryKey: ['demo-price'],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: [{ metrics: toApiMetrics(SAMPLE_METRICS), ...DEMO_CONFIG }],
        },
      })
      if (!res.data) throw new Error('demo price fetch failed')
      return res.data
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
  const part = priceQuery.data?.parts[0]

  const script = useMemo(
    () => buildScript(demo, locale, part, expressWeekday),
    [demo, locale, part, expressWeekday],
  )
  const { status, visible, stage, replay, sectionRef } = useDemoRun(script)
  const anchorIdx = status === 'idle' ? null : STAGE_ANCHOR[stage]

  return (
    <section id="how-it-works" ref={sectionRef} className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} className="border-b-0 pb-0" />
        <p className="text-muted-foreground mt-4 max-w-[560px] text-[13.5px] leading-[1.55] text-pretty">
          {intro}
        </p>
        <div className="dark bg-background text-foreground mt-12 px-6 py-10 md:px-16 md:pt-14 md:pb-16">
          <ConveyorRail
            anchorIdx={anchorIdx}
            shipsDateLabel={
              expressWeekday
                ? strings.process.shipsDate(expressWeekday)
                : strings.process.shipsDateFallback
            }
          />
          {/* The animated log is aria-hidden; this carries its substance. */}
          <p className="sr-only">
            {demo.srSummary(
              formatPln((part ?? FALLBACK_QUOTE).lineTotalPln, locale),
              expressWeekday ?? strings.process.shipsDateFallback,
            )}
          </p>
          <DemoTerminal
            lines={script}
            visible={visible}
            running={status === 'running'}
            onReplay={replay}
          />
        </div>
        <div className="mt-6 flex justify-end">
          <Link
            to="/$locale"
            params={{ locale }}
            hash="top"
            onClick={() =>
              track('cta_upload_clicked', { source_page: 'how-it-works-demo' })
            }
            className="text-primary-text hover:text-foreground font-mono text-xs font-bold tracking-widest uppercase transition-colors"
          >
            {demo.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}
