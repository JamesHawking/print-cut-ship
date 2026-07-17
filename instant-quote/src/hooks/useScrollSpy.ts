import { useEffect, useState } from 'react'

/** First id in `ids` (document) order that is intersecting, else null. */
export function pickActiveSection(
  ids: readonly string[],
  intersecting: ReadonlySet<string>,
): string | null {
  for (const id of ids) {
    if (intersecting.has(id)) return id
  }
  return null
}

/**
 * Which of the given page sections is currently in view. Client-only: starts
 * null (so prerendered HTML is unchanged) and observes after mount. The
 * activation band is the upper-middle of the viewport, below the 56px sticky
 * header. Pass a module-scope `ids` array — a fresh literal per render would
 * re-create the observer every render.
 */
export function useScrollSpy(
  ids: readonly string[],
  enabled: boolean,
): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') {
      setActive(null)
      return
    }
    const intersecting = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id)
          else intersecting.delete(entry.target.id)
        }
        setActive(pickActiveSection(ids, intersecting))
      },
      { rootMargin: '-15% 0px -55% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids, enabled])

  return active
}
