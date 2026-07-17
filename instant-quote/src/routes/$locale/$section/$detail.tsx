import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { MaterialPage } from '@/components/materials/MaterialPage'
import { ComparePage } from '@/components/compare/ComparePage'
import { BlogArticle } from '@/components/blog/BlogArticle'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  type Locale,
} from '@/lib/i18n'
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLd,
  productJsonLd,
  seoHead,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo'
import { sectionKeyFor } from '@/content/sections'
import { materialsCopy } from '@/content/materials/copy'
import { referenceUnitPrice } from '@/content/materials/prices'
import {
  isMaterialSlug,
  materialAlternates,
  materialIdForSlug,
  materialPath,
  materialsIndexPath,
  type MaterialSlug,
} from '@/content/materials/slugs'
import { compareCopy } from '@/content/compare/copy'
import { COMPARE_DATES } from '@/content/compare/data'
import { compareFaq } from '@/content/compare/faq'
import {
  compareAlternates,
  compareIndexPath,
  comparePath,
  isCompareSlug,
  type CompareSlug,
} from '@/content/compare/slugs'
import { MATERIALS } from '@/lib/catalog-static'
import { blogIndexPath, blogPath, rssPath } from '@/content/blog/paths'
import {
  blogAlternatesFor,
  counterpartRedirectPath,
  getBlogPost,
  isBlogSlug,
} from '@/content/blog/registry'

// The one dynamic child of $section (TanStack allows a single param segment
// per directory), shared by every section with detail pages. Branches on the
// section key: materials → MaterialPage, compare → ComparePage.
export const Route = createFileRoute('/$locale/$section/$detail')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) return // $locale layout redirects
    switch (sectionKeyFor(params.locale, params.section)) {
      case 'materials':
        if (!isMaterialSlug(params.detail)) throw notFound()
        return
      case 'compare':
        if (!isCompareSlug(params.detail)) throw notFound()
        return
      case 'blog': {
        if (isBlogSlug(params.locale, params.detail)) return
        // Article slugs are localized, so the LocaleSwitcher (which swaps
        // only the locale param) lands on the other locale's slug — send it
        // to the translation. No translation → 404, never a silent fallback.
        const to = counterpartRedirectPath(params.locale, params.detail)
        if (to !== null) throw redirect({ href: to, replace: true })
        throw notFound()
      }
      default:
        // Sections without detail pages (/pl/cennik/x 404s).
        throw notFound()
    }
  },
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const key = sectionKeyFor(locale, params.section)
    if (key === 'materials' && isMaterialSlug(params.detail)) {
      return materialHead(locale, params.detail)
    }
    if (key === 'compare' && isCompareSlug(params.detail)) {
      return compareHead(locale, params.detail)
    }
    if (key === 'blog') {
      return blogArticleHead(locale, params.detail)
    }
    return {}
  },
  component: DetailRoute,
})

function materialHead(locale: Locale, slug: MaterialSlug) {
  const id = materialIdForSlug(slug)
  const copy = materialsCopy(locale)[id]
  const label = MATERIALS.find((m) => m.id === id)!.label
  const s = getStrings(locale).materialsPages
  const path = materialPath(locale, slug)

  const head = seoHead({
    locale,
    path,
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: materialAlternates(slug),
  })
  return {
    meta: [
      ...head.meta,
      // Offer price: the qty-1 bracket reference part (engine-generated).
      jsonLd(
        productJsonLd({
          name: copy.h1,
          description: copy.metaDescription,
          path,
          pricePln: referenceUnitPrice(id, 'bracket', 1),
        }),
      ),
      jsonLd(faqPageJsonLd(copy.faq)),
      jsonLd(
        breadcrumbJsonLd([
          { name: s.breadcrumbHome, path: `/${locale}` },
          { name: s.breadcrumbMaterials, path: materialsIndexPath(locale) },
          { name: label, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

// Editorial page: Article (not Product) + FAQPage + BreadcrumbList.
function compareHead(locale: Locale, slug: CompareSlug) {
  const copy = compareCopy(locale)[slug]
  const s = getStrings(locale)
  const path = comparePath(locale, slug)

  const head = seoHead({
    locale,
    path,
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: compareAlternates(slug),
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(
        articleJsonLd({
          headline: copy.h1,
          description: copy.metaDescription,
          path,
          locale,
          datePublished: COMPARE_DATES[slug].datePublished,
          dateModified: COMPARE_DATES[slug].dateModified,
        }),
      ),
      jsonLd(faqPageJsonLd(compareFaq(locale, slug))),
      jsonLd(
        breadcrumbJsonLd([
          { name: s.materialsPages.breadcrumbHome, path: `/${locale}` },
          { name: s.comparePages.breadcrumb, path: compareIndexPath(locale) },
          { name: copy.title, path },
        ]),
      ),
    ],
    links: head.links,
  }
}

// Article (not Product) + BreadcrumbList; FAQ-less, unlike compare pages.
// The rel=alternate RSS link mirrors the blog index head.
function blogArticleHead(locale: Locale, slug: string) {
  const post = getBlogPost(locale, slug)
  if (!post) return {}
  const strings = getStrings(locale)
  const s = strings.blogPages
  const path = blogPath(locale, slug)

  const head = seoHead({
    locale,
    path,
    title: `${post.fm.title} | ${SITE_NAME}`,
    description: post.fm.description,
    // Partial when untranslated: only existing locales get hreflang links.
    alternates: blogAlternatesFor(locale, slug),
    type: 'article',
  })
  return {
    meta: [
      ...head.meta,
      jsonLd(
        articleJsonLd({
          headline: post.fm.title,
          description: post.fm.description,
          path,
          locale,
          datePublished: post.fm.date,
          dateModified: post.fm.updated ?? post.fm.date,
        }),
      ),
      jsonLd(
        breadcrumbJsonLd([
          { name: strings.materialsPages.breadcrumbHome, path: `/${locale}` },
          { name: s.breadcrumb, path: blogIndexPath(locale) },
          { name: post.fm.title, path },
        ]),
      ),
    ],
    links: [
      ...head.links,
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: s.rssTitle,
        href: `${SITE_URL}${rssPath(locale)}`,
      },
    ],
  }
}

function DetailRoute() {
  const locale = useLocale()
  const { section, detail } = Route.useParams()
  // Blog slugs are per-locale files, not a closed union — branch on the
  // section key; materials/compare keep their slug-guard branches.
  if (sectionKeyFor(locale, section) === 'blog') {
    return <BlogArticle slug={detail} />
  }
  if (isMaterialSlug(detail)) return <MaterialPage slug={detail} />
  if (isCompareSlug(detail)) return <ComparePage slug={detail} />
  return null
}
