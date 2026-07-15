// Shared queries against the Go backend: the pricing catalog (static per
// deploy) and live ship-date estimates (Warsaw cutoff clock).

import { useQuery } from '@tanstack/react-query'
import { api, type Catalog, type ShipDate } from '@/lib/api/client'

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
