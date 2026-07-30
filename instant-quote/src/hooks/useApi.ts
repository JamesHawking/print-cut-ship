// Shared queries against the Go backend: the pricing catalog (static per
// deploy) and live ship-date estimates (Warsaw cutoff clock).

import { useQuery } from '@tanstack/react-query'
import {
  api,
  pricePartKey,
  toApiMetrics,
  toPricePart,
  type Catalog,
  type PartQuote,
  type ShipDate,
} from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { DEMO_PARTS, SAMPLE_METRICS } from '@/components/how-it-works/demo'
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
 * The landing demo's real engine call — the same request the quote page would
 * send, for all three sample parts at once (the price contract caps 5). One
 * cache key for the whole page, so hero, intake and ladder fire a single
 * request. Per-part pricing is independent (order-level fees live on
 * OrderTotals, not PartQuote), so parts[0] is byte-identical to what a
 * bracket-only request returns — verified against the engine 2026-07-27.
 */
function useDemoPriceQuery() {
  return useQuery({
    queryKey: ['demo-price'],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: DEMO_PARTS.map((d) => ({
            metrics: toApiMetrics(d.metrics),
            ...d.config,
          })),
        },
      })
      if (!res.data) throw new Error('demo price fetch failed')
      return res.data
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

/**
 * The demo bracket's quote (DEMO_PARTS[0]) — the price ladder's header
 * figures and the hero's default. Client-mounted only (React Query never
 * fetches during prerender): callers fall back to FALLBACK_QUOTE.
 */
export function useDemoPrice(): PartQuote | undefined {
  return useDemoPriceQuery().data?.parts[0]
}

/** All three demo quotes, in DEMO_PARTS order — the intake's Demo tab. */
export function useDemoPrices(): PartQuote[] | undefined {
  return useDemoPriceQuery().data?.parts
}

/**
 * Live quote for one user part (the hero's inline quote). The query key is
 * byte-identical to the single-part shape quote.tsx builds, so the quote page
 * renders from cache with zero refetch after the hero auto-navigates — both
 * sides go through pricePartKey/toPricePart so they cannot drift apart.
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
      ready ? [pricePartKey({ hash: part.hash!, config: part.config })] : [],
    ],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price', {
        body: {
          parts: [
            toPricePart({ metrics: part!.metrics!, config: part!.config }),
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

/**
 * One real part re-quoted in every material, at its current configuration.
 * Both the materials bench and the config panel's material dropdown read this
 * — one query key, so the deltas in the dropdown and the rows in the bench are
 * the same numbers from the same request.
 */
export function usePartCompare(part: (Part & { hash: string }) | null) {
  return useQuery({
    queryKey: [
      'price-compare',
      part && pricePartKey({ hash: part.hash, config: part.config }),
    ],
    queryFn: async () => {
      const res = await api.POST('/api/v1/price/compare', {
        body: {
          metrics: toApiMetrics(part!.metrics!),
          quantity: part!.config.quantity,
          leadTime: part!.config.leadTime,
          nozzle: part!.config.nozzle,
          infill: part!.config.infill,
          color: part!.config.color,
        },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    enabled: !!part && !!part.metrics,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
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
