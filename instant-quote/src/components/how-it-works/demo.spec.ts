import { describe, expect, test } from 'bun:test'
import { parseStl } from '@/lib/mesh/parse-stl'
import { analyze } from '@/lib/mesh/analyze'
import { pl } from '@/lib/i18n/pl'
import { en } from '@/lib/i18n/en'
import { bracketBinaryStl } from '../../../tests/fixtures/generate'
import {
  FALLBACK_QUOTE,
  SAMPLE_FILE,
  SAMPLE_METRICS,
  STAGE_ANCHOR,
  STAGE_ORDER,
  buildScript,
  buildStationReadouts,
  type Stage,
} from './demo'

// The demo's honesty contract: SAMPLE_METRICS must be exactly what the real
// mesh pipeline measures from the generated bracket fixture. If geometry
// code or the constants drift, this fails before a wrong number ships.
describe('sample part drift', () => {
  const buf = bracketBinaryStl()
  const m = analyze(parseStl(buf))

  test('SAMPLE_METRICS matches a fresh measurement', () => {
    expect(m.volumeCm3).toBeCloseTo(SAMPLE_METRICS.volumeCm3, 6)
    expect(m.rawSignedVolumeCm3).toBeCloseTo(
      SAMPLE_METRICS.rawSignedVolumeCm3,
      6,
    )
    expect(m.surfaceAreaCm2).toBeCloseTo(SAMPLE_METRICS.surfaceAreaCm2, 6)
    expect(m.bboxMm).toEqual(SAMPLE_METRICS.bboxMm)
    expect(m.triangleCount).toBe(SAMPLE_METRICS.triangleCount)
    expect(m.watertight).toBe(SAMPLE_METRICS.watertight)
    expect(m.usedHullFallback).toBe(SAMPLE_METRICS.usedHullFallback)
  })

  test('SAMPLE_FILE size matches the generated buffer', () => {
    expect(buf.byteLength).toBe(SAMPLE_FILE.bytes)
  })
})

describe('buildScript', () => {
  const EXPECTED_STAGES: Stage[] = [
    'recv',
    'recv',
    'measure',
    'measure',
    'price',
    'price',
    'order',
    'order',
    'ship',
    'done',
  ]

  test('stage sequence and non-empty lines in both locales', () => {
    for (const [dict, locale] of [
      [pl, 'pl'],
      [en, 'en'],
    ] as const) {
      const script = buildScript(dict.process.demo, locale, undefined, 'THU')
      expect(script.map((l) => l.stage)).toEqual(EXPECTED_STAGES)
      for (const line of script) {
        expect(line.text.length).toBeGreaterThan(0)
        expect(line.delayMs).toBeGreaterThan(0)
      }
    }
  })

  test('locale number formats (PL comma, EN point)', () => {
    const plScript = buildScript(pl.process.demo, 'pl', undefined, undefined)
    const enScript = buildScript(en.process.demo, 'en', undefined, undefined)
    // volume 67.2 cm³
    expect(plScript[3].text).toContain('67,2')
    expect(enScript[3].text).toContain('67.2')
  })

  test('fallback path uses FALLBACK_QUOTE and the D+1 ship line', () => {
    const script = buildScript(en.process.demo, 'en', undefined, undefined)
    const priceLine = script[5].text
    expect(priceLine).toContain('7.78')
    expect(priceLine).toContain(String(Math.round(FALLBACK_QUOTE.weightG)))
    expect(script[8].text).toContain('D+1')
    expect(script[8].text).not.toContain('THU')
  })

  test('live quote and ship date appear formatted', () => {
    const script = buildScript(
      en.process.demo,
      'en',
      { lineTotalPln: 12.34, weightG: 41.6, printHours: 3.21 },
      'FRI',
    )
    expect(script[5].text).toContain('12.34')
    expect(script[5].text).toContain('42 g')
    expect(script[5].text).toContain('3.2 h')
    expect(script[8].text).toContain('FRI')
  })

  test('STAGE_ANCHOR is total and non-decreasing over the script', () => {
    const script = buildScript(en.process.demo, 'en', undefined, undefined)
    let prev = -1
    for (const line of script) {
      const anchor = STAGE_ANCHOR[line.stage]
      expect(anchor).toBeGreaterThanOrEqual(0)
      expect(anchor).toBeLessThanOrEqual(3)
      expect(anchor).toBeGreaterThanOrEqual(prev)
      prev = anchor
    }
  })
})

describe('buildStationReadouts', () => {
  test('fallback numbers match the log fallback, both locales', () => {
    for (const [dict, locale] of [
      [pl, 'pl'],
      [en, 'en'],
    ] as const) {
      const readouts = buildStationReadouts(
        dict.process.demo,
        locale,
        undefined,
        'D+1',
      )
      const script = buildScript(
        dict.process.demo,
        locale,
        undefined,
        undefined,
      )
      expect(readouts[0]).toBe(script[1].text) // recv line
      expect(readouts[1]).toContain('7' + (locale === 'pl' ? ',' : '.') + '78')
      expect(readouts[2]).toBe('D+1')
    }
  })

  test('live quote price replaces the fallback', () => {
    const readouts = buildStationReadouts(
      en.process.demo,
      'en',
      { lineTotalPln: 12.34, weightG: 41.6, printHours: 3.21 },
      'FRI · D+1',
    )
    expect(readouts[1]).toContain('12.34')
    expect(readouts[2]).toBe('FRI · D+1')
  })
})

describe('STAGE_ORDER', () => {
  test('covers every Stage exactly once, recv first and done last', () => {
    expect(STAGE_ORDER[0]).toBe('recv')
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('done')
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length)
    for (const stage of Object.keys(STAGE_ANCHOR) as Stage[]) {
      expect(STAGE_ORDER).toContain(stage)
    }
  })
})
