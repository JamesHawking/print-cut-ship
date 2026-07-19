import { useEffect, useState } from 'react'
import { formatWarsawClock } from '@/lib/clock'

/**
 * Live Warsaw wall clock, client-mounted only: SSR and prerendered HTML get
 * null so consumers can render a deliberately dimmed placeholder slot instead
 * of a render-time clock that mismatches on hydration.
 */
export function useWarsawClock(intervalMs = 60_000): string | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now ? formatWarsawClock(now) : null
}
