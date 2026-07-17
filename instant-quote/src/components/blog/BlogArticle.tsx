import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { useLocale, useStrings } from '@/lib/i18n'
import { BLOG_SECTION } from '@/content/blog/paths'
import { getBlogPost, relatedTo } from '@/content/blog/registry'
import { flattenToc } from '@/content/blog/toc'
import { mdxComponents } from './mdx-components'

/** Hero tag readout: "fdm · tolerances" → "FDM · TOL" (design 1d). */
function tagAbbrev(tags: ReadonlyArray<string>): string {
  return tags
    .map((tag) => (tag.length <= 4 ? tag : tag.slice(0, 3))) // i18n-exempt — code, not copy
    .join(' · ')
    .toUpperCase()
}

/**
 * Article template in the "Spec-sheet" direction (SEO Pages Revamp 1d):
 * dark datasheet hero with a baseline spec strip (date, reading time, the
 * article's key figure from frontmatter, tags), a horizontal numbered
 * contents rail, numbered h2s (CSS counter set here, incremented by the
 * mdx h2 mapping), author box and related articles.
 */
export function BlogArticle({ slug }: { slug: string }) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.blogPages
  const post = getBlogPost(locale, slug)
  if (!post) return null // beforeLoad 404s first
  const sourcePage = `blog/${slug}`
  const toc = flattenToc(post.toc)
  const rail = toc.filter((entry) => entry.depth === 2)
  const related = relatedTo(post)

  const specCells: Array<{ value: string; label: string }> = [
    post.fm.updated !== undefined
      ? { value: post.fm.updated, label: s.updatedLabel }
      : { value: post.date, label: s.publishedLabel },
    {
      value: `${post.readingTimeMinutes} min`,
      label: s.readingTimeLabel,
    },
    ...(post.fm.keyFigure !== undefined && post.fm.keyFigureLabel !== undefined
      ? [{ value: post.fm.keyFigure, label: post.fm.keyFigureLabel }]
      : []),
    { value: tagAbbrev(post.tags), label: s.tagsLabel },
  ]

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* dark datasheet hero */}
        <section className="dark bg-background text-foreground border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 md:pt-16 md:pb-14">
            <ContentBreadcrumb
              items={[
                { label: strings.materialsPages.breadcrumbHome, to: 'home' },
                { label: s.breadcrumb, to: 'blog' },
                { label: post.fm.title },
              ]}
            />
            <h1 className="mt-8 max-w-4xl text-[clamp(2rem,5vw,3.375rem)] leading-[1.02] font-black tracking-[-0.03em] text-balance uppercase">
              {post.fm.title}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-[16px] leading-relaxed text-pretty">
              {post.fm.description}
            </p>
            <dl
              className={`mt-11 grid grid-cols-2 gap-y-7 border-t md:divide-x ${
                specCells.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
              }`}
            >
              {specCells.map((cell) => (
                <div
                  key={cell.label}
                  className="pt-5 pr-5 md:px-5 md:first:pl-0"
                >
                  <dd className="font-mono text-[clamp(0.95rem,1.8vw,1.25rem)] font-bold whitespace-nowrap tabular-nums">
                    {cell.value}
                  </dd>
                  <dt className="text-muted-foreground mt-2.5 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
                    {cell.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* horizontal contents rail */}
        {rail.length >= 4 && (
          <nav aria-label={s.tocTitle} className="bg-card relative border-b">
            <span
              aria-hidden
              className="from-card/0 to-card text-muted-foreground pointer-events-none absolute inset-y-0 right-0 z-10 flex w-24 items-center justify-end bg-gradient-to-r to-60% pr-4 font-mono text-[0.6rem] tracking-[0.14em] uppercase sm:hidden"
            >
              {s.scrollHint}
            </span>
            <div className="mx-auto flex h-13 max-w-6xl items-center gap-7 overflow-x-auto px-4 font-mono text-[0.65rem] tracking-[0.1em] whitespace-nowrap uppercase sm:px-6 [&::-webkit-scrollbar]:hidden">
              <span className="text-muted-foreground">{s.tocTitle}</span>
              {rail.map((entry, i) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-primary-text font-bold">
                    {String(i + 1).padStart(2, '0')}
                  </span>{' '}
                  {entry.value}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* body */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-16">
            <article className="mx-auto max-w-[70ch] [counter-reset:sec] [&>p:first-of-type]:text-[17px]">
              <post.Component components={mdxComponents(sourcePage)} />
            </article>

            {/* author box */}
            <aside className="bg-card mx-auto mt-14 max-w-[70ch] rounded-lg border p-6">
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
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-18">
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
                      {other.date} · {s.readingTime(other.readingTimeMinutes)}
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
