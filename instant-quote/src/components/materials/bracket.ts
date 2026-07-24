// The "demo bracket in this material" data for the Materials specimen grid:
// the SAME sample bracket the hero console quotes (SAMPLE_METRICS),
// priced live by the engine in every process. One POST takes max 5 parts, so
// the 7 processes go out as two parallel requests and merge in order.
//
// BRACKET_PRICE_FALLBACK is captured from the real engine (2026-07-18, qty 1,
// standard lead time) — shown pre-fetch / API-down and replaced when the
// query resolves, the FALLBACK_QUOTE pattern from how-it-works/demo.ts.
// Refresh when backend/internal/pricing/config.go changes; the spec below
// pins these values against accidental edits, not against the engine.

import type { components } from '@/lib/api/schema'
import { toApiMetrics } from '@/lib/api/client'
import { SAMPLE_METRICS } from '../how-it-works/demo'

type ProcessId = components['schemas']['ProcessId']
type PricePart = components['schemas']['PricePart']

/** Process ids in MATERIALS order — the spec asserts they stay in lockstep. */
export const BRACKET_PROCESS_IDS = [
  'pla',
  'petg',
  'pctg',
  'asa',
  'petg_fr',
  'pa12_cf',
  'iglidur',
] as const satisfies readonly ProcessId[]

export const BRACKET_PRICE_FALLBACK: Record<ProcessId, number> = {
  pla: 6.18,
  petg: 7.78,
  pctg: 10.08,
  asa: 9.88,
  petg_fr: 9.69,
  pa12_cf: 25.36,
  iglidur: 26.04,
}

/** Fallback line totals in MATERIALS order (what the grid renders pre-fetch). */
export function bracketFallbackOrdered(): number[] {
  return BRACKET_PROCESS_IDS.map((id) => BRACKET_PRICE_FALLBACK[id])
}

/** The two POST /api/v1/price bodies (maxItems 5 per the contract), in order. */
export function buildBracketRequests(): { parts: PricePart[] }[] {
  const mk = (id: ProcessId): PricePart => ({
    metrics: toApiMetrics(SAMPLE_METRICS),
    process: id,
    quantity: 1,
    leadTime: 'standard',
  })
  const ids = BRACKET_PROCESS_IDS as readonly ProcessId[]
  return [{ parts: ids.slice(0, 5).map(mk) }, { parts: ids.slice(5).map(mk) }]
}
