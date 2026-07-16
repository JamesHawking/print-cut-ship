import { useState } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useParams,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { PartsProvider } from '@/hooks/useParts'

// Type system (Anduril-inspired): Archivo grotesque for display/UI, Martian Mono
// for technical labels & numerics. Self-hosted via @fontsource (no external CDN).
// The latin variable files are also preloaded below — @font-face alone defers
// discovery until CSS parses, costing LCP.
import '@fontsource-variable/archivo'
import '@fontsource-variable/martian-mono'
import archivoWoff2 from '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url'
import martianMonoWoff2 from '@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2?url'

import appCss from '../styles.css?url'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'

// Localized per-page meta lives on the $locale routes (seoHead); the root
// supplies globals plus a brand-token title fallback so no document — error
// states included — ever renders titleless.
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'MICRO_FACTORY' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      ...[archivoWoff2, martianMonoWoff2].map((href) => ({
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous' as const,
        href,
      })),
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
        },
      }),
  )

  const { locale } = useParams({ strict: false })

  return (
    <html lang={locale && isLocale(locale) ? locale : DEFAULT_LOCALE}>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <QueryClientProvider client={queryClient}>
          <PartsProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </PartsProvider>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
