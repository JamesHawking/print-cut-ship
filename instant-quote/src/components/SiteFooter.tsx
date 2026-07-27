import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { track } from '@/lib/funnel'
import { useFilePicker } from '@/hooks/useFilePicker'
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
  const openFilePicker = useFilePicker()
  const { note, meta, cutoff, navLabel, orderLabel } = strings.footer
  const clock = useWarsawClock()
  // id: the sticky quote bar observes the footer to yield to this CTA band.
  return (
    <footer id="site-footer">
      {/* ≤sm: one compact dark band (Mobile Audit 1b) — headline, 56px CTA,
        a wrapped chip row instead of three stacked sitemap columns. */}
      <div className="dark bg-background text-foreground border-t sm:hidden">
        <div className="px-4 pt-9 pb-7">
          <h2 className="text-[27px] leading-[1.05] font-black tracking-[-0.03em] uppercase">
            {strings.cta.headline}
          </h2>
          <button
            type="button"
            onClick={() => {
              track('cta_upload_clicked', { source_page: ctaSourcePage })
              openFilePicker()
            }}
            className="bg-primary text-primary-foreground focus-visible:ring-ring mt-4 flex h-14 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[15px] font-bold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.cta.button} <span aria-hidden>→</span>
          </button>
          <p className="text-muted-foreground mt-3 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
            {strings.cta.trust}
          </p>
          <nav
            aria-label={navLabel}
            className="border-foreground/15 mt-7 border-t pt-4.5"
          >
            <ul className="text-muted-foreground flex flex-wrap gap-x-4.5 gap-y-2.5 font-mono text-[0.65rem] tracking-wider uppercase">
              {NAV_SECTIONS.map((key) => (
                <li key={key}>
                  <Link
                    to="/$locale/$section"
                    params={{ locale, section: SECTIONS[key][locale] }}
                  >
                    {strings.nav[key]}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/$locale/login" params={{ locale }}>
                  {strings.nav.trackOrder}
                </Link>
              </li>
              <li>
                <Link
                  to="/$locale/$section"
                  params={{ locale, section: SECTIONS.contact[locale] }}
                >
                  {strings.footer.contactLabel}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-muted-foreground/70 mt-5 font-mono text-[0.6rem] leading-relaxed tracking-wider uppercase">
            {meta}
            <br />
            <span className="tabular-nums">
              {strings.config.warsawTz}{' '}
              <span className={clock ? undefined : 'opacity-40'}>
                {clock ?? '--:--'}
              </span>{' '}
              · {cutoff}
            </span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 max-sm:hidden sm:px-6">
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
              <li>
                {/* Plan 06: contact lives outside NAV_SECTIONS (no header
                    nav slot), so the sitemap links it explicitly. */}
                <Link
                  to="/$locale/$section"
                  params={{ locale, section: SECTIONS.contact[locale] }}
                  className="hover:text-foreground transition-colors"
                >
                  {strings.footer.contactLabel}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="text-muted-foreground flex flex-col gap-3 border-t py-6 pb-8 font-mono text-[0.65rem] tracking-wider uppercase sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground/70">{note}</p>
          <span className="shrink-0 tabular-nums">
            {strings.config.warsawTz}{' '}
            <span className={clock ? undefined : 'opacity-40'}>
              {clock ?? '--:--'}
            </span>{' '}
            · {cutoff}
          </span>
        </div>
      </div>
    </footer>
  )
}
