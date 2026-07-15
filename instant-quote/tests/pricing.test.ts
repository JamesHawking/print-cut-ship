import { describe, it, expect } from 'bun:test'
import {
  computePartQuote,
  computeOrderTotals,
  interpolateDiscount,
  type PartConfig,
  type PartQuote,
} from '../src/lib/pricing'
import type { MeshMetrics } from '../src/lib/mesh/types'

// Default part: 100 cm³ / 100 cm² → shell 100×0.09 = 9 cm³ solid, interior
// 91 cm³ at 20% infill → effective volume 27.2 cm³.
function metrics(overrides: Partial<MeshMetrics> = {}): MeshMetrics {
  return {
    volumeCm3: 100,
    rawSignedVolumeCm3: 100,
    surfaceAreaCm2: 100,
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

describe('FDM pricing (shell + 20% infill weight × rate + machine time)', () => {
  it('PLA 100 cm³ / 100 cm² = 6.80 zł', () => {
    // eff 27.2 cm³ × 1.25 = 34 g; material 34×50/1000 = 1.70;
    // print 34/12 = 2.8333 h × 1.8 = 5.10; total 6.80
    const q = computePartQuote(metrics(), cfg())
    expect(q.unitPricePln).toBe(6.8)
    expect(q.lineTotalPln).toBe(6.8)
  })
  it('PETG 100 cm³ / 100 cm² = 8.55 zł (factor 1.2, 2.25 zł/h)', () => {
    // eff 27.2 × 1.27 = 34.544 g; material 34.544×50×1.2/1000 = 2.0726;
    // print 34.544/12 × 2.25 = 6.477; total 8.5496 → 8.55
    const q = computePartQuote(metrics(), cfg({ process: 'petg' }))
    expect(q.unitPricePln).toBe(8.55)
  })
  it('PA12-CF 100 cm³ / 100 cm² = 29.13 zł (factor 2.0, 3.5 zł/h)', () => {
    // eff 27.2 × 1.08 = 29.376 g; material 29.376×350×2/1000 = 20.5632;
    // print 29.376/12 = 2.448 h × 3.5 = 8.568; total 29.1312 → 29.13
    const q = computePartQuote(metrics(), cfg({ process: 'pa12_cf' }))
    expect(q.unitPricePln).toBe(29.13)
  })
  it('thin part (shell ≥ volume) is billed fully solid', () => {
    // shell min(2, 100×0.09) = 2 cm³ → eff 2 cm³, no infill discount:
    // 2×1.25 = 2.5 g; material 0.125; print 2.5/12×1.8 = 0.375; total 0.50 → floor 1.50
    const q = computePartQuote(
      metrics({ volumeCm3: 2, surfaceAreaCm2: 100 }),
      cfg(),
    )
    expect(q.unitPricePln).toBe(1.5)
  })
})

describe('minimum part price floor', () => {
  it('small PETG part floors to 1.50 zł (mapi 20 mm cube anchor)', () => {
    // mapi's widget slices a 20 mm PETG cube to a raw ≈1.21 zł, floored to
    // 1.50. Our model: shell min(8, 24×0.09 = 2.16) → eff 3.328 cm³ →
    // 4.2266 g → material 0.2536 + machine 0.7925 = 1.05 → floor 1.50.
    const q = computePartQuote(
      metrics({
        volumeCm3: 8,
        surfaceAreaCm2: 24,
        bboxMm: { x: 20, y: 20, z: 20 },
      }),
      cfg({ process: 'petg' }),
    )
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
    // PLA base 6.80 → 6.12
    const q = computePartQuote(metrics(), cfg({ leadTime: 'economy' }))
    expect(q.unitPricePln).toBe(6.12)
  })
  it('express = base × 1.30', () => {
    const q = computePartQuote(metrics(), cfg({ leadTime: 'express' }))
    expect(q.unitPricePln).toBe(8.84)
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
      const q = computePartQuote(
        metrics({ volumeCm3: 142 }),
        cfg({ process, quantity: 7 }),
      )
      const sum = q.breakdown.reduce((s, l) => s + l.amountPln, 0)
      expect(Math.round(sum * 100) / 100).toBe(q.lineTotalPln)
    })
  }
})

describe('DFM flags', () => {
  it('exceeds the 320 mm build volume → blocked, no alternatives', () => {
    // Every material shares one 320³ envelope, so nothing else fits either.
    const q = computePartQuote(
      metrics({ bboxMm: { x: 330, y: 330, z: 330 } }),
      cfg(),
    )
    expect(q.blocked).toBe(true)
    const flag = q.dfmFlags.find((f) => f.code === 'exceeds_build_volume')
    expect(flag?.suggestedProcesses).toBeUndefined()
  })
  it('rotation-aware fit: 315×320×318 passes 320³', () => {
    const q = computePartQuote(
      metrics({ bboxMm: { x: 315, y: 320, z: 318 } }),
      cfg(),
    )
    expect(q.blocked).toBe(false)
  })
  it('smallest dimension < 1mm → feature warning', () => {
    const q = computePartQuote(
      metrics({ bboxMm: { x: 0.5, y: 20, z: 20 } }),
      cfg(),
    )
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
    expect(q.dfmFlags.some((f) => f.code === 'geometry_approximated')).toBe(
      true,
    )
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
  it('flat 1 zł order fee applies once per order', () => {
    expect(computeOrderTotals([fakeQuote(100)]).orderFeePln).toBe(1)
    expect(computeOrderTotals([fakeQuote(50), fakeQuote(50)]).orderFeePln).toBe(
      1,
    )
    expect(computeOrderTotals([]).orderFeePln).toBe(0)
    expect(computeOrderTotals([fakeQuote(999, true)]).orderFeePln).toBe(0)
  })
  it('totals are gross — VAT is included, not added on top', () => {
    const t = computeOrderTotals([fakeQuote(100)])
    // gross = 100 + 1 fee + 20 shipping = 121; included VAT = 121×0.23/1.23
    // = 22.63; net = 98.37
    expect(t.grossTotalPln).toBe(121)
    expect(t.vatPln).toBe(22.63)
    expect(t.netTotalPln).toBe(98.37)
    expect(Math.round((t.netTotalPln + t.vatPln) * 100) / 100).toBe(
      t.grossTotalPln,
    )
  })
  it('blocked parts are excluded from totals', () => {
    const t = computeOrderTotals([fakeQuote(40), fakeQuote(999, true)])
    expect(t.partsSubtotalPln).toBe(40)
  })
})

describe('price is monotonic in part size', () => {
  it('more volume at fixed surface area never costs less', () => {
    const volumes = [50, 100, 200, 400]
    const prices = volumes.map(
      (volumeCm3) =>
        computePartQuote(metrics({ volumeCm3 }), cfg({ process: 'petg' }))
          .unitPricePln,
    )
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1])
    }
  })
  it('more surface area at fixed volume never costs less', () => {
    const areas = [50, 100, 200, 400]
    const prices = areas.map(
      (surfaceAreaCm2) =>
        computePartQuote(metrics({ surfaceAreaCm2 }), cfg({ process: 'petg' }))
          .unitPricePln,
    )
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })
})
