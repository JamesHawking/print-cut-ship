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
import { ApiRequestError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { DEMO_CONFIG, SAMPLE_METRICS } from '@/components/how-it-works/demo'
import type { Part } from '@/hooks/useParts'

export type PriceCompareRow = components['schemas']['PriceCompareRow']

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
 * send for the sample bracket. Shared by the hero and the price ladder via
 * one cache key, so the page fires a single request. Client-mounted only
 * (React Query never fetches during prerender): callers fall back to
 * FALLBACK_QUOTE.
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

/**
 * Live quote for one user part (the hero's inline quote). The query key is
 * byte-identical to the single-part shape quote.tsx builds
 * (['price', [[hash, process, quantity, leadTime]]]), so the quote page
 * renders from cache with zero refetch after the hero auto-navigates —
 * change one side only in lockstep with the other.
 */
export function usePartPrice(part: Part | undefined): {
  quote: PartQuote | undefined
  isError: boolean
} {
  const ready =
    !!part && part.status === 'ready' && !!part.hash && !!part.metrics
  const { data, isError } = useQuery({
    queryKey: [
      'price',
      ready
        ? [
            [
              part.hash,
              part.config.process,
              part.config.quantity,
              part.config.leadTime,
            ],
          ]
        : [],
    ],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: [
            {
              metrics: toApiMetrics(part!.metrics!),
              process: part!.config.process,
              quantity: part!.config.quantity,
              leadTime: part!.config.leadTime,
            },
          ],
        },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    enabled: ready,
    staleTime: Infinity,
    retry: 1,
  })
  return { quote: data?.parts[0], isError }
}

/**
 * The demo bracket re-quoted in every material — one POST /api/v1/price/compare
 * returns a row per process in catalog order (the price ladder's data source).
 */
export function usePriceCompare(): PriceCompareRow[] | undefined {
  const { data } = useQuery({
    queryKey: ['price-compare-demo'],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price/compare', {
        body: {
          metrics: toApiMetrics(SAMPLE_METRICS),
          quantity: 1,
          leadTime: 'standard',
        },
      })
      if (!res.data) throw new Error('price compare fetch failed')
      return res.data.rows
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
  return data
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
