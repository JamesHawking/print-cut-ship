// Shared queries against the Go backend: the pricing catalog (static per
// deploy) and live ship-date estimates (Warsaw cutoff clock).

import { useQuery } from '@tanstack/react-query'
import {
  api,
  toApiMetrics,
  type Catalog,
  type PartQuote,
  type ShipDate,
} from '@/lib/api/client'
import { DEMO_CONFIG, SAMPLE_METRICS } from '@/components/how-it-works/demo'

export function useCatalog(): Catalog | undefined {
  const { data } = useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/config')
      if (!res.data) throw new Error('config fetch failed')
      return res.data
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })
  return data
}

/**
 * The landing demo's real engine call — same request the quote page would
 * send for the sample bracket. Shared by Hero and HowItWorks via one cache
 * key, so the page fires a single request. Client-mounted only (React Query
 * never fetches during prerender): callers fall back to FALLBACK_QUOTE.
 */
export function useDemoPrice(): PartQuote | undefined {
  const { data } = useQuery({
    queryKey: ['demo-price'],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: [{ metrics: toApiMetrics(SAMPLE_METRICS), ...DEMO_CONFIG }],
        },
      })
      if (!res.data) throw new Error('demo price fetch failed')
      return res.data
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
  return data?.parts[0]
}

/** Ship dates per lead time, refreshed every minute (cutoff can flip). */
export function useShipDates(): ShipDate[] | undefined {
  const { data } = useQuery({
    queryKey: ['ship-dates'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/ship-dates')
      if (!res.data) throw new Error('ship-dates fetch failed')
      return res.data.shipDates
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  })
  return data
}
