import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkReadingTime from 'remark-reading-time'
import remarkReadingTimeMdx from 'remark-reading-time/mdx'
import rehypeSlug from 'rehype-slug'
import withToc from '@stefanprobst/rehype-extract-toc'
import withTocExport from '@stefanprobst/rehype-extract-toc/mdx'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import matter from 'gray-matter'

// Mirrors src/lib/seo.ts SITE_URL (vite config can't import app code) —
// placeholder origin until the production domain is pinned via env.
const SITE_URL = process.env.VITE_SITE_URL ?? 'https://microfactory.example'

// Indexable public pages: prerendered at build time and listed in
// sitemap.xml with reciprocal hreflang alternates. App screens
// (quote/login/orders) are noindex and deliberately absent. Content sections
// have LOCALIZED slugs, so each entry names its per-locale paths explicitly
// (mirrors src/content/materials/slugs.ts). New content routes go here.
const MATERIAL_SLUGS = ['petg', 'asa', 'pa12-cf']
const COMPARE_SLUGS = [
  'asa-vs-petg',
  'pa-cf-vs-aluminum',
  'print-in-house-vs-order',
]
const localizedPages: Array<{
  paths: { pl: string; en: string }
  priority: number
}> = [
  { paths: { pl: '/pl', en: '/en' }, priority: 1 },
  { paths: { pl: '/pl/materialy', en: '/en/materials' }, priority: 0.8 },
  { paths: { pl: '/pl/cennik', en: '/en/pricing' }, priority: 0.9 },
  ...MATERIAL_SLUGS.map((slug) => ({
    paths: { pl: `/pl/materialy/${slug}`, en: `/en/materials/${slug}` },
    priority: 0.9,
  })),
  { paths: { pl: '/pl/porownanie', en: '/en/compare' }, priority: 0.7 },
  ...COMPARE_SLUGS.map((slug) => ({
    paths: { pl: `/pl/porownanie/${slug}`, en: `/en/compare/${slug}` },
    priority: 0.8,
  })),
  { paths: { pl: '/pl/baza-wiedzy', en: '/en/blog' }, priority: 0.7 },
]

// Blog article pages come from the filesystem, not a hand-mirrored list:
// file name = slug, frontmatter translationKey pairs pl/en counterparts
// (mirrors src/content/blog/registry.ts, which vite.config cannot import).
// A locale may lack a translation — then only the existing locale's entry
// and hreflang links are emitted.
const BLOG_SECTION = { pl: 'baza-wiedzy', en: 'blog' } as const // = SECTIONS.blog
type BlogLocale = keyof typeof BLOG_SECTION
const BLOG_LOCALES = ['pl', 'en'] as const satisfies ReadonlyArray<BlogLocale>
const blogPairs = new Map<string, Partial<Record<BlogLocale, string>>>()
for (const locale of BLOG_LOCALES) {
  const dir = `src/content/blog/${locale}`
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
    const slug = file.replace(/\.mdx$/, '')
    const { translationKey } = matter(readFileSync(`${dir}/${file}`, 'utf8'))
      .data as { translationKey?: string }
    const key = translationKey ?? slug
    blogPairs.set(key, {
      ...blogPairs.get(key),
      [locale]: `/${locale}/${BLOG_SECTION[locale]}/${slug}`,
    })
  }
}
const blogArticlePages = [...blogPairs.values()].flatMap((paths) =>
  BLOG_LOCALES.flatMap((locale) => {
    const path = paths[locale]
    if (path === undefined) return []
    return [
      {
        path,
        prerender: { enabled: true, crawlLinks: false },
        sitemap: {
          priority: 0.7,
          changefreq: 'monthly' as const,
          alternateRefs: [
            ...BLOG_LOCALES.flatMap((l) =>
              paths[l] ? [{ href: `${SITE_URL}${paths[l]}`, hreflang: l }] : [],
            ),
            {
              href: `${SITE_URL}${paths.pl ?? paths.en!}`,
              hreflang: 'x-default',
            },
          ],
        },
      },
    ]
  }),
)

// Per-locale RSS: prerendered (the server route runs at build) but kept out
// of sitemap.xml — feeds are announced via <link rel="alternate"> instead.
// Pages land in the sitemap by default, so the exclusion is explicit.
const rssPages = BLOG_LOCALES.map((locale) => ({
  path: `/${locale}/${BLOG_SECTION[locale]}/rss.xml`,
  prerender: { enabled: true, crawlLinks: false },
  sitemap: { exclude: true },
}))
const publicPages = [
  ...localizedPages.flatMap(({ paths, priority }) =>
    (['pl', 'en'] as const).map((locale) => ({
      path: paths[locale],
      // crawlLinks would drag the linked noindex app screens (login/quote) into
      // the prerender set AND the sitemap — the page list here is explicit.
      prerender: { enabled: true, crawlLinks: false },
      sitemap: {
        priority,
        changefreq: 'weekly' as const,
        alternateRefs: [
          { href: `${SITE_URL}${paths.pl}`, hreflang: 'pl' },
          { href: `${SITE_URL}${paths.en}`, hreflang: 'en' },
          { href: `${SITE_URL}${paths.pl}`, hreflang: 'x-default' },
        ],
      },
    })),
  ),
  ...blogArticlePages,
  ...rssPages,
]

const config = defineConfig({
  // tsconfigPaths resolves @/ for TS/TSX only — the explicit alias extends
  // it to .mdx modules (articles import diagram components via @/).
  resolve: {
    tsconfigPaths: true,
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    devtools(),
    // The Go backend owns /api (see ../backend); Nitro handles requests
    // ahead of Vite's own proxy, so the forwarding lives in its routeRules.
    // Works in dev and as a production fallback — though in production the
    // reverse proxy should route /api to the Go service directly.
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        '/api/**': {
          proxy: `${process.env.API_PROXY ?? 'http://localhost:8080'}/api/**`,
        },
      },
    }),
    tailwindcss(),
    // Blog articles (src/content/blog): MDX → JSX ahead of the React plugin
    // (enforce: 'pre'). The remark/rehype chain attaches per-module exports
    // the registry consumes: frontmatter, readingTime, tableOfContents.
    {
      enforce: 'pre' as const,
      ...mdx({
        remarkPlugins: [
          remarkFrontmatter,
          remarkMdxFrontmatter,
          remarkGfm,
          remarkReadingTime,
          remarkReadingTimeMdx,
        ],
        rehypePlugins: [
          rehypeSlug,
          withToc,
          withTocExport,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
        ],
      }),
    },
    tanstackStart({
      sitemap: { enabled: true, host: SITE_URL },
      pages: publicPages,
    }),
    // The include pattern opts .mdx modules into React Fast Refresh.
    viteReact({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
  ],
})

export default config
