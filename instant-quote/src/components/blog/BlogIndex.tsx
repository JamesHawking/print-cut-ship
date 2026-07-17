import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { useLocale, useStrings } from '@/lib/i18n'
import { formatArticleDate } from '@/lib/format'
import { BLOG_SECTION } from '@/content/blog/paths'
import { blogPosts, blogTags } from '@/content/blog/registry'

/**
 * Blog listing (seo_prompts/05): this locale's articles, newest first, with
 * a client-side tag filter. Plain useState (no search param) on purpose —
 * the prerendered HTML stays the full unfiltered list, and the shared
 * $section index route stays free of blog-only params.
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
            {tags.length > 0 && (
              <div
                role="group"
                aria-label={s.tagFilterLabel}
                className="mb-10 flex flex-wrap items-center gap-2"
              >
                {[null, ...tags].map((tag) => (
                  <button
                    key={tag ?? '__all'}
                    type="button"
                    onClick={() => setActiveTag(tag)}
                    aria-pressed={activeTag === tag}
                    className={`rounded-full border px-3.5 py-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase transition-colors ${
                      activeTag === tag
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tag ?? s.allTag}
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="text-muted-foreground text-[15px]">
                {s.emptyFiltered}
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {shown.map((post) => (
                  <Link
                    key={post.slug}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: BLOG_SECTION[locale],
                      detail: post.slug,
                    }}
                    className="group bg-card hover:border-primary/60 flex flex-col rounded-lg border p-6 transition-[border-color,box-shadow] hover:shadow-lg"
                  >
                    <span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.16em] uppercase tabular-nums">
                      {formatArticleDate(post.date, locale)} ·{' '}
                      {s.readingTime(post.readingTimeMinutes)}
                    </span>
                    <span className="mt-3 text-lg font-extrabold tracking-tight text-pretty">
                      {post.fm.title}
                    </span>
                    <span className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed text-pretty">
                      {post.fm.description}
                    </span>
                    <span className="mt-4 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="blog" />
    </>
  )
}
