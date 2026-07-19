import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { useWarsawClock } from '@/hooks/useWarsawClock'
import { LocaleSwitcher } from './LocaleSwitcher'

/**
 * Shared frame for the order-access screens (/login, /orders), from
 * Login Page.dc.html: minimal header, a centered two-panel card whose dark
 * left panel explains the no-account login, and a prototype footnote footer.
 * The right panel is the screen-specific content.
 */
export function OrderAccessShell({ children }: { children: ReactNode }) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.login
  const clock = useWarsawClock(30_000)

  const facts = [
    { label: s.factRetention, value: s.factRetentionValue },
    { label: s.factValidity, value: s.factValidityValue },
    { label: s.factClock, value: clock ?? '--:--' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
          <Link
            to="/$locale"
            params={{ locale }}
            className="text-foreground hover:text-foreground font-bold"
          >
            {strings.hero.wordmark}
          </Link>
          <span className="flex items-center gap-4 sm:gap-6">
            <LocaleSwitcher />
            <Link
              to="/$locale"
              params={{ locale }}
              className="bg-card hover:bg-secondary text-foreground rounded-md border px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
            >
              {strings.nav.newQuote}
            </Link>
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="bg-card flex w-full max-w-[880px] flex-wrap overflow-hidden rounded-lg border shadow-xl shadow-black/[0.06]">
          {/* dark intro panel — .dark scope remaps the design tokens */}
          <div className="dark bg-background text-foreground relative flex flex-1 basis-[300px] flex-col justify-between gap-12 px-8 py-10">
            <span className="border-foreground/30 pointer-events-none absolute top-2.5 left-2.5 size-3 border-t-2 border-l-2" />
            <span className="border-foreground/30 pointer-events-none absolute bottom-2.5 left-2.5 size-3 border-b-2 border-l-2" />
            <div>
              <p className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.24em] uppercase">
                {s.kicker}
              </p>
              <h1 className="mt-4 text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
                {s.heading}
              </h1>
              <p className="text-muted-foreground mt-4 text-[14.5px] leading-relaxed text-pretty">
                {s.sub}
              </p>
            </div>
            <dl className="flex flex-col gap-3 border-t pt-5 font-mono">
              {facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground text-[0.6rem] tracking-[0.16em] uppercase">
                    {f.label}
                  </dt>
                  <dd className="m-0 text-[11px] tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex min-w-0 flex-[1.2] basis-[340px] flex-col justify-center gap-6 px-9 py-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
