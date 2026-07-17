import { describe, expect, test } from 'bun:test'
import { buildRssXml } from './rss'
import { SITE_URL } from './seo'

const feed = buildRssXml({
  locale: 'en',
  title: 'Feed & friends',
  description: 'Guides <for> engineers',
  indexPath: '/en/blog',
  selfPath: '/en/blog/rss.xml',
  items: [
    {
      title: 'Old post',
      description: 'a',
      path: '/en/blog/old',
      isoDate: '2026-01-05',
    },
    {
      title: 'Tolerances & fits <FDM>',
      description: 'b',
      path: '/en/blog/new',
      isoDate: '2026-07-10',
    },
  ],
})

describe('buildRssXml', () => {
  test('is an RSS 2.0 document with a self link', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(feed).toContain('<rss version="2.0"')
    expect(feed).toContain(
      `<atom:link href="${SITE_URL}/en/blog/rss.xml" rel="self"`,
    )
    expect(feed).toContain('<language>en-GB</language>')
  })

  test('one item per input with permalink guid', () => {
    expect(feed.match(/<item>/g)).toHaveLength(2)
    expect(feed).toContain(
      `<guid isPermaLink="true">${SITE_URL}/en/blog/new</guid>`,
    )
  })

  test('escapes XML special characters', () => {
    expect(feed).toContain('Feed &amp; friends')
    expect(feed).toContain('Guides &lt;for&gt; engineers')
    expect(feed).toContain('Tolerances &amp; fits &lt;FDM&gt;')
    expect(feed).not.toContain('<FDM>')
  })

  test('RFC-1123 pubDate; lastBuildDate is the newest item', () => {
    expect(feed).toContain('<pubDate>Fri, 10 Jul 2026 00:00:00 GMT</pubDate>')
    expect(feed).toContain(
      '<lastBuildDate>Fri, 10 Jul 2026 00:00:00 GMT</lastBuildDate>',
    )
  })

  test('empty feed omits lastBuildDate and items but stays valid', () => {
    const empty = buildRssXml({
      locale: 'pl',
      title: 't',
      description: 'd',
      indexPath: '/pl/baza-wiedzy',
      selfPath: '/pl/baza-wiedzy/rss.xml',
      items: [],
    })
    expect(empty).toContain('<language>pl</language>')
    expect(empty).not.toContain('<lastBuildDate>')
    expect(empty).not.toContain('<item>')
  })
})
