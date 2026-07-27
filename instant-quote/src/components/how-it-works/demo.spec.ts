import { describe, expect, test } from 'bun:test'
import { parseStl } from '@/lib/mesh/parse-stl'
import { analyze } from '@/lib/mesh/analyze'
import {
  boxBinaryStl,
  bracketBinaryStl,
} from '../../../tests/fixtures/generate'
import {
  DEMO_PARTS,
  FALLBACK_BREAKDOWN,
  FALLBACK_QUOTE,
  SAMPLE_FILE,
  SAMPLE_METRICS,
  type DemoId,
} from './demo'

// The demo's honesty contract: every part's metrics must be exactly what the
// real mesh pipeline measures from its generated fixture. If geometry code or
// the constants drift, this fails before a wrong number ships.
const GEOMETRY: Record<DemoId, () => ArrayBuffer> = {
  bracket: bracketBinaryStl,
  bearing: () => boxBinaryStl(60, 40, 30),
  lid: () => boxBinaryStl(150, 100, 3),
}

describe('sample part drift', () => {
  for (const part of DEMO_PARTS) {
    describe(part.id, () => {
      const buf = GEOMETRY[part.id]()
      const m = analyze(parseStl(buf))

      test('metrics match a fresh measurement', () => {
        expect(m.volumeCm3).toBeCloseTo(part.metrics.volumeCm3, 6)
        expect(m.rawSignedVolumeCm3).toBeCloseTo(
          part.metrics.rawSignedVolumeCm3,
          6,
        )
        expect(m.surfaceAreaCm2).toBeCloseTo(part.metrics.surfaceAreaCm2, 6)
        expect(m.bboxMm).toEqual(part.metrics.bboxMm)
        expect(m.triangleCount).toBe(part.metrics.triangleCount)
        expect(m.watertight).toBe(part.metrics.watertight)
        expect(m.usedHullFallback).toBe(part.metrics.usedHullFallback)
      })

      test('file size matches the generated buffer', () => {
        expect(buf.byteLength).toBe(part.file.bytes)
      })

      // The engine scales breakdown lines to sum exactly to the line total;
      // the hero console's fallback rows must keep that property.
      test('fallbackBreakdown sums to fallbackQuote.lineTotalPln', () => {
        expect(
          part.fallbackBreakdown.materialPln +
            part.fallbackBreakdown.machinePln,
        ).toBeCloseTo(part.fallbackQuote.lineTotalPln, 2)
      })
    })
  }

  // useDemoPrice() returns parts[0] for the price ladder and the hero's
  // default demo — the bracket must stay first.
  test('the bracket is index 0 and keeps its legacy exports', () => {
    expect(DEMO_PARTS[0].id).toBe('bracket')
    expect(SAMPLE_FILE).toBe(DEMO_PARTS[0].file)
    expect(SAMPLE_METRICS).toBe(DEMO_PARTS[0].metrics)
    expect(FALLBACK_QUOTE).toBe(DEMO_PARTS[0].fallbackQuote)
    expect(FALLBACK_BREAKDOWN).toBe(DEMO_PARTS[0].fallbackBreakdown)
  })

  // One POST prices all three (the price contract caps 5 parts per request).
  test('the demo set fits one price request', () => {
    expect(DEMO_PARTS.length).toBeLessThanOrEqual(5)
    expect(new Set(DEMO_PARTS.map((d) => d.id)).size).toBe(DEMO_PARTS.length)
  })
})
