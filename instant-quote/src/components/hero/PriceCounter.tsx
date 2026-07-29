import { useEffect, useRef, useState } from 'react'
import { COUNT_UP_MS, countUpValue } from '@/lib/count-up'
import { formatPln } from '@/lib/format'
import { useLocale } from '@/lib/i18n'

/**
 * The hero's price, counted rather than swapped (Mobile Audit 5b). A leaf on
 * purpose: it re-renders once per frame while a count runs, and the rest of
 * the hero must not.
 *
 * The count rolls from whatever was on screen — the demo price becomes the
 * visitor's price without passing back through zero — except on an explicit
 * replay, where restarting from zero is the whole point of the button. Under
 * prefers-reduced-motion it snaps.
 */
export function PriceCounter({
  value,
  runKey,
  className,
}: {
  value: number
  /** Changes whenever the chamber starts showing something new. */
  runKey: string
  className?: string
}) {
  const locale = useLocale()
  // First paint (including prerender) is the final number: a landing that
  // hydrated mid-count would publish a price that isn't the price.
  const [shown, setShown] = useState(value)
  const displayed = useRef(value)
  displayed.current = shown

  useEffect(() => {
    const from = displayed.current === value ? 0 : displayed.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || from === value) {
      setShown(value)
      return
    }
    // performance.now() deltas, not a frame counter: a tab that is
    // backgrounded mid-count resumes at the right place instead of finishing
    // the run in slow motion.
    const start = performance.now()
    let raf = requestAnimationFrame(function tick() {
      const elapsed = performance.now() - start
      setShown(countUpValue(from, value, elapsed))
      if (elapsed < COUNT_UP_MS) raf = requestAnimationFrame(tick)
    })
    // Backstop on a timer, which fires where rAF does not (a backgrounded or
    // throttled tab). Without it a frozen animation frame leaves the previous
    // part's price on screen indefinitely — the one number on this page that
    // must never be stale.
    const settle = setTimeout(() => setShown(value), COUNT_UP_MS + 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [value, runKey])

  return <span className={className}>{formatPln(shown, locale)}</span>
}
