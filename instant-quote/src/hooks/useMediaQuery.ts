import { useEffect, useState } from 'react'

/**
 * matchMedia as state. Deliberately useState(initial) + effect sync rather
 * than useSyncExternalStore: the first client render must match SSR, and any
 * post-hydration flip lands in the same effect pass that would arm lazy
 * consumers (e.g. the three.js chunk), so the wrong branch never loads.
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
