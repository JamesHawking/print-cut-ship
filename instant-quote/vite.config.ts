import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Mirrors src/lib/seo.ts SITE_URL (vite config can't import app code) —
// placeholder origin until the production domain is pinned via env.
const SITE_URL = process.env.VITE_SITE_URL ?? 'https://microfactory.example'

// Indexable public pages: prerendered at build time and listed in
// sitemap.xml with reciprocal hreflang alternates. App screens
// (quote/login/orders) are noindex and deliberately absent. Content sections
// have LOCALIZED slugs, so each entry names its per-locale paths explicitly
// (mirrors src/content/materials/slugs.ts). New content routes go here.
const MATERIAL_SLUGS = ['petg', 'asa', 'pa12-cf']
const localizedPages: Array<{
  paths: { pl: string; en: string }
  priority: number
}> = [
  { paths: { pl: '/pl', en: '/en' }, priority: 1 },
  { paths: { pl: '/pl/materialy', en: '/en/materials' }, priority: 0.8 },
  ...MATERIAL_SLUGS.map((slug) => ({
    paths: { pl: `/pl/materialy/${slug}`, en: `/en/materials/${slug}` },
    priority: 0.9,
  })),
]
const publicPages = localizedPages.flatMap(({ paths, priority }) =>
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
)

const config = defineConfig({
  resolve: { tsconfigPaths: true },
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
    tanstackStart({
      sitemap: { enabled: true, host: SITE_URL },
      pages: publicPages,
    }),
    viteReact(),
  ],
})

export default config
