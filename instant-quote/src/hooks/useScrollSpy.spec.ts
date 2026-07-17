import { describe, expect, test } from 'bun:test'
import { pickActiveSection } from './useScrollSpy'

describe('pickActiveSection', () => {
  const ids = ['how-it-works', 'materials', 'pricing'] as const

  test('null when nothing intersects (above the fold)', () => {
    expect(pickActiveSection(ids, new Set())).toBeNull()
  })

  test('the single intersecting section wins', () => {
    expect(pickActiveSection(ids, new Set(['pricing']))).toBe('pricing')
  })

  test('first id in section order wins when several intersect', () => {
    expect(pickActiveSection(ids, new Set(['pricing', 'materials']))).toBe(
      'materials',
    )
  })

  test('ids outside the section list are ignored', () => {
    expect(pickActiveSection(ids, new Set(['top', 'hero']))).toBeNull()
  })
})
