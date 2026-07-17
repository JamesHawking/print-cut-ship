import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Materials } from '@/components/Materials'
import { PricingFormula } from '@/components/PricingFormula'
import { RateTicker } from '@/components/RateTicker'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { useParts } from '@/hooks/useParts'
import { DEFAULT_LOCALE, getStrings, isLocale, useLocale } from '@/lib/i18n'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/')({
  // CTA attribution: QuoteCta deep-links here with ?source=<page>; the
  // router's page_view subscription forwards it.
  validateSearch: (search: Record<string, unknown>): { source?: string } => ({
    source: typeof search.source === 'string' ? search.source : undefined,
  }),
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return seoHead({
      locale,
      path: match.pathname,
      title: s.meta.title,
      description: s.meta.description,
    })
  },
  component: Landing,
})

// Bundled demo part for the "no file handy" hero path.
const SAMPLE_URL = '/samples/mount_plate_rev3.stl'
const SAMPLE_NAME = 'mount_plate_rev3.stl'

function Landing() {
  const { handleFiles, handleMakerworldUrl, mwPending } = useParts()
  const navigate = useNavigate()
  const locale = useLocale()

  // Navigate optimistically — parsing continues in the provider while the
  // route changes. If every file is rejected, /quote's empty-parts guard
  // bounces straight back here and the error toast explains why.
  function handleLandingFiles(files: File[]) {
    void handleFiles(files)
    void navigate({ to: '/$locale/quote', params: { locale } })
  }

  async function handleLandingUrl(url: string) {
    await handleMakerworldUrl(url)
    void navigate({ to: '/$locale/quote', params: { locale } })
  }

  async function handleSample() {
    const res = await fetch(SAMPLE_URL)
    const buf = await res.arrayBuffer()
    handleLandingFiles([new File([buf], SAMPLE_NAME, { type: 'model/stl' })])
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
          onSample={handleSample}
        />
        <RateTicker />
        <HowItWorks />
        <Materials />
        <PricingFormula />
      </main>
      <SiteFooter />
    </>
  )
}
