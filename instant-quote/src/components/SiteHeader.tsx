import { useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPln } from '@/lib/format'
import { useParts } from '@/hooks/useParts'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { LOCALES, useLocale, useStrings, type Locale } from '@/lib/i18n'
import { setLocaleCookie } from '@/lib/i18n/detect'
import { SECTIONS, sectionKeyFor } from '@/content/sections'

/** Content sections in nav order — label keys align with strings.nav.
    Shared with SiteFooter's sitemap so the two surfaces never drift. */
export const NAV_SECTIONS = ['materials', 'pricing', 'compare', 'blog'] as const

/** Landing section anchors the scroll-spy watches, and the nav item each
    one lights up (the landing sections preview their content pages). */
const LANDING_SECTION_IDS = ['how-it-works', 'materials', 'pricing'] as const
const SPY_NAV_KEY = {
  'how-it-works': 'howItWorks',
  materials: 'materials',
  pricing: 'pricing',
} as const

/** Running-quote summary for the quote-variant sub-bar (resolved in quote.tsx
    so content pages never fire the catalog/ship-date queries). */
export interface QuoteSummary {
  partCount: number
  materialLabel: string
  leadLabel: string
  shipLabel?: string
  grossTotalPln: number
}

/**
 * Sticky site-wide header (design-handoff header bar, made navigational).
 * Landing: wordmark + a "How it works" landing anchor + the content-page
 * sections (pages-first IA — the current section is highlighted) + status;
 * shows a resume-quote chip while parts exist. Below lg the link row
 * collapses into a hamburger with a full-width dropdown. Quote: wordmark
 * home (non-destructive) + a "New quote" reset. Mono uppercase, 56px tall,
 * matching Landing Page v2.dc.html.
 */
