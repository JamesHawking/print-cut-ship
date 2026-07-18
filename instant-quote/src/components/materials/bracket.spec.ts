import { describe, expect, test } from 'bun:test'
import { MATERIALS } from '@/lib/catalog-static'
import {
  BRACKET_PRICE_FALLBACK,
  BRACKET_PROCESS_IDS,
  bracketFallbackOrdered,
  buildBracketRequests,
} from './bracket'

describe('bracket pricing data', () => {
  test('process ids mirror the static catalog order', () => {
    const ids: string[] = [...BRACKET_PROCESS_IDS]
    expect(ids).toEqual(MATERIALS.map((m) => m.id))
  })

  test('fallback pins the engine capture of 2026-07-18', () => {
    // Guard against accidental edits — the authoritative check is a fresh
    // POST /api/v1/price (refresh when pricing config changes).
    expect(BRACKET_PRICE_FALLBACK).toEqual({
      pla: 6.18,
      petg: 7.78,
      pctg: 10.08,
      asa: 9.88,
      petg_fr: 9.69,
      pa12_cf: 25.36,
      iglidur: 26.04,
    })
    expect(bracketFallbackOrdered()).toEqual([
      6.18, 7.78, 10.08, 9.88, 9.69, 25.36, 26.04,
    ])
  })

  test('requests split 5+2 (contract maxItems), order preserved', () => {
    const reqs = buildBracketRequests()
    expect(reqs).toHaveLength(2)
    expect(reqs[0].parts).toHaveLength(5)
    expect(reqs[1].parts).toHaveLength(2)
    const ids = reqs.flatMap((r) => r.parts.map((p) => p.process))
    expect(ids).toEqual([...BRACKET_PROCESS_IDS])
    for (const r of reqs) {
      for (const part of r.parts) {
        expect(part.quantity).toBe(1)
        expect(part.leadTime).toBe('standard')
        expect(part.metrics.volumeCm3).toBeGreaterThan(0)
      }
    }
  })
})
