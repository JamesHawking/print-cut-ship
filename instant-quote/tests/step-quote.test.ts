// Geometry anchor against mapi-tech.pl's analyzer, captured 2026-07-14:
// tests/test_object.step ("Leg R", 20×90×200 mm, analyzer volume
// 355446.45 mm³). Pricing itself moved to the Go backend — the money-side
// anchors (33.67 zł PETG part, Basket.3mf 21.64 zł PLA) live in
// backend/internal/pricing tests. This file guards the client half of the
// chain: OCCT tessellation + mesh analysis must keep producing the metrics
// the backend prices.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import occtimportjs from 'occt-import-js'
import { parseStep } from '../src/lib/mesh/parse-step'
import { analyze } from '../src/lib/mesh/analyze'

const MAPI_VOLUME_CM3 = 355.44645

const bytes = readFileSync(new URL('./test_object.step', import.meta.url))
const occt = await occtimportjs()
const metrics = analyze(parseStep(bytes.buffer as ArrayBuffer, occt))

describe('test_object.step geometry matches the mapi-tech analyzer', () => {
  it('volume within 1% of 355.44645 cm³', () => {
    expect(Math.abs(metrics.volumeCm3 - MAPI_VOLUME_CM3)).toBeLessThan(
      MAPI_VOLUME_CM3 * 0.01,
    )
  })
  it('bounding box is 20×90×200 mm (any orientation)', () => {
    const axes = [metrics.bboxMm.x, metrics.bboxMm.y, metrics.bboxMm.z].sort(
      (a, b) => b - a,
    )
    expect(axes[0]).toBeCloseTo(200, 1)
    expect(axes[1]).toBeCloseTo(90, 1)
    expect(axes[2]).toBeCloseTo(20, 1)
  })
  it('tessellation is watertight — no hull fallback', () => {
    expect(metrics.watertight).toBe(true)
    expect(metrics.usedHullFallback).toBe(false)
  })
})
