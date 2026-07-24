import { useEffect, useRef, useState } from 'react'

/**
 * One-shot "came into view" flag for entrance choreography. SSR/hydration-safe
 * by construction: the initial state is REVEALED,
 * so prerendered HTML ships the settled state and hydration never mismatches;
 * the hide-then-replay divergence happens in an effect, on the client only.
 * Reduced-motion visitors (and no-IO environments) keep the revealed state.
 */
export function useOnceInView<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.2,
) {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(true)
  const playedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined' ||
      !el
    )
      return
    setRevealed(false)
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || playedRef.current) return
        playedRef.current = true
        io.disconnect()
        setRevealed(true)
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, revealed }
}
