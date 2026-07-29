import { describe, expect, test } from 'bun:test'
import { COUNT_UP_MS, countUpValue, easeOutCubic } from './count-up'

describe('easeOutCubic', () => {
  test('is pinned at both ends', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  test('front-loads: past halfway by the first eighth of the time', () => {
    expect(easeOutCubic(0.125)).toBeGreaterThan(0.3)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.8)
  })

  test('is monotonic', () => {
    for (let t = 0; t < 1; t += 0.05) {
      expect(easeOutCubic(t + 0.05)).toBeGreaterThan(easeOutCubic(t))
    }
  })
})

describe('countUpValue', () => {
  test('starts at from and ends exactly on to', () => {
    expect(countUpValue(0, 7.78, 0)).toBe(0)
    expect(countUpValue(0, 7.78, COUNT_UP_MS)).toBe(7.78)
  })

  test('clamps rather than overshooting when a frame arrives late', () => {
    // A backgrounded tab resuming long after the run should have finished.
    expect(countUpValue(0, 7.78, 60_000)).toBe(7.78)
    expect(countUpValue(0, 7.78, -50)).toBe(0)
  })

  test('rolls from the old number, never back through zero', () => {
    // The demo bracket (7.78) being replaced by a dearer live part.
    const mid = countUpValue(7.78, 24.53, COUNT_UP_MS / 2)
    expect(mid).toBeGreaterThan(7.78)
    expect(mid).toBeLessThan(24.53)
  })

  test('counts down the same way when the new part is cheaper', () => {
    const mid = countUpValue(24.53, 7.78, COUNT_UP_MS / 2)
    expect(mid).toBeLessThan(24.53)
    expect(mid).toBeGreaterThan(7.78)
  })

  test('a zero duration snaps — the reduced-motion path', () => {
    expect(countUpValue(0, 7.78, 0, 0)).toBe(7.78)
  })
})
