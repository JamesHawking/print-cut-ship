// Row model for the "Same part, seven prices" ladder (PriceLadder.tsx):
// the demo bracket's POST /api/v1/price/compare rows sorted cheapest-first,
// with meter widths as share of the priciest material. Pure — the spec pins
// the fallback ordering and the pct math.

import type { components } from '@/lib/api/schema'
import { BRACKET_PRICE_FALLBACK } from '../materials/bracket'
import { shareOfMax } from '../materials/scale'

type ProcessId = components['schemas']['ProcessId']
type PriceCompareRow = components['schemas']['PriceCompareRow']

export interface LadderRow {
  id: ProcessId
  pricePln: number
  /** Bar width, % of the priciest printable material (0 while blocked). */
  pct: number
  /** Price ÷ cheapest printable price; null for that cheapest row (and for
      blocked rows) — it renders the "— cheapest" caption instead. */
  mult: number | null
  blocked: boolean
}

/** Live compare rows → sorted ladder rows; engine-captured fallback pre-fetch. */
export function buildLadderRows(
  rows: PriceCompareRow[] | undefined,
): LadderRow[] {
  const source = rows?.length
    ? rows.map((r) => ({
        id: r.process as ProcessId,
        pricePln: r.quote.lineTotalPln,
        blocked: r.quote.blocked,
      }))
    : (
        Object.entries(BRACKET_PRICE_FALLBACK) as Array<[ProcessId, number]>
      ).map(([id, pricePln]) => ({ id, pricePln, blocked: false }))
  const sorted = [...source].sort((a, b) => a.pricePln - b.pricePln)
  const prices = sorted.filter((r) => !r.blocked).map((r) => r.pricePln)
  const cheapest = prices[0]
  return sorted.map((r) => ({
    ...r,
    pct: r.blocked ? 0 : shareOfMax(r.pricePln, prices),
    mult:
      r.blocked || !cheapest || r.pricePln === cheapest
        ? null
        : r.pricePln / cheapest,
  }))
}
