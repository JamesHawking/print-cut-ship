import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { SECTIONS } from '@/content/sections'
import { BLOG_SECTION } from '@/content/blog/paths'
import { blogPosts } from '@/content/blog/registry'

/**
 * Content-hub teaser — the landing's only link surface into the guides and
 * comparisons hubs (the strongest page passes equity down). The two newest
 * guides plus a card for the comparisons hub, between the FAQ and the
 * footer CTA.
 */
export function GuidesTeaser() {
  const strings = useStrings()
  const locale = useLocale()
  const posts = blogPosts(locale).slice(0, 2)

  const cellClass = 'group bg-card hover:bg-secondary/60 p-6 transition-colors'
  const metaClass =
    'text-muted-foreground block font-mono text-[0.65rem] tracking-[0.14em] uppercase tabular-nums'
  const titleClass =
    'group-hover:text-primary-text mt-3 block text-[17px] leading-snug font-extrabold tracking-[-0.01em] text-pretty transition-colors'
  const linkClass =
    'text-primary-text mt-5 block font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase'

  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <h2 className="text-muted-foreground font-mono text-[0.7rem] font-bold tracking-[0.2em] uppercase">
            {strings.blogPages.teaserLabel}
          </h2>
          <Link
            to="/$locale/$section"
            params={{ locale, section: BLOG_SECTION[locale] }}
            className="text-primary-text hover:text-foreground font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase transition-colors"
          >
            {strings.blogPages.allGuidesTitle} →
          </Link>
        </div>

        <div className="bg-border mt-8 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to="/$locale/$section/$detail"
              params={{
                locale,
                section: BLOG_SECTION[locale],
                detail: post.slug,
              }}
              className={cellClass}
            >
              <span className={metaClass}>
                {post.date} ·{' '}
                {strings.blogPages.readingTime(post.readingTimeMinutes)}
              </span>
              <span className={titleClass}>{post.fm.title}</span>
              <span className={linkClass}>{strings.blogPages.readGuide}</span>
            </Link>
          ))}
          <Link
            to="/$locale/$section"
            params={{ locale, section: SECTIONS.compare[locale] }}
            className={cellClass}
          >
            <span className={metaClass}>{strings.nav.compare}</span>
            <span className={titleClass}>
              {strings.comparePages.teaserTitle}
            </span>
            <span className={linkClass}>
              {strings.comparePages.readVerdict}
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
