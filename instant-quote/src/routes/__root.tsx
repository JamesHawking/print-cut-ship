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
import '@fontsource-variable/archivo'
import '@fontsource-variable/martian-mono'

import appCss from '../styles.css?url'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'

// Localized title/description/hreflang live on the $locale layout route.
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
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
