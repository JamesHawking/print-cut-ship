import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { SectionHeading } from '@/components/SectionHeading'
import { useLocale, useStrings } from '@/lib/i18n'
import { BLOG_SECTION, rssPath } from '@/content/blog/paths'
import { blogPosts, blogTags } from '@/content/blog/registry'
import { FeatureFigure } from './FeatureFigure'

/**
 * Blog listing in the "Feature" direction (SEO Pages Revamp 1b): the newest
 * guide as a diagram-forward feature panel in the hero, the full list as a
 * ledger of hairline rows below, tag chips on the ledger heading. The tag
 * filter is plain useState — prerendered HTML stays the unfiltered list.
 */
export function BlogIndex() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.blogPages
  const posts = blogPosts(locale)
  const tags = blogTags(locale)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const shown =
    activeTag === null
      ? posts
      : posts.filter((post) => post.tags.includes(activeTag))
  const newest = posts[0]
  const figure = newest ? s.featureFigures[newest.translationKey] : undefined

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* hero + feature panel */}
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

            {newest && (
              <Link
                to="/$locale/$section/$detail"
                params={{
                  locale,
                  section: BLOG_SECTION[locale],
                  detail: newest.slug,
                }}
                className="group bg-card hover:border-primary/60 mt-12 grid overflow-hidden rounded-lg border transition-[border-color,box-shadow] hover:shadow-lg md:grid-cols-[minmax(300px,460px)_1fr]"
              >
                <FeatureFigure
                  caption={figure?.caption}
                  annotation={figure?.annotation}
                />
                <span className="flex flex-col justify-center p-7 md:p-11">
                  <span className="text-muted-foreground flex flex-wrap items-center gap-3.5 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
                    <span className="bg-primary text-primary-foreground px-2 py-0.5 font-bold tracking-[0.1em]">
                      {s.newestLabel}
                    </span>
                    <span className="tabular-nums">
                      {newest.date} · {s.readingTime(newest.readingTimeMinutes)}
                    </span>
                  </span>
                  <span className="mt-4 text-[clamp(1.4rem,3vw,2.25rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance">
                    {newest.fm.title}
                  </span>
                  <span className="text-muted-foreground mt-4 text-[15px] leading-relaxed text-pretty">
                    {newest.fm.description}
                  </span>
                  <span className="text-primary-text group-hover:text-foreground mt-6 font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase transition-colors">
                    {s.readGuide}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </section>

        {/* ledger */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-22">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-4 border-b pb-5">
              <SectionHeading
                n="01"
                title={s.allGuidesTitle}
                className="border-b-0 pb-0"
              />
              {tags.length > 0 && (
                <span
                  role="group"
                  aria-label={s.tagFilterLabel}
                  className="flex flex-wrap gap-2 sm:ml-auto"
                >
                  {[null, ...tags].map((tag) => (
                    <button
                      key={tag ?? '__all'}
                      type="button"
                      onClick={() => setActiveTag(tag)}
                      aria-pressed={activeTag === tag}
                      className={`cursor-pointer rounded-full border px-3.5 py-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase transition-colors ${
                        activeTag === tag
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tag ?? s.allTag}
                    </button>
                  ))}
                </span>
              )}
            </div>

            {shown.length === 0 ? (
              <p className="text-muted-foreground mt-8 text-[15px]">
                {s.emptyFiltered}
              </p>
            ) : (
              shown.map((post) => (
                <Link
                  key={post.slug}
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: BLOG_SECTION[locale],
                    detail: post.slug,
                  }}
                  className="group hover:bg-card grid items-baseline gap-x-6 gap-y-1.5 border-b py-6 transition-colors sm:grid-cols-[176px_1fr_auto]"
                >
                  <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.12em] uppercase tabular-nums">
                    {post.date} · {s.readingTime(post.readingTimeMinutes)}
                  </span>
                  <span className="group-hover:text-primary-text text-[19px] font-extrabold tracking-[-0.01em] text-pretty transition-colors">
                    {post.fm.title}
                  </span>
                  <span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
                    {post.tags.join(' · ')}
                  </span>
                </Link>
              ))
            )}

            <div className="text-muted-foreground mt-5 flex flex-wrap justify-between gap-x-6 gap-y-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              <span>
                {s.guidesCount(posts.length)} · {s.rssNote}{' '}
                <a
                  href={rssPath(locale)}
                  className="text-primary-text hover:text-foreground font-bold transition-colors"
                >
                  {s.rssLinkLabel}
                </a>
              </span>
              <span>{s.writtenBy}</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="blog" />
    </>
  )
}
