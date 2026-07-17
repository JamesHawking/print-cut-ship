import { createFileRoute } from '@tanstack/react-router'
import { getStrings } from '@/lib/i18n'
import { buildRssXml } from '@/lib/rss'
import { blogIndexPath, blogPath, rssPath } from '@/content/blog/paths'
import { blogPosts } from '@/content/blog/registry'

// Per-locale blog feed (plans/seo/05). A static route segment out-ranks
// the dynamic /$locale/$section tree, and the prerenderer writes the
// response to .output/public/en/blog/rss.xml at build (the rssPages entry
// in vite.config). Twin: src/routes/pl/baza-wiedzy/rss[.]xml.ts.
export const Route = createFileRoute('/en/blog/rss.xml')({
  server: {
    handlers: {
      GET: () => {
        const s = getStrings('en').blogPages
        return new Response(
          buildRssXml({
            locale: 'en',
            title: s.rssTitle,
            description: s.rssDescription,
            indexPath: blogIndexPath('en'),
            selfPath: rssPath('en'),
            items: blogPosts('en').map((post) => ({
              title: post.fm.title,
              description: post.fm.description,
              path: blogPath('en', post.slug),
              isoDate: post.fm.updated ?? post.fm.date,
            })),
          }),
          { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } },
        )
      },
    },
  },
})
