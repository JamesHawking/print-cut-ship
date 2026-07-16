// SEO head plumbing (seo_prompts/01, feeds Plans/13): canonical origin,
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

/** rel=alternate for every locale plus x-default (→ the default locale). */
export function hreflangLinks(pathname: string) {
  return [
    ...LOCALES.map((locale) => ({
      rel: 'alternate',
      hrefLang: locale,
      href: `${SITE_URL}${localizedPath(pathname, locale)}`,
    })),
    {
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${SITE_URL}${localizedPath(pathname, DEFAULT_LOCALE)}`,
    },
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
      { property: 'og:type', content: 'website' },
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
    links: [{ rel: 'canonical', href: url }, ...hreflangLinks(path)],
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

type JsonLdSchema = OrganizationSchema | WebSiteSchema | BreadcrumbListSchema

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

/** For later content pages (prompt 02+); pairs with the visual breadcrumb. */
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
