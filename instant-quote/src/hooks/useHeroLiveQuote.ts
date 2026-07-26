import { useEffect, useRef } from 'react'
import type { PartQuote } from '@/lib/api/client'
import { track } from '@/lib/funnel'
import { usePartPrice } from './useApi'
import { useParts } from './useParts'

/** What the hero's dark chamber renders. */
export type HeroLiveState =
  | { kind: 'demo' }
  | { kind: 'measuring'; fileName: string }
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
 * OPEN FULL QUOTE (the hero renders it; no timer anywhere). Parse failures
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

  // Funnel: once per live part, when its quote first lands.
  const quoted = !!quote && !failed
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
    fileSize: part.fileSize,
    watertight: part.metrics?.watertight ?? false,
    process: part.config.process,
    quote,
  }
}
