// RSS 2.0 builder for the per-locale blog feeds (bun-safe, pure — the
// rss[.]xml server routes feed it registry posts). Deterministic output:
// lastBuildDate derives from the newest item, never from the wall clock,
// so prerendered feeds only change when content does.

import type { Locale } from '@/lib/i18n'
import { SITE_URL } from '@/lib/seo'

const RSS_LANGUAGE: Record<Locale, string> = { pl: 'pl', en: 'en-GB' }

export interface RssItem {
  title: string
  description: string
  /** Site-relative article path, e.g. /en/blog/fdm-tolerances. */
  path: string
  /** ISO day used as pubDate — updated ?? date of the article. */
  isoDate: string
}

export interface RssFeedOptions {
  locale: Locale
  title: string
  description: string
  /** Site-relative listing path (the channel link). */
  indexPath: string
  /** Site-relative path of the feed itself (atom:link rel=self). */
  selfPath: string
  items: ReadonlyArray<RssItem>
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function rfc1123(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toUTCString()
}

export function buildRssXml(opts: RssFeedOptions): string {
  const newest = opts.items.reduce<string | null>(
    (max, item) => (max === null || item.isoDate > max ? item.isoDate : max),
    null,
  )
  const items = opts.items
    .map((item) =>
      [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${SITE_URL}${item.path}</link>`,
        `      <guid isPermaLink="true">${SITE_URL}${item.path}</guid>`,
        `      <description>${escapeXml(item.description)}</description>`,
        `      <pubDate>${rfc1123(item.isoDate)}</pubDate>`,
        '    </item>',
      ].join('\n'),
    )
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(opts.title)}</title>`,
    `    <link>${SITE_URL}${opts.indexPath}</link>`,
    `    <description>${escapeXml(opts.description)}</description>`,
    `    <language>${RSS_LANGUAGE[opts.locale]}</language>`,
    `    <atom:link href="${SITE_URL}${opts.selfPath}" rel="self" type="application/rss+xml"/>`,
    ...(newest === null
      ? []
      : [`    <lastBuildDate>${rfc1123(newest)}</lastBuildDate>`]),
    ...(items === '' ? [] : [items]),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
