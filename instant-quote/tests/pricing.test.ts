import { describe, it, expect } from 'bun:test'
import {
  computePartQuote,
  computeOrderTotals,
  interpolateDiscount,
  type PartConfig,
  type PartQuote,
} from '../src/lib/pricing'
import type { MeshMetrics } from '../src/lib/mesh/types'

function metrics(overrides: Partial<MeshMetrics> = {}): MeshMetrics {
  return {
    volumeCm3: 100,
    rawSignedVolumeCm3: 100,
    surfaceAreaCm2: 6,
    bboxMm: { x: 20, y: 20, z: 20 },
    triangleCount: 12,
    watertight: true,
    usedHullFallback: false,
    ...overrides,
  }
}

const cfg = (o: Partial<PartConfig> = {}): PartConfig => ({
  process: 'pla',
  quantity: 1,
  leadTime: 'standard',
  ...o,
})

describe('FDM pricing (weight × rate + machine time, 20% infill)', () => {
  it('PLA 100 cm³ = 5.00 zł', () => {
    // weight 100×1.25×0.2 = 25 g; material 25×50/1000 = 1.25;
    // print 25/12 = 2.0833 h × 1.8 = 3.75; total 5.00
    const q = computePartQuote(metrics({ volumeCm3: 100 }), cfg())
    expect(q.unitPricePln).toBe(5.0)
    expect(q.lineTotalPln).toBe(5.0)
  })
  it('PETG 100 cm³ = 6.29 zł (factor 1.2, 2.25 zł/h)', () => {
    // weight 25.4 g; material 25.4×50×1.2/1000 = 1.524;
    // print 25.4/12 × 2.25 = 4.7625; total 6.2865 → 6.29
    const q = computePartQuote(metrics({ volumeCm3: 100 }), cfg({ process: 'petg' }))
    expect(q.unitPricePln).toBe(6.29)
  })
  it('PA12-CF 100 cm³ = 21.42 zł (factor 2.0, 3.5 zł/h)', () => {
    // weight 21.6 g; material 21.6×350×2/1000 = 15.12;
    // print 21.6/12 = 1.8 h × 3.5 = 6.30; total 21.42
    const q = computePartQuote(metrics({ volumeCm3: 100 }), cfg({ process: 'pa12_cf' }))
    expect(q.unitPricePln).toBe(21.42)
  })
})

describe('minimum part price floor', () => {
  it('small PLA part floors to 1.50 zł', () => {
    // 5 cm³ → base ~0.25 zł, floored to the 1.50 zł part minimum
    const q = computePartQuote(metrics({ volumeCm3: 5 }), cfg())
    expect(q.unitPricePln).toBe(1.5)
  })
})

describe('quantity discount interpolation', () => {
  const cases: Array<[number, number]> = [
    [1, 0],
    [3, 0.025],
    [5, 0.05],
    [7, 0.078],
    [10, 0.12],
    [20, 0.12 + (10 / 15) * 0.08],
    [25, 0.2],
    [37, 0.2 + (12 / 25) * 0.08],
    [50, 0.28],
    [51, 0.28],
    [500, 0.28],
  ]
  for (const [qty, expected] of cases) {
    it(`qty ${qty} → ${expected}`, () => {
      expect(interpolateDiscount(qty)).toBeCloseTo(expected, 10)
    })
  }
})

describe('lead-time multiplier (mapi-tech)', () => {
  it('economy = base × 0.90', () => {
    // PLA 100 cm³ base 5.00 → 4.50
    const q = computePartQuote(metrics({ volumeCm3: 100 }), cfg({ leadTime: 'economy' }))
    expect(q.unitPricePln).toBe(4.5)
  })
  it('express = base × 1.30', () => {
    const q = computePartQuote(metrics({ volumeCm3: 100 }), cfg({ leadTime: 'express' }))
    expect(q.unitPricePln).toBe(6.5)
  })
})

