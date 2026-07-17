import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { useLocale, useStrings } from '@/lib/i18n'
import { formatArticleDate } from '@/lib/format'
import { BLOG_SECTION, blogIndexPath } from '@/content/blog/paths'
import { getBlogPost, relatedTo } from '@/content/blog/registry'
import { flattenToc } from '@/content/blog/toc'
import { mdxComponents } from './mdx-components'

/**
 * Article template (seo_prompts/05): readable ~70ch measure, ToC at 4+
 * h2/h3 headings, MDX body with the shared element mapping (compact CTA
 * arrives via the author-placed <CtaBreak/>), author box, related articles
 * by shared tags, full CTA in the footer.
 */
export function BlogArticle({ slug }: { slug: string }) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.blogPages
  const post = getBlogPost(locale, slug)
  if (!post) return null // beforeLoad 404s first
  const sourcePage = `blog/${slug}`
  const toc = flattenToc(post.toc)
  const related = relatedTo(post)

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* hero */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                {
                  label: strings.materialsPages.breadcrumbHome,
                  href: `/${locale}`,
                },
                { label: s.breadcrumb, href: blogIndexPath(locale) },
                { label: post.fm.title },
              ]}
            />
            <h1 className="mt-8 max-w-4xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-black tracking-[-0.03em] text-balance uppercase">
              {post.fm.title}
            </h1>
            <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              <span>{post.fm.author}</span>
              <span className="tabular-nums">
                {s.publishedLabel} {formatArticleDate(post.date, locale)}
              </span>
              {post.fm.updated !== undefined && (
                <span className="tabular-nums">
                  {s.updatedLabel} {formatArticleDate(post.fm.updated, locale)}
                </span>
              )}
              <span className="tabular-nums">
                {s.readingTime(post.readingTimeMinutes)}
              </span>
              <span className="flex gap-1.5 normal-case">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </span>
            </div>
          </div>
        </section>

        {/* body */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-20">
            {toc.length >= 4 && (
              <nav
                aria-label={s.tocTitle}
                className="bg-card mb-12 max-w-[70ch] rounded-lg border p-6"
              >
                <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
                  {s.tocTitle}
                </span>
                <ol className="mt-4 space-y-2 text-[14px]">
                  {toc.map((entry) => (
                    <li
                      key={entry.id}
                      className={entry.depth === 3 ? 'pl-5' : undefined}
                    >
                      <a
                        href={`#${entry.id}`}
                        className="text-muted-foreground hover:text-foreground font-medium transition-colors"
                      >
                        {entry.value}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <article className="max-w-[70ch]">
              <post.Component components={mdxComponents(sourcePage)} />
            </article>

            {/* author box */}
            <aside className="bg-card mt-14 max-w-[70ch] rounded-lg border p-6">
              <span className="block text-[15px] font-bold">
                {post.fm.author}
              </span>
              <span className="text-muted-foreground mt-1 block font-mono text-[0.65rem] tracking-[0.14em] uppercase">
                {s.authorRole}
              </span>
            </aside>
          </div>
        </section>

        {/* related */}
        {related.length > 0 && (
          <section className="border-b">
            <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-20">
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
                {s.relatedTitle}
              </span>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((other) => (
                  <Link
                    key={other.slug}
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: BLOG_SECTION[locale],
                      detail: other.slug,
                    }}
                    className="group bg-card hover:border-primary/60 flex flex-col rounded-lg border p-6 transition-[border-color,box-shadow] hover:shadow-lg"
                  >
                    <span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.16em] uppercase tabular-nums">
                      {formatArticleDate(other.date, locale)}
                    </span>
                    <span className="mt-3 text-[15px] font-extrabold tracking-tight text-pretty">
                      {other.fm.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter ctaSourcePage={sourcePage} />
    </>
  )
}
