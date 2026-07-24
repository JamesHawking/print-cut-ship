import { useEffect, useRef } from 'react'
import type { PartQuote } from '@/lib/api/client'
import { track } from '@/lib/funnel'
import { usePartPrice } from './useApi'
import { useParts } from './useParts'

/** What the hero's dark chamber renders. */
export type HeroLiveState =
  | { kind: 'demo' }
  | { kind: 'measuring'; fileName: string }
  | { kind: 'quoted'; fileName: string; process: string; quote: PartQuote }

/** Dwell before auto-navigating: long enough for the price-flash payoff to
 *  land; with reduced motion there is no flash, only a beat to read it. */
const DWELL_MS = 2000
const DWELL_REDUCED_MS = 300

/**
 * Inline live quote for the hero (design 17b): a single file dropped on the
 * landing is measured and priced right in the dark chamber, then the quote
 * editor opens automatically. Parse failures hand control back to the
 * landing (`onFailed` — the intake toast has already explained); price-API
 * failures skip the payoff and navigate at once (`onDone` — the quote page
 * owns retry UX).
 */
export function useHeroLiveQuote({
  livePartId,
  onDone,
  onFailed,
}: {
  livePartId: string | null
  onDone: () => void
  onFailed: () => void
}): HeroLiveState {
  const { parts } = useParts()
  const part = livePartId ? parts.find((p) => p.id === livePartId) : undefined
  const { quote, isError } = usePartPrice(part)
  const failed = part?.status === 'error'

  // Callbacks via refs so the dwell effect's deps stay primitive — a parts
  // re-render (e.g. the background upload flipping to 'stored') must neither
  // cancel nor restart the running timer.
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const failedRef = useRef(onFailed)
  failedRef.current = onFailed

  const quoted = !!quote && !failed
  useEffect(() => {
    if (!livePartId) return
    if (failed) {
      failedRef.current()
      return
    }
    if (isError) {
      doneRef.current()
      return
    }
    if (!quoted) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => doneRef.current(),
      reduced ? DWELL_REDUCED_MS : DWELL_MS,
    )
    return () => window.clearTimeout(timer)
  }, [livePartId, quoted, failed, isError])

  // Funnel: once per live part, when its quote first lands.
  const firedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!livePartId || !quoted || firedFor.current === livePartId) return
    firedFor.current = livePartId
    track('hero_live_quote_shown', { fileName: part?.fileName })
  }, [livePartId, quoted, part?.fileName])

  if (!part || failed) return { kind: 'demo' }
  if (!quote) return { kind: 'measuring', fileName: part.fileName }
  return {
    kind: 'quoted',
    fileName: part.fileName,
    process: part.config.process,
    quote,
  }
}
