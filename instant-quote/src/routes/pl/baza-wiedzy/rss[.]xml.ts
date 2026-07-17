import { createFileRoute } from '@tanstack/react-router'
import { getStrings } from '@/lib/i18n'
import { buildRssXml } from '@/lib/rss'
import { blogIndexPath, blogPath, rssPath } from '@/content/blog/paths'
import { blogPosts } from '@/content/blog/registry'

// Twin of src/routes/en/blog/rss[.]xml.ts — see the comment there.
export const Route = createFileRoute('/pl/baza-wiedzy/rss.xml')({
  server: {
    handlers: {
      GET: () => {
        const s = getStrings('pl').blogPages
        return new Response(
          buildRssXml({
            locale: 'pl',
            title: s.rssTitle,
            description: s.rssDescription,
            indexPath: blogIndexPath('pl'),
            selfPath: rssPath('pl'),
            items: blogPosts('pl').map((post) => ({
              title: post.fm.title,
              description: post.fm.description,
              path: blogPath('pl', post.slug),
              isoDate: post.fm.updated ?? post.fm.date,
            })),
          }),
          { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } },
        )
      },
    },
  },
})
