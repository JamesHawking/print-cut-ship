import { useEffect, useRef, useState } from 'react'
import type { PartQuote } from '@/lib/api/client'
import type { MeshMetrics, MeshStage } from '@/lib/mesh/types'
import { track } from '@/lib/funnel'
import { usePartPrice } from './useApi'
import { useParts } from './useParts'

/**
 * Minimum time the measuring state stays on screen (Mobile Audit 5b). It is a
 * floor, not a pace: the four stages tick as they genuinely complete, and this
 * only stops the whole panel flashing past on a small cached STL that prices
 * in ~200 ms. 5b's own rule is that a bar which flashes reads as a glitch —
 * one second is the shortest hold that still reads as a measurement rather
 * than a stutter. Nothing else is timed against it; the bar is driven by real
 * stage completion, not by this number.
 */
const MIN_MEASURING_MS = 1000

/** What the hero's dark chamber renders. */
export type HeroLiveState =
  | { kind: 'demo' }
  // metrics land when the local parse finishes, while the price request is
  // still in flight — the ≤sm measuring card shows them as they arrive
  // (Mobile Audit 2a: the honesty beat). `stage` is the last pipeline step
  // that actually completed (5c: progress is honest).
  | {
      kind: 'measuring'
      fileName: string
      fileSize: number
      metrics?: MeshMetrics
      stage?: MeshStage
    }
  | {
      kind: 'quoted'
      fileName: string
      fileSize: number
      watertight: boolean
      metrics?: MeshMetrics
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
    return {
      kind: 'measuring',
      fileName: part.fileName,
      fileSize: part.fileSize,
      metrics: part.metrics,
      // The engine having answered IS the last stage completing, even while
      // the floor below still holds the payoff back.
      stage: quote ? 'price' : part.stage,
    }
  return {
    kind: 'quoted',
    fileName: part.fileName,
    fileSize: part.fileSize,
    watertight: part.metrics?.watertight ?? false,
    metrics: part.metrics,
    process: part.config.process,
    quote,
  }
}