describe('breakdown lines sum to line total', () => {
  const processes = [
    'pla',
    'petg',
    'pctg',
    'asa',
    'petg_fr',
    'pa12_cf',
    'iglidur',
  ] as const
  for (const process of processes) {
    it(process, () => {
      const q = computePartQuote(metrics({ volumeCm3: 142 }), cfg({ process, quantity: 7 }))
      const sum = q.breakdown.reduce((s, l) => s + l.amountPln, 0)
      expect(Math.round(sum * 100) / 100).toBe(q.lineTotalPln)
    })
  }
})

describe('DFM flags', () => {
  it('exceeds the 320 mm build volume → blocked, no alternatives', () => {
    // Every material shares one 320³ envelope, so nothing else fits either.
    const q = computePartQuote(metrics({ bboxMm: { x: 330, y: 330, z: 330 } }), cfg())
    expect(q.blocked).toBe(true)
    const flag = q.dfmFlags.find((f) => f.code === 'exceeds_build_volume')
    expect(flag?.suggestedProcesses).toBeUndefined()
  })
  it('rotation-aware fit: 315×320×318 passes 320³', () => {
    const q = computePartQuote(metrics({ bboxMm: { x: 315, y: 320, z: 318 } }), cfg())
    expect(q.blocked).toBe(false)
  })
  it('smallest dimension < 1mm → feature warning', () => {
    const q = computePartQuote(metrics({ bboxMm: { x: 0.5, y: 20, z: 20 } }), cfg())
    expect(q.dfmFlags.some((f) => f.code === 'small_feature')).toBe(true)
  })
  it('volume < 1cm³ → billed at 1cm³ with info flag', () => {
    const q = computePartQuote(metrics({ volumeCm3: 0.4 }), cfg())
    expect(q.billableVolumeCm3).toBe(1)
    expect(q.unitPricePln).toBe(1.5) // tiny base floored to the part minimum
    expect(q.dfmFlags.some((f) => f.code === 'min_volume_billed')).toBe(true)
  })
  it('non-watertight → geometry approximated', () => {
    const q = computePartQuote(metrics({ usedHullFallback: true }), cfg())
    expect(q.dfmFlags.some((f) => f.code === 'geometry_approximated')).toBe(true)
  })
})

// Helper to build a minimal PartQuote for order-level tests.
function fakeQuote(lineTotalPln: number, blocked = false): PartQuote {
  return {
    blocked,
    billableVolumeCm3: 10,
    unitBasePln: lineTotalPln,
    discountFraction: 0,
    leadTimeMultiplier: 1,
    unitPricePln: lineTotalPln,
    lineTotalPln,
    breakdown: [],
    dfmFlags: [],
    priceBreaks: [],
  }
}

describe('order totals', () => {
  it('minimum order top-up applies when subtotal < 30 zł', () => {
    const t = computeOrderTotals([fakeQuote(4)])
    expect(t.minOrderTopUpPln).toBe(26)
    expect(t.minOrderApplied).toBe(true)
  })
  it('no top-up when subtotal ≥ 30 zł', () => {
    const t = computeOrderTotals([fakeQuote(30)])
    expect(t.minOrderTopUpPln).toBe(0)
    expect(t.minOrderApplied).toBe(false)
  })
  it('shipping 20 zł below 500, free at 500', () => {
    expect(computeOrderTotals([fakeQuote(499.99)]).shippingPln).toBe(20)
    expect(computeOrderTotals([fakeQuote(500)]).shippingPln).toBe(0)
    expect(computeOrderTotals([fakeQuote(500)]).freeShipping).toBe(true)
  })
  it('VAT is 23% of net total', () => {
    const t = computeOrderTotals([fakeQuote(100)])
    // net = 100 + 20 shipping = 120; VAT = 27.60; gross = 147.60
    expect(t.netTotalPln).toBe(120)
    expect(t.vatPln).toBe(27.6)
    expect(t.grossTotalPln).toBe(147.6)
  })
  it('blocked parts are excluded from totals', () => {
    const t = computeOrderTotals([fakeQuote(40), fakeQuote(999, true)])
    expect(t.partsSubtotalPln).toBe(40)
  })
})
