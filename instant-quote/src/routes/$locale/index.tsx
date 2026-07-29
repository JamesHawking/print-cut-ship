import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Hero } from '@/components/Hero'
import { GuidesTeaser } from '@/components/GuidesTeaser'
import { LandingFaq } from '@/components/LandingFaq'
import { Materials } from '@/components/Materials'
import { PriceLadder } from '@/components/PriceLadder'
import { PricingFormula } from '@/components/PricingFormula'
import { IndustryTicker } from '@/components/IndustryTicker'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { StickyQuoteBar } from '@/components/StickyQuoteBar'
import { useHeroLiveQuote } from '@/hooks/useHeroLiveQuote'
import { useParts } from '@/hooks/useParts'
import { DEFAULT_LOCALE, getStrings, isLocale, useLocale } from '@/lib/i18n'
import { faqPageJsonLd, jsonLd, seoHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/')({
  // CTA attribution: QuoteCta deep-links here with ?source=<page>; the
  // router's page_view subscription forwards it.
  validateSearch: (search: Record<string, unknown>): { source?: string } => ({
    source: typeof search.source === 'string' ? search.source : undefined,
  }),
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    const head = seoHead({
      locale,
      path: match.pathname,
      title: s.meta.title,
      description: s.meta.description,
    })
    return {
      meta: [...head.meta, jsonLd(faqPageJsonLd(s.landingFaq.items))],
      links: head.links,
    }
  },
  component: Landing,
})

function Landing() {
  const { parts, handleFiles, handleMakerworldUrl, mwPending } = useParts()
  const navigate = useNavigate()
  const locale = useLocale()
  // Single-file drops are quoted inline in the hero's dark chamber before the
  // editor opens; multi-file drops and returning carts go straight to /quote.
  const [livePartId, setLivePartId] = useState<string | null>(null)
  // Sticky-bar link button → scrolls to the hero and opens the MakerWorld
  // form; a counter so repeated taps re-open it after a manual close.
  const [linkOpenSignal, setLinkOpenSignal] = useState(0)

  function goToQuote() {
    void navigate({ to: '/$locale/quote', params: { locale } })
  }

  // Called once here (not in Hero) so the sticky bar can mirror the quoted
  // state without double-firing the hero_live_quote_shown funnel event.
  const live = useHeroLiveQuote({
    livePartId,
    onDone: goToQuote,
    onFailed: () => setLivePartId(null),
  })

  function handleLandingFiles(files: File[]) {
    if (files.length > 1 || parts.length > 0) {
      // Navigate optimistically — parsing continues in the provider while the
      // route changes; /quote's empty-parts guard bounces back on rejection.
      void handleFiles(files)
      goToQuote()
      return
    }
    void handleFiles(files).then((ids) => {
      // 0 ids: rejected (size/type) — the intake toast explained, stay put.
      if (ids.length === 1) setLivePartId(ids[0])
    })
  }

  async function handleLandingUrl(url: string) {
    const hadParts = parts.length > 0
    const ids = await handleMakerworldUrl(url)
    if (ids.length === 1 && !hadParts) setLivePartId(ids[0])
    else if (ids.length > 0) goToQuote()
    // 0 ids: fetch/parse error — toast already shown, no navigation.
  }

  return (
    <>
      <SiteHeader variant="landing" />
      {/* id/tabIndex: target of the header's skip link (landing variant). */}
      <main id="content" tabIndex={-1}>
        <Hero
          onFiles={handleLandingFiles}
          onUrl={handleLandingUrl}
          urlPending={mwPending}
          live={live}
          onOpenQuote={goToQuote}
          linkOpenSignal={linkOpenSignal}
        />
        <PriceLadder />
        <Materials />
        {/* One tape ≤sm (Mobile Audit finding 08) — the hero baseplate keeps it. */}
        <IndustryTicker reverse className="border-y max-sm:hidden" />
        <PricingFormula />
        <LandingFaq />
        <GuidesTeaser />
      </main>
      <SiteFooter />
      {/* <lg conversion exit for every section (Mobile Audit finding 06):
        appears when the hero leaves the viewport, becomes the price bar
        once a live quote lands, yields to the footer CTA. */}
      <StickyQuoteBar
        live={live}
        onOpenQuote={goToQuote}
        onLinkIntake={() => {
          setLinkOpenSignal((n) => n + 1)
          document.getElementById('top')?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
              .matches
              ? 'auto'
              : 'smooth',
          })
        }}
      />
    </>
  )
}
