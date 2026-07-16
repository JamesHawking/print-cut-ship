import { describe, expect, test } from 'bun:test'
import {
  breadcrumbJsonLd,
  hreflangLinks,
  jsonLd,
  localizedPath,
  organizationJsonLd,
  seoHead,
  SITE_URL,
  webSiteJsonLd,
} from './seo'

describe('seoHead', () => {
  const head = seoHead({
    locale: 'pl',
    path: '/pl',
    title: 'T',
    description: 'D',
  })

  test('emits title, description, canonical, OG, Twitter, hreflang', () => {
    expect(head.meta).toContainEqual({ title: 'T' })
    expect(head.meta).toContainEqual({ name: 'description', content: 'D' })
    expect(head.meta).toContainEqual({
      property: 'og:url',
      content: `${SITE_URL}/pl`,
    })
    expect(head.meta).toContainEqual({
      property: 'og:image',
      content: `${SITE_URL}/og.png`,
    })
    expect(head.meta).toContainEqual({
      property: 'og:locale',
      content: 'pl_PL',
    })
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: `${SITE_URL}/pl`,
    })
    const hreflangs = head.links.filter((l) => l.rel === 'alternate')
    expect(hreflangs.map((l) => l.hrefLang).sort()).toEqual([
      'en',
      'pl',
      'x-default',
    ])
    // x-default follows the default locale (pl).
    expect(hreflangs.find((l) => l.hrefLang === 'x-default')?.href).toBe(
      `${SITE_URL}/pl`,
    )
    // Every hreflang href is absolute.
    for (const l of hreflangs) expect(l.href.startsWith('https://')).toBe(true)
  })

  test('noindex pages get robots and no canonical/OG/hreflang', () => {
    const app = seoHead({
      locale: 'en',
      path: '/en/login',
      title: 'T',
      description: 'D',
      noindex: true,
    })
    expect(app.meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
    expect(app.links).toEqual([])
    expect(app.meta.some((m) => m.property === 'og:title')).toBe(false)
  })
})

describe('hreflang path swapping', () => {
  test('localizedPath swaps only the locale prefix', () => {
    expect(localizedPath('/pl/quote', 'en')).toBe('/en/quote')
    expect(localizedPath('/please/login', 'en')).toBe('/please/login')
  })
  test('alternates are reciprocal across nested paths', () => {
    const links = hreflangLinks('/en/login')
    expect(links.find((l) => l.hrefLang === 'pl')?.href).toBe(
      `${SITE_URL}/pl/login`,
    )
    expect(links.find((l) => l.hrefLang === 'en')?.href).toBe(
      `${SITE_URL}/en/login`,
    )
  })
})

describe('JSON-LD builders', () => {
  test('jsonLd wraps for the head() script:ld+json meta entry', () => {
    const entry = jsonLd(organizationJsonLd())
    expect(Object.keys(entry)).toEqual(['script:ld+json'])
    expect(entry['script:ld+json']['@type']).toBe('Organization')
  })
  test('webSite carries locale URL and language', () => {
    const site = webSiteJsonLd('en', 'desc')
    expect(site.url).toBe(`${SITE_URL}/en`)
    expect(site.inLanguage).toBe('en')
  })
  test('breadcrumbs are positioned and absolute', () => {
    const bc = breadcrumbJsonLd([
      { name: 'Home', path: '/pl' },
      { name: 'Materials', path: '/pl/materials' },
    ])
    expect(bc.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Materials',
      item: `${SITE_URL}/pl/materials`,
    })
  })
})
