import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Materials } from '@/components/Materials'
import { PricingFormula } from '@/components/PricingFormula'
import { RateTicker } from '@/components/RateTicker'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { useParts } from '@/hooks/useParts'

export const Route = createFileRoute('/')({ component: Landing })

// Bundled demo part for the "no file handy" hero path.
const SAMPLE_URL = '/samples/mount_plate_rev3.stl'
const SAMPLE_NAME = 'mount_plate_rev3.stl'

function Landing() {
  const { handleFiles, handleMakerworldUrl, mwPending } = useParts()
  const navigate = useNavigate()

  // Navigate optimistically — parsing continues in the provider while the
  // route changes. If every file is rejected, /quote's empty-parts guard
  // bounces straight back here and the error toast explains why.
  function handleLandingFiles(files: File[]) {
    void handleFiles(files)
    void navigate({ to: '/quote' })
  }

  async function handleLandingUrl(url: string) {
    await handleMakerworldUrl(url)
    void navigate({ to: '/quote' })
  }

  async function handleSample() {
    const res = await fetch(SAMPLE_URL)
    const buf = await res.arrayBuffer()
    handleLandingFiles([new File([buf], SAMPLE_NAME, { type: 'model/stl' })])
  }

  return (
    <>
      <SiteHeader variant="landing" />
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
      <SiteFooter />
    </>
  )
}
