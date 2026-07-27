import { useEffect, useRef, useState } from 'react'
import type { PartQuote } from '@/lib/api/client'
import type { MeshMetrics } from '@/lib/mesh/types'
import { track } from '@/lib/funnel'
import { usePartPrice } from './useApi'
import { useParts } from './useParts'

/**
 * Minimum time the measuring state stays on screen (Mobile Audit 2a): it is
 * the honesty beat — filename, then the geometry facts as the local parse
 * lands them. A cached or small part can price in ~200 ms, which reads as a
 * flicker; holding it makes the measurement legible. Paced against the
 * intake card's progress bar (2400 ms fill, MeasuringCard.tsx) so the bar
 * finishes travelling just before the price replaces it — change both
 * together.
 */
const MIN_MEASURING_MS = 2800

/** What the hero's dark chamber renders. */
export type HeroLiveState =
  | { kind: 'demo' }
  // metrics land when the local parse finishes, while the price request is
  // still in flight — the ≤sm measuring card shows them as they arrive
  // (Mobile Audit 2a: the honesty beat).
  | { kind: 'measuring'; fileName: string; metrics?: MeshMetrics }
  | {
      kind: 'quoted'
      fileName: string
      fileSize: number
      watertight: boolean
      process: string
      quote: PartQuote
    }

/**
 * Inline live quote for the hero (design 17b, handoff 1c): a single file
 * dropped on the landing is measured and priced right in the dark chamber.
 * The quoted state is terminal — the price stays put until the user clicks
 * OPEN FULL QUOTE (the hero renders it; the only timer here is the measuring
 * floor below, which delays the payoff, never advances past it). Parse failures
 * hand control back to the landing (`onFailed` — the intake toast has
 * already explained); price-API failures skip the payoff and navigate at
 * once (`onDone` — the quote page owns retry UX).
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

  // Callbacks via refs so the effect's deps stay primitive — a parts
  // re-render (e.g. the background upload flipping to 'stored') must not
  // re-fire the error handoffs.
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const failedRef = useRef(onFailed)
  failedRef.current = onFailed

  useEffect(() => {
    if (!livePartId) return
    if (failed) failedRef.current()
    else if (isError) doneRef.current()
  }, [livePartId, failed, isError])

  // Measuring floor: starts with each new part, so a fast (or cached) quote
  // still gives the measuring beat its screen time. Errors bypass it — the
  // effect above hands off immediately. Stored as the id the timer ran for,
  // not a boolean: a new part is "not yet elapsed" on its first render, with
  // no flash of the previous part's payoff.
  const [dwellFor, setDwellFor] = useState<string | null>(null)
  useEffect(() => {
    if (!livePartId) return
    const t = setTimeout(() => setDwellFor(livePartId), MIN_MEASURING_MS)
    return () => clearTimeout(t)
  }, [livePartId])
  const dwellElapsed = !!livePartId && dwellFor === livePartId

  // Funnel: once per live part, when its quote first reaches the screen.
  const quoted = !!quote && !failed && dwellElapsed
  const firedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!livePartId || !quoted || firedFor.current === livePartId) return
    firedFor.current = livePartId
    track('hero_live_quote_shown', { fileName: part?.fileName })
  }, [livePartId, quoted, part?.fileName])

  if (!part || failed) return { kind: 'demo' }
  if (!quote || !dwellElapsed)
    return { kind: 'measuring', fileName: part.fileName, metrics: part.metrics }
  return {
    kind: 'quoted',
    fileName: part.fileName,
    fileSize: part.fileSize,
    watertight: part.metrics?.watertight ?? false,
    process: part.config.process,
    quote,
  }
}
