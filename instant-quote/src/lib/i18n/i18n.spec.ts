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

  test('every hero console key renders in both locales', () => {
    for (const dict of [pl, en]) {
      const c = dict.hero.console
      const rendered = [
        c.status('bracket_v2.stl'),
        c.statusLive('part.stl'),
        c.metaShip('CZW'),
        c.rowMaterial('29', 'PETG'),
        c.rowMachine('2,7'),
        c.liveCaption,
        c.measuring,
        c.blocked,
        c.assumptions('PETG'),
        c.openQuote,
        c.staysPut,
        c.watertightOk,
        c.chooseFile,
        c.pasteLink,
        c.measuredLocal,
        c.addFile,
        // Motion & interactions (Turn 5)
        c.stageRead,
        c.stageMesh,
        c.stageSolid,
        c.stagePrice,
        c.progressLabel,
        c.measuringPct(50),
        c.addAnotherFile,
        c.announceQuoted('7,78 zł', 'CZW'),
        c.emptyCaption,
        c.statusIdle,
        c.chipSize('1,2'),
        c.priceMine,
        c.demoCaption,
        // Tabbed intake (Turn 4)
        c.tabsLabel,
        c.tabUpload,
        c.tabLink,
        c.tabDemo,
        c.uploadLead,
        c.formats,
        c.finePrint,
        c.linkFetch,
        c.worksWithLabel,
        c.worksWithBody,
        c.finePrintLink,
        c.demoIntro,
        c.demoShowing,
        c.demoMetaBracket,
        c.demoMetaBearing,
        c.demoMetaLid,
        c.finePrintDemo,
        c.dropToPrice,
        c.dropCount(1),
        c.dropCount(3),
        c.finePrintDrag,
        c.rejectTitleType('sketch.dwg'),
        c.rejectBodyType,
        c.rejectTitleSize('huge.stl'),
        c.rejectBodySize,
        c.chooseAnother,
        c.finePrintReject,
      ]
      for (const text of rendered) expect(text.length).toBeGreaterThan(2)
    }
  })

  // Build note 6: three tabs at 11px mono have to fit the island — 288px of
  // it at 360px, where the icons are already hidden. Measured slack is ~19px,
  // so a longer label is a layout regression, not a copy choice.
  test('intake tab labels fit the mobile island', () => {
    for (const dict of [pl, en]) {
      for (const key of ['tabUpload', 'tabLink', 'tabDemo'] as const) {
        expect(dict.hero.console[key].length).toBeLessThanOrEqual(12)
      }
    }
    // The rejected-file titles quote the filename — they must not swallow it.
    expect(pl.hero.console.rejectTitleType('sketch.dwg')).toContain(
      'sketch.dwg',
    )
    expect(en.hero.console.rejectTitleSize('huge.stl')).toContain('huge.stl')
  })

  test('mobile hero/sticky-bar strings render in both locales', () => {
    for (const dict of [pl, en]) {
      expect(dict.hero.subShort.length).toBeGreaterThan(10)
      expect(dict.hero.trustChips.length).toBe(3)
      for (const chip of dict.hero.trustChips) {
        expect(chip.length).toBeGreaterThan(2)
      }
      expect(dict.stickyBar.openQuote.length).toBeGreaterThan(2)
      expect(dict.stickyBar.caption.length).toBeGreaterThan(2)
    }
  })

  test('mobile menu/materials/faq strings render in both locales', () => {
    const menuKeys = [
      'howItWorks',
      'materials',
      'pricing',
      'compare',
      'blog',
    ] as const
    for (const dict of [pl, en]) {
      for (const key of menuKeys) {
        expect(dict.nav.menuMeta[key].length).toBeGreaterThan(0)
      }
      expect(dict.nav.menuTrust1.length).toBeGreaterThan(5)
      expect(dict.nav.menuTrust2.length).toBeGreaterThan(5)
      expect(dict.landingFaq.headingShort.length).toBeGreaterThan(2)
      for (const id of Object.keys(dict.materials) as Array<
        keyof typeof dict.materials
      >) {
        expect(dict.materials[id].oneLiner.length).toBeGreaterThan(5)
      }
    }
  })

  test('ladder block renders in both locales', () => {
    for (const dict of [pl, en]) {
      const l = dict.ladder
      expect(l.intro('2,7')).toContain('2,7')
      expect(l.tableHead('bracket_v2.stl', '29', '2,7')).toContain(
        'bracket_v2.stl',
      )
      expect(l.vsCheapest.length).toBeGreaterThan(2)
      expect(l.cheapest.length).toBeGreaterThan(2)
      expect(l.quotedAboveBar.length).toBeGreaterThan(2)
      expect(l.chipCheapest.length).toBeGreaterThan(2)
      expect(l.chipQuoted('1,26')).toContain('1,26')
      expect(l.showAll.length).toBeGreaterThan(2)
      expect(l.showFewer.length).toBeGreaterThan(2)
      const ids = Object.keys(l.useCases)
      expect(ids.length).toBe(7)
      for (const id of ids) {
        expect(
          l.useCases[id as keyof typeof l.useCases].length,
        ).toBeGreaterThan(10)
      }
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
