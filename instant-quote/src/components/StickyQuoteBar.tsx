import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import type { HeroLiveState } from '@/hooks/useHeroLiveQuote'
import { useFilePicker } from '@/hooks/useFilePicker'
import { formatPln } from '@/lib/format'
import { track } from '@/lib/funnel'
import { useLocale, useStrings } from '@/lib/i18n'

/**
 * <lg sticky bottom bar (Mobile Audit finding 06 + 2a-03): once the hero —
 * the page's only intake — scrolls away, every section keeps a one-tap
 * conversion exit. After a live quote lands it becomes the price bar: the
 * number follows the whole page, OPEN QUOTE is the only route forward.
 * Yields to the footer (whose CTA band takes over) and never renders while
 * the hero is on screen.
 */
export function StickyQuoteBar({
  live,
  onOpenQuote,
  onLinkIntake,
}: {
  live: HeroLiveState
  /** Navigates to the editor (quoted state). */
  onOpenQuote: () => void
  /** Scrolls back to the hero and opens the MakerWorld link form. */
  onLinkIntake: () => void
}) {
  const strings = useStrings()
  const locale = useLocale()
  const openFilePicker = useFilePicker()
  // Starts "hero in view" so SSR/prerender emits nothing and hydration
  // matches; the observers correct it right after mount.
  const [heroInView, setHeroInView] = useState(true)
  const [footerInView, setFooterInView] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('top')
    const footer = document.getElementById('site-footer')
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const heroObs = new IntersectionObserver(([e]) =>
      setHeroInView(e.isIntersecting),
    )
    heroObs.observe(hero)
    let footerObs: IntersectionObserver | undefined
    if (footer) {
      footerObs = new IntersectionObserver(([e]) =>
        setFooterInView(e.isIntersecting),
      )
      footerObs.observe(footer)
    }
    return () => {
      heroObs.disconnect()
      footerObs?.disconnect()
    }
  }, [])

  const quoted = live.kind === 'quoted'
  // Quoted pins the bar at once, hero on screen or not: ≤sm the quote card
  // ends at the assumptions line and this bar IS the handoff (design 2a-03).
  // Idle it waits for the hero — the intake is right there.
  if ((heroInView && !quoted) || footerInView) return null

  return (
    // Fades, never slides (Mobile Audit 5c): a bar that travels up the screen
    // reads as an interruption arriving, and it arrives while the visitor is
    // reading something else.
    <div className="dark bg-background/95 border-foreground/15 motion-safe:animate-in motion-safe:fade-in motion-safe:ease-enter fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur motion-safe:duration-(--duration-tab) lg:hidden">
      <div className="text-foreground mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        {quoted ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-primary-text block font-mono text-base leading-none font-bold tabular-nums">
                {formatPln(live.quote.lineTotalPln, locale)}
              </span>
              <span className="text-muted-foreground mt-1 block font-mono text-[0.55rem] tracking-[0.12em] uppercase">
                {strings.stickyBar.caption}
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenQuote}
              className="bg-primary text-primary-foreground focus-visible:ring-ring flex h-12 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-5 text-[15px] font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              {strings.stickyBar.openQuote} <span aria-hidden>→</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                track('cta_upload_clicked', { source_page: 'sticky-bar' })
                openFilePicker()
              }}
              className="bg-primary text-primary-foreground focus-visible:ring-ring flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[15px] font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              {strings.nav.getQuote} <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              aria-label={strings.hero.console.pasteLink}
              onClick={onLinkIntake}
              className="border-foreground/25 text-foreground focus-visible:ring-ring flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
            >
              <Link2 aria-hidden className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
