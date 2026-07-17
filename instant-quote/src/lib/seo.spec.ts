import { describe, expect, test } from 'bun:test'
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  hreflangLinks,
  jsonLd,
  localizedPath,
  organizationJsonLd,
  productJsonLd,
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

describe('localized-slug alternates', () => {
  test('explicit alternates override the prefix swap', () => {
    const links = hreflangLinks('/pl/materialy/asa', {
      pl: '/pl/materialy/asa',
      en: '/en/materials/asa',
    })
    expect(links.find((l) => l.hrefLang === 'en')?.href).toBe(
      `${SITE_URL}/en/materials/asa`,
    )
    expect(links.find((l) => l.hrefLang === 'x-default')?.href).toBe(
      `${SITE_URL}/pl/materialy/asa`,
    )
  })
  test('partial alternates emit only present locales', () => {
    // Blog article without a translation: no hreflang link to a 404.
    const links = hreflangLinks('/en/blog/en-only', { en: '/en/blog/en-only' })
    expect(links.map((l) => l.hrefLang).sort()).toEqual(['en', 'x-default'])
    // x-default falls back to the only existing locale.
    expect(links.find((l) => l.hrefLang === 'x-default')?.href).toBe(
      `${SITE_URL}/en/blog/en-only`,
    )
  })
  test('og:type defaults to website, articles override', () => {
    const base = seoHead({
      locale: 'en',
      path: '/en',
      title: 'T',
      description: 'D',
    })
    expect(base.meta).toContainEqual({
      property: 'og:type',
      content: 'website',
    })
    const article = seoHead({
      locale: 'en',
      path: '/en/blog/x',
      title: 'T',
      description: 'D',
      type: 'article',
    })
    expect(article.meta).toContainEqual({
      property: 'og:type',
      content: 'article',
    })
  })
  test('seoHead threads alternates through', () => {
    const head = seoHead({
      locale: 'en',
      path: '/en/materials/asa',
      title: 'T',
      description: 'D',
      alternates: { pl: '/pl/materialy/asa', en: '/en/materials/asa' },
    })
    const pl = head.links.find(
      (l) => l.rel === 'alternate' && l.hrefLang === 'pl',
    )
    expect(pl?.href).toBe(`${SITE_URL}/pl/materialy/asa`)
    expect(head.links.find((l) => l.rel === 'canonical')?.href).toBe(
      `${SITE_URL}/en/materials/asa`,
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
  test('product carries a PLN offer at the page URL', () => {
    const p = productJsonLd({
      name: 'ASA 3D printing',
      description: 'd',
      path: '/en/materials/asa',
      pricePln: 6.2,
    })
    expect(p.offers).toEqual({
      '@type': 'Offer',
      price: 6.2,
      priceCurrency: 'PLN',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/en/materials/asa`,
    })
  })
  test('faqPage maps q/a pairs', () => {
    const f = faqPageJsonLd([{ q: 'Q1?', a: 'A1.' }])
    expect(f.mainEntity[0].name).toBe('Q1?')
    expect(f.mainEntity[0].acceptedAnswer.text).toBe('A1.')
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
