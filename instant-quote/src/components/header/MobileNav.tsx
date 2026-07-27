import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/funnel'
import { useFilePicker } from '@/hooks/useFilePicker'
import { useLocale, useStrings } from '@/lib/i18n'
import { NAV_SECTIONS, SECTIONS, type SectionKey } from '@/content/sections'
import { LocaleSwitcher } from '../LocaleSwitcher'

/**
 * The mobile (<lg) nav inside SiteHeader's Radix Dialog — action-first
 * (Mobile Audit 2b): the primary quote CTA leads, track-order and locale
 * share a chip row, and the five sections are flat 56px rows that go
 * straight to their page (the accordions' sub-rows were the sub-44px
 * offenders; the real lists live on the section pages). Numerals become a
 * right-hand index of counts (nav.menuMeta), not ranks.
 */
export function MobileNav({
  routeKey,
  onNavigate,
}: {
  routeKey: SectionKey | null
  onNavigate: () => void
}) {
  const strings = useStrings()
  const locale = useLocale()
  const openFilePicker = useFilePicker()

  const rowClass =
    'flex min-h-14 items-center gap-3 border-b px-1.5 py-3 text-[15px]'
  const metaClass =
    'text-muted-foreground shrink-0 font-mono text-[9.5px] tracking-[0.1em] uppercase tabular-nums'
  const chevron = (
    <ChevronRight aria-hidden className="text-primary-text size-4 shrink-0" />
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          track('cta_upload_clicked', { source_page: 'mobile-menu' })
          openFilePicker()
          onNavigate()
        }}
        className="bg-primary text-primary-foreground focus-visible:ring-ring flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg text-[15px] font-bold focus-visible:ring-2 focus-visible:outline-none"
      >
        <Plus aria-hidden className="size-5" strokeWidth={2.2} />
        {strings.nav.getQuote}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          to="/$locale/login"
          params={{ locale }}
          onClick={onNavigate}
          className="text-foreground hover:bg-secondary flex h-12 items-center justify-center rounded-lg border font-mono text-[10.5px] font-bold tracking-[0.12em] uppercase transition-colors"
        >
          {strings.nav.trackOrder}
        </Link>
        <div className="flex h-12 items-center justify-center rounded-lg border">
          <LocaleSwitcher />
        </div>
      </div>
      <nav className="mt-4 border-t">
        <Link
          to="/$locale"
          params={{ locale }}
          hash="how-it-works"
          onClick={onNavigate}
          className={cn(rowClass, 'text-foreground')}
        >
          <span className="flex-1 font-bold">{strings.nav.howItWorks}</span>
          <span aria-hidden className={metaClass}>
            {strings.nav.menuMeta.howItWorks}
          </span>
          {chevron}
        </Link>
        {NAV_SECTIONS.map((key) => (
          <Link
            key={key}
            to="/$locale/$section"
            params={{ locale, section: SECTIONS[key][locale] }}
            onClick={onNavigate}
            aria-current={routeKey === key ? 'page' : undefined}
            className={cn(
              rowClass,
              routeKey === key ? 'text-primary-text' : 'text-foreground',
            )}
          >
            <span className="flex-1 font-bold">{strings.nav[key]}</span>
            <span aria-hidden className={metaClass}>
              {strings.nav.menuMeta[key]}
            </span>
            {chevron}
          </Link>
        ))}
      </nav>
      <p className="text-muted-foreground/80 mt-4 font-mono text-[0.6rem] leading-relaxed tracking-[0.1em] uppercase">
        {strings.nav.menuTrust1}
        <br />
        {strings.nav.menuTrust2}
      </p>
    </>
  )
}