export function SiteHeader({
  variant,
  summary,
}: {
  variant: 'landing' | 'quote'
  summary?: QuoteSummary
}) {
  const strings = useStrings()
  const locale = useLocale()
  const { parts, clear } = useParts()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  // Current content section, if any — SSR-stable (derived from URL params).
  const { section } = useParams({ strict: false })
  const routeKey = section ? sectionKeyFor(locale, section) : null
  // On the landing page the highlight follows the scroll instead; the spy
  // starts null, so prerendered HTML never carries an active state.
  const { pathname } = useLocation()
  const isLanding = pathname.replace(/\/$/, '') === `/${locale}`
  const spyId = useScrollSpy(LANDING_SECTION_IDS, isLanding)
  const activeKey =
    routeKey ?? (spyId ? SPY_NAV_KEY[spyId as keyof typeof SPY_NAV_KEY] : null)
  // Route-derived = this IS the page; spy-derived = you're AT this section.
  const ariaCurrent = routeKey ? ('page' as const) : ('location' as const)

  return (
    <>
      {variant === 'landing' && (
        // First focusable element on the page; visible only when focused.
        <a
          href="#content"
          className="bg-background focus-visible:ring-ring sr-only z-50 rounded-md border px-4 py-2 font-mono text-xs font-bold tracking-widest uppercase focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.nav.skipToContent}
        </a>
      )}
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
          {/* exact: fuzzy matching would mark the home link current on every
            page under /$locale (Link force-sets aria-current when active). */}
          <Link
            to="/$locale"
            params={{ locale }}
            activeOptions={{ exact: true }}
            className="text-foreground hover:text-foreground flex items-center gap-2 font-bold"
          >
            <span
              aria-hidden
              className="bg-signal motion-safe:animate-led size-2 shrink-0 rounded-full shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-signal)_22%,transparent)]"
            />
            {strings.hero.wordmark}
          </Link>

          {variant === 'landing' ? (
            <>
              <nav className="hidden items-center gap-5 lg:flex">
                {/* Link+hash instead of a plain anchor so the landing jump
                  also works from content pages (/materialy/…). */}
                <Link
                  to="/$locale"
                  params={{ locale }}
                  hash="how-it-works"
                  // exact+hash: otherwise the router force-marks this link
                  // aria-current="page" on every /$locale/* page; the scroll
                  // spy owns its current-state instead.
                  activeOptions={{ exact: true, includeHash: true }}
                  aria-current={
                    activeKey === 'howItWorks' ? 'location' : undefined
                  }
                  className={cn(
                    'hover:text-foreground relative transition-colors',
                    activeKey === 'howItWorks'
                      ? "text-foreground after:bg-primary-text after:absolute after:-inset-x-0.5 after:-bottom-[18px] after:h-0.5 after:content-['']"
                      : 'text-muted-foreground',
                  )}
                >
                  {strings.nav.howItWorks}
                </Link>
                {NAV_SECTIONS.map((key) => (
                  <Link
                    key={key}
                    to="/$locale/$section"
                    params={{ locale, section: SECTIONS[key][locale] }}
                    aria-current={activeKey === key ? ariaCurrent : undefined}
                    className={cn(
                      'hover:text-foreground relative transition-colors',
                      activeKey === key
                        ? "text-foreground after:bg-primary-text after:absolute after:-inset-x-0.5 after:-bottom-[18px] after:h-0.5 after:content-['']"
                        : 'text-muted-foreground',
                    )}
                  >
                    {strings.nav[key]}
                  </Link>
                ))}
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  className="bg-card hover:bg-secondary text-foreground rounded-md border px-3 py-1.5 transition-colors"
                >
                  {strings.nav.trackOrder}
                </Link>
                <LocaleSwitcher />
                {parts.length > 0 ? (
                  <Link
                    to="/$locale/quote"
                    params={{ locale }}
                    className="text-primary-text hover:text-foreground font-bold whitespace-nowrap transition-colors"
                  >
                    {/* Short form in the tight 1024–1280px band (PL labels). */}
                    <span className="xl:hidden">
                      {strings.nav.resumeShort(parts.length)}
                    </span>
                    <span className="hidden xl:inline">
                      {strings.nav.resume(parts.length)}
                    </span>
                  </Link>
                ) : (
                  <span className="text-foreground hidden items-center gap-1.5 xl:flex">
                    <span className="bg-signal size-1.5 rounded-full" />
                    {strings.hero.ready}
                  </span>
                )}
              </nav>
              <div className="flex items-center gap-3 lg:hidden">
                {parts.length > 0 && (
                  <Link
                    to="/$locale/quote"
                    params={{ locale }}
                    className="text-primary-text hover:text-foreground font-bold whitespace-nowrap transition-colors"
                  >
                    {strings.nav.resume(parts.length)}
                  </Link>
                )}
                {/* Radix Dialog gives the dropdown its a11y contract for free:
                  focus trap, Escape-to-close, body scroll lock, and focus
                  return to this trigger. Visuals stay the Landing Page
                  v2.dc.html nav menu. */}
                <DialogPrimitive.Root
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                >
                  <DialogPrimitive.Trigger asChild>
                    <button
                      type="button"
                      aria-label={strings.nav.menuLabel}
                      className="text-foreground focus-visible:ring-ring -mr-2 inline-flex size-10 cursor-pointer items-center justify-center rounded-[7px] border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      {menuOpen ? (
                        <X className="size-5" />
                      ) : (
                        <Menu className="size-5" />
                      )}
                    </button>
                  </DialogPrimitive.Trigger>
                  <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="motion-safe:animate-in motion-safe:fade-in bg-background/60 fixed inset-0 top-14 z-40 backdrop-blur-sm duration-[180ms] lg:hidden" />
                    <DialogPrimitive.Content
                      aria-describedby={undefined}
                      className="motion-safe:animate-in fade-in slide-in-from-top-1.5 bg-background fixed inset-x-0 top-14 z-50 border-t px-4 pt-1.5 pb-[18px] font-mono text-xs tracking-[0.12em] uppercase duration-[180ms] ease-out lg:hidden"
                    >
                      <DialogPrimitive.Title className="sr-only">
                        {strings.nav.menuLabel}
                      </DialogPrimitive.Title>
                      <Link
                        to="/$locale"
                        params={{ locale }}
                        hash="how-it-works"
                        onClick={() => setMenuOpen(false)}
                        className="text-foreground flex items-center justify-between border-b px-1.5 py-4"
                      >
                        {strings.nav.howItWorks}
                        <span aria-hidden className="text-primary-text">
                          01
                        </span>
                      </Link>
                      {NAV_SECTIONS.map((key, i) => (
                        <Link
                          key={key}
                          to="/$locale/$section"
                          params={{ locale, section: SECTIONS[key][locale] }}
                          onClick={() => setMenuOpen(false)}
                          aria-current={routeKey === key ? 'page' : undefined}
                          className="text-foreground flex items-center justify-between border-b px-1.5 py-4"
                        >
                          {strings.nav[key]}
                          <span aria-hidden className="text-primary-text">
                            {`0${i + 2}`}
                          </span>
                        </Link>
                      ))}
                      <Link
                        to="/$locale/login"
                        params={{ locale }}
                        onClick={() => setMenuOpen(false)}
                        className="bg-primary text-primary-foreground mt-3.5 block rounded-[7px] px-2 py-[15px] text-center font-bold"
                      >
                        {strings.nav.trackOrder} →
                      </Link>
                      <div className="mt-3.5 flex justify-center">
                        <LocaleSwitcher />
                      </div>
                    </DialogPrimitive.Content>
                  </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
              </div>
            </>
          ) : (
            <nav className="flex items-center gap-4 sm:gap-6">
              <span className="text-muted-foreground hidden sm:inline">
                {strings.hero.status}
              </span>
              <LocaleSwitcher />
              <button
                type="button"
                onClick={() => {
                  clear()
                  void navigate({ to: '/$locale', params: { locale } })
                }}
                className="bg-card hover:bg-secondary cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
              >
                {strings.nav.newQuote}
              </button>
            </nav>
          )}
        </div>
      </header>
      {variant === 'landing' && (
        // Trust strip (Site Header - Faceplate.dc.html): the four service
        // promises, sourced from strings.ticker — this bar is their primary
        // carrier (RateTicker is rates-only and decorative). Scrolls away;
        // only the 56px bar above stays sticky.
        <div className="bg-secondary text-muted-foreground border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 font-mono text-[0.6rem] tracking-[0.14em] uppercase sm:gap-x-4 sm:px-6">
            {strings.ticker.map((t, i) => (
              <span key={i} className="flex items-center gap-x-3 sm:gap-x-4">
                {i > 0 && (
                  <span aria-hidden className="text-muted-foreground/50">
                    ·
                  </span>
                )}
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {variant === 'quote' && summary && (
        <div className="bg-secondary border-b">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3.5 px-4 py-2.5 font-mono text-[0.65rem] tracking-widest uppercase sm:px-6">
            <span className="bg-foreground text-background rounded px-2 py-1">
              {strings.quote.metaPieces(summary.partCount)}
            </span>
            <span className="text-muted-foreground truncate">
              {summary.materialLabel} · {summary.leadLabel}
              {summary.shipLabel &&
                ` · ${strings.process.ships} ${summary.shipLabel}`}
            </span>
            <span className="text-foreground ml-auto font-bold tabular-nums">
              {formatPln(summary.grossTotalPln, locale)}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * PL | EN segmented switcher — swaps the $locale prefix in place (route and
 * search preserved) and persists the choice for the `/` redirect. The only
 * writer of the locale cookie. Also rendered by OrderAccessShell's header.
 */
export function LocaleSwitcher() {
  const locale = useLocale()
  const navigate = useNavigate()

  function switchTo(next: Locale) {
    if (next === locale) return
    setLocaleCookie(next)
    void navigate({
      to: '.',
      params: (prev) => ({ ...prev, locale: next }),
    })
  }

  return (
    <span className="flex items-center gap-1.5">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground/50">
              /
            </span>
          )}
          <button
            type="button"
            aria-current={l === locale || undefined}
            onClick={() => switchTo(l)}
            className={cn(
              'cursor-pointer uppercase transition-colors',
              l === locale
                ? 'text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l}
          </button>
        </span>
      ))}
    </span>
  )
}
