import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { LOCALES, useLocale, type Locale } from '@/lib/i18n'
import { setLocaleCookie } from '@/lib/i18n/detect'

/**
 * PL | EN segmented switcher — swaps the $locale prefix in place (route and
 * search preserved) and persists the choice for the `/` redirect. The only
 * writer of the locale cookie. Rendered by SiteHeader (desktop + mobile
 * menu) and OrderAccessShell. Buttons carry a 40×40px hit area; the negative
 * margins keep the visual density identical.
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
              '-mx-2 -my-2 inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center uppercase transition-colors',
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
