import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { useWarsawClock } from '@/hooks/useWarsawClock'
import { NAV_SECTIONS, SECTIONS } from '@/content/sections'
import { QuoteCta } from './QuoteCta'

export function SiteFooter({
  ctaSourcePage = 'footer',
}: {
  /** Content pages attribute the footer CTA to themselves. */
  ctaSourcePage?: string
}) {
  const strings = useStrings()
  const locale = useLocale()
  const { note, meta, cutoff, navLabel, orderLabel } = strings.footer
  const clock = useWarsawClock()
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <QuoteCta variant="full" sourcePage={ctaSourcePage} />

        {/* sitemap — every public page family, grouped */}
        <div className="text-muted-foreground grid gap-10 border-t py-10 font-mono text-xs tracking-widest uppercase sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-foreground font-bold">
              {strings.hero.wordmark}
            </span>
            <p className="mt-3 text-[0.65rem] tracking-wider">{meta}</p>
          </div>
          <nav aria-label={navLabel}>
            <span className="text-muted-foreground/70 text-[0.65rem] tracking-wider">
              {navLabel}
            </span>
            <ul className="mt-3.5 flex flex-col gap-3">
              <li>
                <Link
                  to="/$locale"
                  params={{ locale }}
                  hash="how-it-works"
                  // Same as the header: without exact+hash matching the
                  // router marks this aria-current on the whole landing.
                  activeOptions={{ exact: true, includeHash: true }}
                  className="hover:text-foreground transition-colors"
                >
                  {strings.nav.howItWorks}
                </Link>
              </li>
              {NAV_SECTIONS.map((key) => (
                <li key={key}>
                  <Link
                    to="/$locale/$section"
                    params={{ locale, section: SECTIONS[key][locale] }}
                    className="hover:text-foreground transition-colors"
                  >
                    {strings.nav[key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={orderLabel}>
            <span className="text-muted-foreground/70 text-[0.65rem] tracking-wider">
              {orderLabel}
            </span>
            <ul className="mt-3.5 flex flex-col gap-3">
              <li>
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  className="hover:text-foreground transition-colors"
                >
                  {strings.nav.trackOrder}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="text-muted-foreground flex flex-col gap-3 border-t py-6 pb-8 font-mono text-[0.65rem] tracking-wider uppercase sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground/70">{note}</p>
          <span className="shrink-0 tabular-nums">
            {strings.config.warsawTz} {clock} · {cutoff}
          </span>
        </div>
      </div>
    </footer>
  )
}
