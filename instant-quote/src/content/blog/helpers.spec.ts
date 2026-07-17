import { describe, expect, test } from 'bun:test'
import {
  alternatesFromGroup,
  groupByTranslationKey,
  relatedByTags,
  sortNewestFirst,
  type PostRef,
} from './helpers'
import { blogIndexPath, blogPath, rssPath } from './paths'

const post = (over: Partial<PostRef> & { slug: string }): PostRef => ({
  locale: 'en',
  date: '2026-07-01',
  tags: ['fdm'],
  translationKey: over.slug,
  ...over,
})

describe('blog paths', () => {
  test('use the localized section words', () => {
    expect(blogIndexPath('pl')).toBe('/pl/baza-wiedzy')
    expect(blogIndexPath('en')).toBe('/en/blog')
    expect(blogPath('pl', 'tolerancje-fdm')).toBe(
      '/pl/baza-wiedzy/tolerancje-fdm',
    )
    expect(rssPath('en')).toBe('/en/blog/rss.xml')
  })
})

describe('sortNewestFirst', () => {
  test('newest first, slug tie-break', () => {
    const sorted = sortNewestFirst([
      post({ slug: 'b', date: '2026-01-01' }),
      post({ slug: 'c', date: '2026-03-01' }),
      post({ slug: 'a', date: '2026-01-01' }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['c', 'a', 'b'])
  })
})

describe('translation pairing', () => {
  test('groups by key and derives partial alternates', () => {
    const groups = groupByTranslationKey([
      post({ slug: 'fdm-tolerances', translationKey: 'tol' }),
      post({ slug: 'tolerancje-fdm', translationKey: 'tol', locale: 'pl' }),
      post({ slug: 'en-only', translationKey: 'solo' }),
    ])
    expect(alternatesFromGroup(groups.get('tol')!)).toEqual({
      en: '/en/blog/fdm-tolerances',
      pl: '/pl/baza-wiedzy/tolerancje-fdm',
    })
    expect(alternatesFromGroup(groups.get('solo')!)).toEqual({
      en: '/en/blog/en-only',
    })
  })
})

describe('relatedByTags', () => {
  const current = post({ slug: 'current', tags: ['fdm', 'tolerances'] })
  test('most shared tags first, then newest, excludes self and unrelated', () => {
    const posts = [
      current,
      post({ slug: 'one-shared-new', date: '2026-06-01', tags: ['fdm'] }),
      post({ slug: 'one-shared-old', date: '2026-01-01', tags: ['fdm'] }),
      post({ slug: 'two-shared', tags: ['fdm', 'tolerances'] }),
      post({ slug: 'unrelated', tags: ['cnc'] }),
    ]
    expect(relatedByTags(posts, current).map((p) => p.slug)).toEqual([
      'two-shared',
      'one-shared-new',
      'one-shared-old',
    ])
  })
  test('caps at max', () => {
    const posts = [1, 2, 3, 4].map((n) =>
      post({ slug: `p${n}`, tags: ['fdm'] }),
    )
    expect(relatedByTags(posts, current, 3)).toHaveLength(3)
  })
})
