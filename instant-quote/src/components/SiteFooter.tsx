import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { formatWarsawClock } from '@/lib/clock'

export function SiteFooter() {
  const strings = useStrings()
  const locale = useLocale()
  const { ctaHeading, ctaButton, note, meta, cutoff } = strings.footer
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-[22px] py-13 md:flex-row md:items-center md:justify-between md:py-[72px]">
          <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-black tracking-[-0.03em] text-balance uppercase">
            {ctaHeading}
          </h2>
          <a
            href="#top"
            className="bg-primary text-primary-foreground hover:shadow-primary/40 inline-flex shrink-0 items-center gap-2 rounded-md px-7 py-3.5 text-sm font-bold transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-lg"
          >
            {ctaButton} ↑
          </a>
        </div>

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
            Europe/Warsaw {formatWarsawClock(now)} · {cutoff}
          </span>
        </div>
        <p className="text-muted-foreground/70 pb-8 font-mono text-[0.65rem] tracking-wider uppercase">
          {note}
        </p>
      </div>
    </footer>
  )
}
