import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { useWarsawClock } from '@/hooks/useWarsawClock'
import { QuoteCta } from './QuoteCta'

export function SiteFooter() {
  const strings = useStrings()
  const locale = useLocale()
  const { note, meta, cutoff } = strings.footer
  const clock = useWarsawClock()
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <QuoteCta variant="full" sourcePage="footer" />

        <div className="text-muted-foreground flex flex-col gap-3 border-t py-6 font-mono text-xs tracking-widest uppercase sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="text-foreground font-bold">
            {strings.hero.wordmark}
          </span>
          <Link
            to="/$locale/login"
            params={{ locale }}
            className="hover:text-foreground transition-colors"
          >
            {strings.nav.trackOrder}
          </Link>
          <span>{meta}</span>
          <span className="tabular-nums">
            {strings.config.warsawTz} {clock} · {cutoff}
          </span>
        </div>
        <p className="text-muted-foreground/70 pb-8 font-mono text-[0.65rem] tracking-wider uppercase">
          {note}
        </p>
      </div>
    </footer>
  )
}
