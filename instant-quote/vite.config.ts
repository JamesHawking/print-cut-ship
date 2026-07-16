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
// (quote/login/orders) are noindex and deliberately absent. Later prompts
// append their content routes here.
const alternateRefs = (path: string) => [
  { href: `${SITE_URL}/pl${path}`, hreflang: 'pl' },
  { href: `${SITE_URL}/en${path}`, hreflang: 'en' },
  { href: `${SITE_URL}/pl${path}`, hreflang: 'x-default' },
]
const publicPages = ['/pl', '/en'].map((localeRoot) => ({
  path: localeRoot,
  // crawlLinks would drag the linked noindex app screens (login/quote) into
  // the prerender set AND the sitemap — the page list here is explicit.
  prerender: { enabled: true, crawlLinks: false },
  sitemap: {
    priority: 1,
    changefreq: 'weekly' as const,
    alternateRefs: alternateRefs(''),
  },
}))

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
