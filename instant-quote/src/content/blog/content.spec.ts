// Validates the real article files with the SAME zod schema the registry
// applies at build. Reads raw .mdx via gray-matter because bun cannot parse
// MDX modules (the vite-only boundary documented in registry.ts).

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { LOCALES, type Locale } from '@/lib/i18n'
import { blogFrontmatterSchema } from './schema'

const ROOT = new URL('.', import.meta.url).pathname

interface RawArticle {
  locale: Locale
  slug: string
  data: unknown
  body: string
}

const articles: RawArticle[] = LOCALES.flatMap((locale) =>
  readdirSync(join(ROOT, locale))
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const parsed = matter(readFileSync(join(ROOT, locale, file), 'utf8'))
      return {
        locale,
        slug: file.replace(/\.mdx$/, ''),
        data: parsed.data,
        body: parsed.content,
      }
    }),
)

const SEED_KEYS = ['fdm-design-guide', 'fdm-tolerances']

describe('blog frontmatter', () => {
  test('there are articles to validate', () => {
    expect(articles.length).toBeGreaterThanOrEqual(4)
  })

  for (const article of articles) {
    test(`${article.locale}/${article.slug} passes the schema`, () => {
      const result = blogFrontmatterSchema.safeParse(article.data)
      expect(result.success ? '' : result.error.message).toBe('')
    })
  }

  test('translationKey is unique within each locale', () => {
    for (const locale of LOCALES) {
      const keys = articles
        .filter((a) => a.locale === locale)
        .map((a) => (a.data as { translationKey: string }).translationKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  test('both seed articles exist in both locales', () => {
    for (const locale of LOCALES) {
      const keys = articles
        .filter((a) => a.locale === locale)
        .map((a) => (a.data as { translationKey: string }).translationKey)
      for (const key of SEED_KEYS) expect(keys).toContain(key)
    }
  })

  test('bad frontmatter fails the schema (the build gate)', () => {
    const bad = matter(
      [
        '---',
        'title: "Broken article missing required fields"',
        'date: "2026-07-17"',
        'updated: "2026-07-01"', // before date
        'author: MICRO_FACTORY',
        'tags: [FDM]', // uppercase tag
        'translationKey: broken',
        '---',
        '',
        'Body.',
      ].join('\n'),
    )
    const result = blogFrontmatterSchema.safeParse(bad.data)
    expect(result.success).toBe(false)
  })
})

describe('article body conventions', () => {
  for (const article of articles) {
    test(`${article.locale}/${article.slug} places one CtaBreak after the 2nd h2`, () => {
      const headings = [...article.body.matchAll(/^## /gm)].map(
        (m) => m.index ?? 0,
      )
      expect(headings.length).toBeGreaterThanOrEqual(4) // ToC threshold
      expect(article.body.match(/<CtaBreak \/>/g)).toHaveLength(1)
      const ctaAt = article.body.indexOf('<CtaBreak />')
      expect(ctaAt).toBeGreaterThan(headings[1]!)
      if (headings.length > 2) expect(ctaAt).toBeLessThan(headings[2]!)
    })
  }

  test('english word counts stay in the spec ranges', () => {
    const words = (slug: string) => {
      const article = articles.find(
        (a) => a.locale === 'en' && a.slug === slug,
      )!
      return (
        article.body
          .replaceAll(/^import .*$/gm, '')
          // JSX tags only — a bare "< 20 mm" in a table must NOT start a match.
          .replaceAll(/<\/?[A-Za-z][^<>\n]*\/?>/g, ' ')
          .split(/\s+/)
          .filter((word) => /[a-z0-9]/i.test(word)).length
      )
    }
    // Spec: design guide 1,200–1,800 words, tolerance guide 900–1,200 —
    // bounds padded slightly for markdown/table tokens in the raw count.
    expect(words('fdm-design-guide')).toBeGreaterThanOrEqual(1100)
    expect(words('fdm-design-guide')).toBeLessThanOrEqual(1900)
    expect(words('fdm-tolerances')).toBeGreaterThanOrEqual(850)
    expect(words('fdm-tolerances')).toBeLessThanOrEqual(1300)
  })

  test('no literal PLN amounts in article prose', () => {
    for (const article of articles) {
      expect(article.body).not.toMatch(/\d\s*zł/)
    }
  })
})
