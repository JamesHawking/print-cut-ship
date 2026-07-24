import { describe, expect, test } from 'bun:test'
import { BRACKET_PRICE_FALLBACK } from '../materials/bracket'
import { buildLadderRows } from './rows'

describe('buildLadderRows', () => {
  test('fallback rows sort ascending and top out at 100%', () => {
    const rows = buildLadderRows(undefined)
    expect(rows.map((r) => r.id)).toEqual([
      'pla',
      'petg',
      'petg_fr',
      'asa',
      'pctg',
      'pa12_cf',
      'iglidur',
    ])
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].pricePln).toBeGreaterThanOrEqual(rows[i - 1].pricePln)
    }
    expect(rows[rows.length - 1].pct).toBe(100)
    expect(rows[0].pct).toBeGreaterThan(0)
    expect(rows[0].pct).toBeLessThan(rows[1].pct)
  })

  test('live rows override the fallback and blocked rows carry no bar', () => {
    const quote = (lineTotalPln: number, blocked = false) =>
      ({ lineTotalPln, blocked }) as never
    const rows = buildLadderRows([
      { process: 'pla', quote: quote(10) },
      { process: 'petg', quote: quote(5) },
      { process: 'pa12_cf', quote: quote(50, true) },
    ])
    expect(rows.map((r) => r.id)).toEqual(['petg', 'pla', 'pa12_cf'])
    expect(rows[1].pct).toBe(100)
    expect(rows[2].blocked).toBe(true)
    expect(rows[2].pct).toBe(0)
  })

  test('fallback covers every catalog material', () => {
    expect(Object.keys(BRACKET_PRICE_FALLBACK).length).toBe(7)
    expect(buildLadderRows(undefined).length).toBe(7)
  })
})
