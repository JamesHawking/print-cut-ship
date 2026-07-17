import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { useLocale, useStrings } from '@/lib/i18n'
import { compareCopy } from '@/content/compare/copy'
import { COMPARE_SECTION, COMPARISONS } from '@/content/compare/slugs'

/** /compare index: cards for the three published comparisons. */
export function ComparisonsIndex() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.comparePages
  const copy = compareCopy(locale)

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                {
                  label: strings.materialsPages.breadcrumbHome,
                  href: `/${locale}`,
                },
                { label: s.breadcrumb },
              ]}
            />
            <h1 className="mt-8 text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-black tracking-[-0.03em] uppercase">
              {s.indexHeading}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-[17px] leading-relaxed text-pretty">
              {s.indexIntro}
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {COMPARISONS.map(({ slug }) => (
                <Link
                  key={slug}
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: COMPARE_SECTION[locale],
                    detail: slug,
                  }}
                  className="group bg-card hover:border-primary/60 flex flex-col rounded-lg border p-6 transition-[border-color,box-shadow] hover:shadow-lg"
                >
                  <span className="text-lg font-extrabold tracking-tight">
                    {copy[slug].title}
                  </span>
                  <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                    {copy[slug].teaser}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="compare-index" />
    </>
  )
}
