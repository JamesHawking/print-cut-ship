import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { track } from '@/lib/funnel'

/**
 * The shared upload CTA (seo_prompts/01): every content page ends in it — the
 * quote tool is the CTA. Deep-links to the landing intake with ?source= so
 * content-page conversion is attributable; fires cta_upload_clicked on click.
 *
 * `full` = page-footer band (adopted by SiteFooter); `compact` = inline card
 * for prose (content pages, prompt 02+).
 */
export function QuoteCta({
  variant,
  sourcePage,
}: {
  variant: 'compact' | 'full'
  sourcePage: string
}) {
  const strings = useStrings()
  const locale = useLocale()
  const { headline, trust, button } = strings.cta

  const cta = (arrow: string) => (
    <Link
      to="/$locale"
      params={{ locale }}
      search={{ source: sourcePage }}
      hash="top"
      onClick={() => track('cta_upload_clicked', { source_page: sourcePage })}
      className="bg-primary text-primary-foreground hover:shadow-primary/40 inline-flex shrink-0 items-center gap-2 rounded-md px-7 py-3.5 text-sm font-bold transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-lg"
    >
      {button} {arrow}
    </Link>
  )

  if (variant === 'full') {
    return (
      <div className="flex flex-col items-start gap-[22px] py-13 md:flex-row md:items-center md:justify-between md:py-[72px]">
        <div>
          <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-black tracking-[-0.03em] text-balance uppercase">
            {headline}
          </h2>
          <p className="text-muted-foreground mt-3 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
            {trust}
          </p>
        </div>
        {cta('↑')}
      </div>
    )
  }

  return (
    <div className="bg-card flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border px-6 py-5">
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-[0.9375rem] font-bold">{headline}</p>
        <p className="text-muted-foreground mt-1 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
          {trust}
        </p>
      </div>
      {cta('→')}
    </div>
  )
}
