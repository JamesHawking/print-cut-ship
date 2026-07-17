import { Link, useLocation } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  LocaleProvider,
} from '@/lib/i18n'
import { SECTIONS } from '@/content/sections'

/** 404 links out to the content sections most likely to be the real goal. */
const SUGGESTED_SECTIONS = ['materials', 'pricing', 'blog'] as const

/**
 * Branded 404 (router defaultNotFoundComponent). Renders for notFound()
 * thrown anywhere in the tree AND for garbage top-level paths, where the
 * $locale route (and its LocaleProvider) never mounts — so it resolves the
 * locale itself from the path prefix and mounts its own provider. Path-only
 * resolution keeps SSR deterministic; unknown prefixes get the same default
 * the `/` redirect uses.
 */
export function NotFoundPage() {
  const { pathname } = useLocation()
  const prefix = pathname.split('/')[1]
  const locale = isLocale(prefix) ? prefix : DEFAULT_LOCALE
  const strings = getStrings(locale)
  const s = strings.notFound

  return (
    <LocaleProvider value={locale}>
      <SiteHeader variant="landing" />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-24">
            <p className="text-primary-text font-mono text-xs font-bold tracking-[0.14em] uppercase">
              {s.tag}
            </p>
            <p
              aria-hidden
              className="mt-6 font-mono text-[clamp(4rem,18vw,9rem)] leading-none font-bold tracking-[-0.04em]"
            >
              404
            </p>
            <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
              {s.heading}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-[560px] text-[15px] leading-relaxed text-pretty">
              {s.body}
            </p>

            {/* see-also idiom shared with the content pages */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-6 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              <span className="text-muted-foreground">{s.linksLabel}</span>
              <Link
                to="/$locale"
                params={{ locale }}
                className="text-primary-text hover:text-foreground font-bold transition-colors"
              >
                {s.home} →
              </Link>
              {SUGGESTED_SECTIONS.map((key) => (
                <Link
                  key={key}
                  to="/$locale/$section"
                  params={{ locale, section: SECTIONS[key][locale] }}
                  className="text-primary-text hover:text-foreground font-bold transition-colors"
                >
                  {strings.nav[key]} →
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="not-found" />
    </LocaleProvider>
  )
}
