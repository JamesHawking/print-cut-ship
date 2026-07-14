import { describe, it, expect } from 'bun:test'
import { computeShipDate, getWarsawNow } from '../src/lib/leadtime'

// Build a UTC instant that reads as a given Warsaw wall-clock time.
// Summer (Jul) Warsaw = UTC+2, Winter (Jan) = UTC+1.
function warsawSummer(y: number, m: number, d: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh - 2, mm))
}
function warsawWinter(y: number, m: number, d: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh - 1, mm))
}

const iso = (d: { y: number; m: number; d: number }) =>
  `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`

describe('Warsaw wall clock extraction', () => {
  it('reads summer time as UTC+2', () => {
    const w = getWarsawNow(warsawSummer(2026, 7, 15, 13, 59))
    expect([w.y, w.m, w.d, w.hour, w.minute]).toEqual([2026, 7, 15, 13, 59])
    expect(w.weekday).toBe(3) // Wednesday
  })
})

describe('ship date — before 14:00 cutoff (Wed 15 Jul 2026, 13:59)', () => {
  const now = warsawSummer(2026, 7, 15, 13, 59)
  it('express (3 bd) → Mon 20 Jul', () => {
    expect(iso(computeShipDate('express', now).date)).toBe('2026-07-20')
  })
  it('standard (5 bd) → Wed 22 Jul', () => {
    expect(iso(computeShipDate('standard', now).date)).toBe('2026-07-22')
  })
  it('economy (10 bd) → Wed 29 Jul', () => {
    expect(iso(computeShipDate('economy', now).date)).toBe('2026-07-29')
  })
  it('dispatch starts today', () => {
    expect(computeShipDate('express', now).dispatchStartsToday).toBe(true)
  })
})

describe('ship date — at/after 14:00 cutoff', () => {
  it('Wed 14:00 express (3 bd) → Tue 21 Jul (day0 = Thu)', () => {
    const now = warsawSummer(2026, 7, 15, 14, 0)
    expect(iso(computeShipDate('express', now).date)).toBe('2026-07-21')
    expect(computeShipDate('express', now).dispatchStartsToday).toBe(false)
  })
})

describe('ship date — Friday weekend skip', () => {
  it('Fri 17 Jul 13:00 express (3 bd) → Wed 22 Jul', () => {
    const now = warsawSummer(2026, 7, 17, 13, 0)
    expect(iso(computeShipDate('express', now).date)).toBe('2026-07-22')
  })
  it('Fri 17 Jul 14:30 express (3 bd) → Thu 23 Jul (day0 = Mon)', () => {
    const now = warsawSummer(2026, 7, 17, 14, 30)
    expect(iso(computeShipDate('express', now).date)).toBe('2026-07-23')
  })
})

describe('ship date — Saturday', () => {
  it('Sat 18 Jul any time express (3 bd) → Thu 23 Jul (day0 = Mon)', () => {
    const now = warsawSummer(2026, 7, 18, 9, 0)
    expect(iso(computeShipDate('express', now).date)).toBe('2026-07-23')
    expect(computeShipDate('express', now).dispatchStartsToday).toBe(false)
  })
})

describe('ship date — winter (DST off, UTC+1)', () => {
  it('Wed 14 Jan 2026 13:30 Warsaw is before cutoff → express (3 bd) Mon 19 Jan', () => {
    const now = warsawWinter(2026, 1, 14, 13, 30)
    const w = getWarsawNow(now)
    expect([w.hour, w.minute]).toEqual([13, 30])
    expect(iso(computeShipDate('express', now).date)).toBe('2026-01-19')
  })
})
