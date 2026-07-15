import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Materials } from '@/components/Materials'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { useParts } from '@/hooks/useParts'

export const Route = createFileRoute('/')({ component: Landing })

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

  return (
    <>
      <SiteHeader variant="landing" />
      <Hero
        onFiles={handleLandingFiles}
        onUrl={handleLandingUrl}
        urlPending={mwPending}
      />
      <HowItWorks />
      <Materials />
      <SiteFooter />
    </>
  )
}
