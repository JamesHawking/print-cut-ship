import { describe, expect, test } from 'bun:test'
import { parseStl } from '@/lib/mesh/parse-stl'
import { analyze } from '@/lib/mesh/analyze'
import { bracketBinaryStl } from '../../../tests/fixtures/generate'
import {
  FALLBACK_BREAKDOWN,
  FALLBACK_QUOTE,
  SAMPLE_FILE,
  SAMPLE_METRICS,
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

  // The engine scales breakdown lines to sum exactly to the line total; the
  // hero console's fallback rows must keep that property.
  test('FALLBACK_BREAKDOWN sums to FALLBACK_QUOTE.lineTotalPln', () => {
    expect(
      FALLBACK_BREAKDOWN.materialPln + FALLBACK_BREAKDOWN.machinePln,
    ).toBeCloseTo(FALLBACK_QUOTE.lineTotalPln, 6)
  })
})
