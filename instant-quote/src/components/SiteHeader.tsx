import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useParts } from '@/hooks/useParts'
import { strings } from '@/lib/strings'

/**
 * Sticky site-wide header (design-handoff header bar, made navigational).
 * Landing: wordmark + section anchors + status; shows a resume-quote chip
 * while parts exist. Below md the link row collapses into a hamburger with
 * a full-width dropdown. Quote: wordmark home (non-destructive) + a
 * "New quote" reset. Mono 11px uppercase, 56px tall, matching
 * Landing Page v2.dc.html.
 */
export function SiteHeader({ variant }: { variant: 'landing' | 'quote' }) {
  const { parts, clear } = useParts()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
        <Link
          to="/"
          className="text-foreground hover:text-foreground font-bold"
        >
          {strings.hero.wordmark}
        </Link>

        {variant === 'landing' ? (
          <>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#how-it-works"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {strings.nav.howItWorks}
              </a>
              <a
                href="#materials"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {strings.nav.materials}
              </a>
              <a
                href="#pricing"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {strings.nav.pricing}
              </a>
              <Link
                to="/login"
                className="bg-card hover:bg-secondary text-foreground rounded-md border px-3 py-1.5 transition-colors"
              >
                {strings.nav.trackOrder}
              </Link>
              {parts.length > 0 ? (
                <Link
                  to="/quote"
                  className="text-primary-text hover:text-foreground font-bold whitespace-nowrap transition-colors"
                >
                  {strings.nav.resume(parts.length)}
                </Link>
              ) : (
                <span className="text-foreground hidden items-center gap-1.5 lg:flex">
                  <span className="bg-signal size-1.5 rounded-full" />
                  {strings.hero.ready}
                </span>
              )}
            </nav>
            <div className="flex items-center gap-3 md:hidden">
              {parts.length > 0 && (
                <Link
                  to="/quote"
                  className="text-primary-text hover:text-foreground font-bold whitespace-nowrap transition-colors"
                >
                  {strings.nav.resume(parts.length)}
                </Link>
              )}
              <button
                type="button"
                aria-label={strings.nav.menuLabel}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="text-foreground focus-visible:ring-ring -mr-2 inline-flex size-10 cursor-pointer items-center justify-center rounded-[7px] border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {menuOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </button>
            </div>
          </>
        ) : (
          <nav className="flex items-center gap-4 sm:gap-6">
            <span className="text-muted-foreground hidden sm:inline">
              {strings.hero.status}
            </span>
            <button
              type="button"
              onClick={() => {
                clear()
                void navigate({ to: '/' })
              }}
              className="bg-card hover:bg-secondary cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
            >
              {strings.nav.newQuote}
            </button>
          </nav>
        )}
      </div>

      {/* mobile dropdown (landing only) — Landing Page v2.dc.html nav menu */}
      {variant === 'landing' && menuOpen && (
        <div className="animate-in fade-in slide-in-from-top-1.5 border-t px-4 pt-1.5 pb-[18px] font-mono text-xs tracking-[0.12em] uppercase duration-[180ms] ease-out md:hidden">
          {[
            { href: '#how-it-works', label: strings.nav.howItWorks, n: '01' },
            { href: '#materials', label: strings.nav.materials, n: '02' },
            { href: '#pricing', label: strings.nav.pricing, n: '03' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="text-foreground flex items-center justify-between border-b px-1.5 py-4"
            >
              {item.label}
              <span aria-hidden className="text-primary-text">
                {item.n}
              </span>
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="bg-primary text-primary-foreground mt-3.5 block rounded-[7px] px-2 py-[15px] text-center font-bold"
          >
            {strings.nav.trackOrder} →
          </Link>
        </div>
      )}
    </header>
  )
}
