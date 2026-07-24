import { describe, expect, test } from 'bun:test'
import { pl } from './pl'
import { en } from './en'
import { plPlural } from './plural'

// Key exhaustiveness is compile-enforced (en satisfies Dictionary). These
// tests pin what the type system lost when `as const` was dropped: array
// lengths (zipped/indexed consumers) and locale-stable data values.

describe('dictionary parity', () => {
  test('zipped arrays have equal lengths across locales', () => {
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

describe('dfm and api-error rendering', () => {
  const dfmParams: Record<string, Record<string, unknown>> = {
    exceeds_build_volume: { x: 340, y: 320, z: 340 },
    small_feature: { minDimMm: 0.5 },
    min_volume_billed: { minCm3: 1 },
    geometry_approximated: {},
    multi_plate: { pieces: 8, plates: 3, extraFeePln: 10 },
  }

  test('every DFM code renders a message with its params in both locales', () => {
    for (const dict of [pl, en]) {
      for (const [code, params] of Object.entries(dfmParams)) {
        const msg =
          dict.dfm.messages[code as keyof typeof dict.dfm.messages](params)
        expect(msg.length).toBeGreaterThan(10)
        expect(
          dict.dfm.labels[code as keyof typeof dict.dfm.labels],
        ).toBeTruthy()
      }
    }
    // Params interpolate (PL uses a decimal comma).
    expect(pl.dfm.messages.small_feature({ minDimMm: 0.5 })).toContain('0,5')
    expect(en.dfm.messages.small_feature({ minDimMm: 0.5 })).toContain('0.5')
    expect(
      en.dfm.messages.exceeds_build_volume({ x: 340, y: 320, z: 340 }),
    ).toContain('340×320×340')
    expect(
      en.dfm.messages.exceeds_build_volume({ x: 1, y: 1, z: 1, piece: true }),
    ).toContain('piece')
  })

  test('every demo log key renders in both locales', () => {
    for (const dict of [pl, en]) {
      const d = dict.process.demo
      const rendered = [
        d.cmd('bracket_v2.stl'),
        d.recv('bracket_v2.stl', '1,5 KB'),
        d.measureMesh('28'),
        d.measureDims('67,2 cm³', '96 × 64 × 24 mm'),
        d.priceConfig,
        d.priceResult('7,78 zł', '29', '2,7'),
        d.order1,
        d.order2,
        d.ship('CZW'),
        d.shipFallback,
        d.done,
        d.replay,
        d.engineLabel,
        d.cta,
        d.srSummary('7,78 zł', 'CZW'),
      ]
      for (const text of rendered) expect(text.length).toBeGreaterThan(2)
      for (const tag of Object.values(d.tags))
        expect(tag.length).toBeGreaterThan(2)
    }
  })

  test('every hero console key renders in both locales', () => {
    for (const dict of [pl, en]) {
      const c = dict.hero.console
      const rendered = [
        c.status('bracket_v2.stl'),
        c.metaShip('CZW'),
        c.rowMaterial('29', 'PETG'),
        c.rowMachine('2,7'),
      ]
      for (const text of rendered) expect(text.length).toBeGreaterThan(2)
    }
  })

  test('every API error code has copy in both locales', () => {
    for (const dict of [pl, en]) {
      for (const entry of Object.values(dict.apiError)) {
        const text = typeof entry === 'function' ? entry({ max: 5 }) : entry
        expect(text.length).toBeGreaterThan(5)
      }
    }
    expect(en.apiError.parts_count({ max: 5 })).toContain('5')
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
