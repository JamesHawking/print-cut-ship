// SEO head plumbing (plans/seo/01, feeds plans/engineering/13): canonical origin,
// per-page meta/OG/Twitter, hreflang alternates, and JSON-LD builders.
// Routes call seoHead()/jsonLd() from their head() option; TanStack merges
// deepest-match-wins for title/named meta and concatenates links.

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n'

/**
 * Canonical origin for absolute URLs (canonical, hreflang, sitemap, OG,
 * JSON-LD). Placeholder until the production domain is purchased — set the
 * real origin via VITE_SITE_URL (Coolify env / .env).
 */
export const SITE_URL: string =
  import.meta.env.VITE_SITE_URL ?? 'https://microfactory.example'

export const SITE_NAME = 'MICRO_FACTORY'

const OG_LOCALE: Record<Locale, string> = { pl: 'pl_PL', en: 'en_GB' }

/** Swaps the /pl|/en prefix of an app pathname. */
export function localizedPath(pathname: string, locale: Locale): string {
  return pathname.replace(/^\/(pl|en)(?=\/|$)/, `/${locale}`)
}

/**
 * rel=alternate for every locale plus x-default (→ the default locale).
 * Pages with localized slugs (e.g. /pl/materialy vs /en/materials) pass
 * explicit per-locale `alternates`; otherwise the /pl|/en prefix is swapped.
 * An explicit alternates object may be PARTIAL (blog article without a
 * translation): only the locales present are emitted — never an hreflang
 * link to a 404 — and x-default falls back to whichever exists.
 */
export function hreflangLinks(
  pathname: string,
  alternates?: Partial<Record<Locale, string>>,
) {
  const locales = alternates
    ? LOCALES.filter((locale) => alternates[locale] !== undefined)
    : LOCALES
  const pathFor = (locale: Locale) =>
    alternates?.[locale] ?? localizedPath(pathname, locale)
  const xDefault = locales.includes(DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : locales[0]
  return [
    ...locales.map((locale) => ({
      rel: 'alternate',
      hrefLang: locale,
      href: `${SITE_URL}${pathFor(locale)}`,
    })),
    ...(xDefault !== undefined
      ? [
          {
            rel: 'alternate',
            hrefLang: 'x-default',
            href: `${SITE_URL}${pathFor(xDefault)}`,
          },
        ]
      : []),
  ]
}

export interface SeoOptions {
  locale: Locale
  /** Full pathname including the locale prefix, e.g. `/pl/login`. */
  path: string
  title: string
  description: string
  /** Absolute or site-relative OG image; defaults to the branded card. */
  image?: string
  /**
   * Explicit per-locale paths for localized slugs (hreflang + x-default).
   * May be partial when the page has no counterpart in some locale.
   */
  alternates?: Partial<Record<Locale, string>>
  /** og:type; editorial pages (blog articles) pass 'article'. */
  type?: 'website' | 'article'
  /** Transactional app screens: emit robots noindex, skip canonical/OG/hreflang. */
  noindex?: boolean
}

/**
 * One head() fragment per page: title, description, canonical, OG, Twitter,
 * hreflang. Later prompts pass {title, description, path, locale, image?}
 * and get everything.
 */
export function seoHead({
  locale,
  path: rawPath,
  title,
  description,
  image = '/og.png',
  alternates,
  type = 'website',
  noindex,
}: SeoOptions): {
  meta: Array<Record<string, string>>
  links: Array<Record<string, string>>
} {
  // Index-route match.pathname carries a trailing slash — normalize so
  // canonical/OG/hreflang/sitemap all agree on the slashless form.
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
  if (noindex) {
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      links: [],
    }
  }
  const url = `${SITE_URL}${path}`
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: OG_LOCALE[locale] },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...hreflangLinks(path, alternates),
    ],
  }
}

// ------------------------------------------------------------------ JSON-LD
// Minimal local shapes for the schemas we emit — three interfaces don't
// justify a schema-dts dependency. TanStack head() natively renders a meta
// entry keyed 'script:ld+json' as <script type="application/ld+json">.

interface OrganizationSchema {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo: string
}

interface WebSiteSchema {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  url: string
  description: string
  inLanguage: string
}

export interface BreadcrumbItem {
  name: string
  /** Site-relative path, e.g. `/pl/materials`. */
  path: string
}

interface BreadcrumbListSchema {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

interface ProductSchema {
  '@context': 'https://schema.org'
  '@type': 'Product'
  name: string
  description: string
  image: string
  brand: { '@type': 'Brand'; name: string }
  offers: {
    '@type': 'Offer'
    price: number
    priceCurrency: 'PLN'
    availability: 'https://schema.org/InStock'
    url: string
  }
}

interface ArticleSchema {
  '@context': 'https://schema.org'
  '@type': 'Article'
  headline: string
  description: string
  inLanguage: string
  /** ISO dates, static in content data so prerender stays deterministic. */
  datePublished: string
  dateModified: string
  mainEntityOfPage: string
  image: string
  author: { '@type': 'Organization'; name: string }
  publisher: {
    '@type': 'Organization'
    name: string
    logo: { '@type': 'ImageObject'; url: string }
  }
}

interface FAQPageSchema {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: { '@type': 'Answer'; text: string }
  }>
}

type JsonLdSchema =
  | OrganizationSchema
  | WebSiteSchema
  | BreadcrumbListSchema
  | ProductSchema
  | ArticleSchema
  | FAQPageSchema

/** Wraps a schema for a head() meta array entry. */
export function jsonLd(schema: JsonLdSchema): Record<string, JsonLdSchema> {
  return { 'script:ld+json': schema }
}

export function organizationJsonLd(): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo512.png`,
  }
}

export function webSiteJsonLd(
  locale: Locale,
  description: string,
): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    description,
    inLanguage: locale,
  }
}

/**
 * Material landing pages: the service offering as a Product with a live
 * engine price (gross PLN, the qty-1 bracket reference part).
 */
export function productJsonLd(opts: {
  name: string
  description: string
  path: string
  pricePln: number
  image?: string
}): ProductSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    image: `${SITE_URL}${opts.image ?? '/og.png'}`,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      price: opts.pricePln,
      priceCurrency: 'PLN',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}${opts.path}`,
    },
  }
}

/**
 * Comparison landing pages: editorial content, so Article rather than an
 * offer. Dates come from the page's content data (COMPARE_DATES).
 */
export function articleJsonLd(opts: {
  headline: string
  description: string
  path: string
  locale: Locale
  datePublished: string
  dateModified: string
  image?: string
}): ArticleSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    inLanguage: opts.locale,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
    image: `${SITE_URL}${opts.image ?? '/og.png'}`,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo512.png` },
    },
  }
}

export function faqPageJsonLd(
  faq: Array<{ q: string; a: string }>,
): FAQPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

/** Pairs with the visual breadcrumb on content pages. */
export function breadcrumbJsonLd(
  items: BreadcrumbItem[],
): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}
