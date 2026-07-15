// End-to-end anchor against mapi-tech.pl (SeekMake widget), captured 2026-07-14:
// tests/test_object.step ("Leg R", 20×90×200 mm, analyzer volume 355446.45 mm³),
// PETG / 20% infill / qty 1 / Standard → part 33.67 zł, cart 34.67 zł
// (part + 1.00 zł order fee), +20.00 zł shipping → checkout 54.67 zł, gross
// (no VAT added on top). See references/mapi-tech-pricing.md.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import occtimportjs from 'occt-import-js'
import { parseStep } from '../src/lib/mesh/parse-step'
import { analyze } from '../src/lib/mesh/analyze'
import { computePartQuote, computeOrderTotals } from '../src/lib/pricing'

const MAPI_VOLUME_CM3 = 355.44645
const MAPI_PART_PLN = 33.67
const MAPI_ORDER_FEE_PLN = 1.0
const MAPI_SHIPPING_PLN = 20.0
const MAPI_CHECKOUT_PLN = 54.67
const TOLERANCE = 0.1 // ±10% calibration target vs the real widget

const round2 = (n: number) => Math.round(n * 100) / 100

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

describe('PETG part price anchors to mapi-tech 33.67 zł', () => {
  const quote = computePartQuote(metrics, {
    process: 'petg',
    quantity: 1,
    leadTime: 'standard',
  })

  it(`unit price within ±10% of ${MAPI_PART_PLN} zł`, () => {
    expect(quote.blocked).toBe(false)
    expect(quote.unitPricePln).toBeGreaterThan(MAPI_PART_PLN * (1 - TOLERANCE))
    expect(quote.unitPricePln).toBeLessThan(MAPI_PART_PLN * (1 + TOLERANCE))
  })

  it('order totals anchor to the 54.67 zł checkout (gross, incl. VAT)', () => {
    const t = computeOrderTotals([quote])
    // Part alone exceeds the 30 zł minimum — no top-up, exactly like mapi.
    expect(t.minOrderApplied).toBe(false)
    expect(t.orderFeePln).toBe(MAPI_ORDER_FEE_PLN)
    expect(t.shippingPln).toBe(MAPI_SHIPPING_PLN)
    expect(t.grossTotalPln).toBe(
      round2(quote.unitPricePln + MAPI_ORDER_FEE_PLN + MAPI_SHIPPING_PLN),
    )
    expect(Math.abs(t.grossTotalPln - MAPI_CHECKOUT_PLN)).toBeLessThan(
      MAPI_PART_PLN * TOLERANCE,
    )
    // VAT is included in the gross total, not added on top.
    expect(t.vatPln).toBe(round2((t.grossTotalPln * 0.23) / 1.23))
    expect(round2(t.netTotalPln + t.vatPln)).toBe(t.grossTotalPln)
  })
})
