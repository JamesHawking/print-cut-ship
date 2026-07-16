import { describe, expect, test } from 'bun:test'
import { pl } from './pl'
import { en } from './en'
import { plPlural } from './plural'

// Key exhaustiveness is compile-enforced (en satisfies Dictionary). These
// tests pin what the type system lost when `as const` was dropped: array
// lengths (zipped/indexed consumers) and locale-stable data values.

describe('dictionary parity', () => {
  test('zipped arrays have equal lengths across locales', () => {
    expect(en.hero.specs.length).toBe(pl.hero.specs.length)
    expect(en.ticker.length).toBe(pl.ticker.length)
    expect(en.process.steps.length).toBe(pl.process.steps.length)
    expect(en.pricing.terms.length).toBe(pl.pricing.terms.length)
    expect(en.pricing.cards.length).toBe(pl.pricing.cards.length)
  })

  test('material family keys are locale-stable (drive dot colors)', () => {
    for (const id of Object.keys(pl.materials) as Array<
      keyof typeof pl.materials
    >) {
      expect(en.materials[id].family).toBe(pl.materials[id].family)
    }
  })
})

describe('plPlural', () => {
  const czesc = (n: number) => plPlural(n, 'część', 'części', 'części')
  test.each([
    [1, 'część'],
    [2, 'części'],
    [4, 'części'],
    [5, 'części'],
    [12, 'części'],
    [14, 'części'],
    [22, 'części'],
    [25, 'części'],
    [104, 'części'],
  ])('%i', (n, expected) => {
    expect(czesc(n)).toBe(expected)
  })

  // The few/many split is invisible with 'część' — pin it with a word where
  // the forms differ.
  const dzien = (n: number) =>
    plPlural(n, 'dzień', 'dni robocze', 'dni roboczych')
  test('few vs many forms', () => {
    expect(dzien(1)).toBe('dzień')
    expect(dzien(3)).toBe('dni robocze')
    expect(dzien(13)).toBe('dni roboczych')
    expect(dzien(23)).toBe('dni robocze')
    expect(dzien(100)).toBe('dni roboczych')
  })
})
