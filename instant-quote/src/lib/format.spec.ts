import { describe, expect, test } from 'bun:test'
import {
  formatDims,
  formatPlacedDate,
  formatPln,
  formatShipDate,
  formatVolume,
} from './format'

// pl-PL groups thousands with U+00A0 — and per CLDR only from 5 digits up
// (minimumGroupingDigits=2), so 1234 stays ungrouped.
const NBSP = ' '

describe('formatPln', () => {
  test('pl: decimal comma, NBSP grouping, zł suffix', () => {
    expect(formatPln(12345.67, 'pl')).toBe(`12${NBSP}345,67${NBSP}zł`)
    expect(formatPln(1234.56, 'pl')).toBe(`1234,56${NBSP}zł`)
    expect(formatPln(3.5, 'pl')).toBe(`3,50${NBSP}zł`)
  })
  test('en: decimal point, comma grouping, zł suffix (not "PLN")', () => {
    expect(formatPln(1234.56, 'en')).toBe(`1,234.56${NBSP}zł`)
    expect(formatPln(3.5, 'en')).toBe(`3.50${NBSP}zł`)
  })
})

describe('formatShipDate', () => {
  const d = { y: 2026, m: 7, d: 16 }
  test('localized weekday/day/month from CalDate', () => {
    expect(formatShipDate(d, 'en')).toBe('Thu 16 Jul')
    expect(formatShipDate(d, 'pl')).toBe('czw., 16 lip')
  })
})

describe('formatPlacedDate', () => {
  test('day + short month per locale', () => {
    expect(formatPlacedDate('2026-07-16T10:00:00Z', 'en')).toBe('16 Jul')
    expect(formatPlacedDate('2026-07-16T10:00:00Z', 'pl')).toBe('16 lip')
  })
})

describe('decimal separators', () => {
  test('volume and dims follow the locale', () => {
    expect(formatVolume(3.456, 'pl')).toBe('3,46 cm³')
    expect(formatVolume(3.456, 'en')).toBe('3.46 cm³')
    expect(formatDims({ x: 80, y: 50, z: 6 }, 'pl')).toBe('80 × 50 × 6,0 mm')
    expect(formatDims({ x: 80, y: 50, z: 6 }, 'en')).toBe('80 × 50 × 6.0 mm')
  })
})
