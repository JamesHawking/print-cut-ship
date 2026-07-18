import { describe, expect, test } from 'bun:test'
import { MATERIALS } from '@/lib/catalog-static'
import { bracketFallbackOrdered } from './bracket'
import { shareOfMax } from './scale'

describe('shareOfMax', () => {
  test('the max is the 100% rail', () => {
    expect(shareOfMax(550, [50, 550, 150])).toBe(100)
  })

  test('zł/kg rate ladder (drift-guard vs catalog changes)', () => {
    const rates = MATERIALS.map((m) => m.plnPerKg)
    expect(rates.map((r) => shareOfMax(r, rates))).toEqual([
      9.1, // PLA 50
      9.1, // PETG 50
      27.3, // PCTG 150
      21.8, // ASA 120
      32.7, // PETG FR 180
      63.6, // PA12-CF 350
      100, // Iglidur 550
    ])
  })

  test('demo-bracket price ladder (drift-guard vs fallback edits)', () => {
    const prices = bracketFallbackOrdered()
    expect(prices.map((p) => shareOfMax(p, prices))).toEqual([
      23.7, // PLA 6.18
      29.9, // PETG 7.78
      38.7, // PCTG 10.08
      37.9, // ASA 9.88
      37.2, // PETG FR 9.69
      97.4, // PA12-CF 25.36
      100, // Iglidur 26.04
    ])
  })
})
