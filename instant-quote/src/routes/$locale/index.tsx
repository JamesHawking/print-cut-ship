import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Hero } from '@/components/Hero'
import { GuidesTeaser } from '@/components/GuidesTeaser'
import { LandingFaq } from '@/components/LandingFaq'
import { Materials } from '@/components/Materials'
import { PriceLadder } from '@/components/PriceLadder'
import { PricingFormula } from '@/components/PricingFormula'
import { RateTicker } from '@/components/RateTicker'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
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

  function goToQuote() {
    void navigate({ to: '/$locale/quote', params: { locale } })
  }

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
          livePartId={livePartId}
          onLiveQuoteDone={goToQuote}
          onLiveQuoteFailed={() => setLivePartId(null)}
        />
        <PriceLadder />
        <Materials />
        <RateTicker reverse className="border-y" />
        <PricingFormula />
        <LandingFaq />
        <GuidesTeaser />
      </main>
      <SiteFooter />
    </>
  )
}
