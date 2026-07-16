import { useEffect, useState } from 'react'
import { formatWarsawClock } from '@/lib/clock'

/**
 * Live Warsaw wall clock, client-mounted only: SSR and prerendered HTML show
 * a stable placeholder so the markup never carries a render-time clock that
 * mismatches on hydration.
 */
export function useWarsawClock(intervalMs = 60_000): string {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now ? formatWarsawClock(now) : '--:--'
}
