import { Link, useNavigate } from '@tanstack/react-router'
import { useParts } from '@/hooks/useParts'
import { strings } from '@/lib/strings'

/**
 * Sticky site-wide header (design-handoff header bar, made navigational).
 * Landing: wordmark + section anchors + status; shows a resume-quote chip
 * while parts exist. Quote: wordmark home (non-destructive) + a "New quote"
 * reset. Mono 11px uppercase, 56px tall, matching Landing Page.dc.html.
 */
export function SiteHeader({ variant }: { variant: 'landing' | 'quote' }) {
  const { parts, clear } = useParts()
  const navigate = useNavigate()

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
          <nav className="flex items-center gap-4 sm:gap-6">
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
              className="text-muted-foreground hover:text-foreground hidden transition-colors sm:inline"
            >
              {strings.nav.pricing}
            </a>
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
    </header>
  )
}
