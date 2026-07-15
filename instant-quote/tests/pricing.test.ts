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
  it('PLA 100 cm³ / 100 cm² = 6.51 zł', () => {
    // shell 11.25 g + infill 22.75 g = 34 g; material 34×50/1000 = 1.70;
    // print 11.25/8 + 22.75/18 = 2.6701 h × 1.8 = 4.8063; total 6.5063 → 6.51
    const q = computePartQuote(metrics(), cfg())
    expect(q.unitPricePln).toBe(6.51)
    expect(q.lineTotalPln).toBe(6.51)
  })
  it('PETG 100 cm³ / 100 cm² = 8.18 zł (factor 1.2, 2.25 zł/h)', () => {
    // shell 11.43 g + infill 23.114 g = 34.544 g; material 34.544×50×1.2/1000
    // = 2.0726; print 11.43/8 + 23.114/18 = 2.7129 h × 2.25 = 6.1039;
    // total 8.1766 → 8.18
    const q = computePartQuote(metrics(), cfg({ process: 'petg' }))
    expect(q.unitPricePln).toBe(8.18)
  })
  it('PA12-CF 100 cm³ / 100 cm² = 28.64 zł (factor 2.0, 3.5 zł/h)', () => {
    // shell 9.72 g + infill 19.656 g = 29.376 g; material 29.376×350×2/1000
    // = 20.5632; print 9.72/8 + 19.656/18 = 2.307 h × 3.5 = 8.0745;
    // total 28.6377 → 28.64
    const q = computePartQuote(metrics(), cfg({ process: 'pa12_cf' }))
    expect(q.unitPricePln).toBe(28.64)
  })
  it('thin part (shell ≥ volume) is billed fully solid', () => {
    // shell min(2, 100×0.09) = 2 cm³ → eff 2 cm³, no infill discount:
    // 2×1.25 = 2.5 g; material 0.125; print 2.5/8×1.8 = 0.5625;
    // total 0.6875 → floor 1.50
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
    // 1.50. Our model: shell min(8, 24×0.09 = 2.16) → shell 2.7432 g +
    // infill 1.4834 g → material 0.2536 + machine 0.9569 = raw 1.21 (matches
    // mapi's raw price) → floor 1.50.
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

describe('thin-walled anchor (Basket.3mf vs mapi-tech, captured 2026-07-15)', () => {
  // Basket.3mf: ribbed thin-walled basket, 130×100×50 mm. Both analyzers
  // agree on volume (mapi 63 495.92 mm³, our parser 63.50 cm³; SA 702.58 cm²).
  // mapi quoted 21.64 zł/part at PLA / 0.4 mm / 20% / Standard. Nearly all
  // of this part is slow perimeter shell — the case the single 12 g/h rate
  // underpriced by 27%.
  it('PLA part prices within 1% of mapi 21.64 zł', () => {
    const q = computePartQuote(
      metrics({
        volumeCm3: 63.5,
        surfaceAreaCm2: 702.58,
        bboxMm: { x: 130, y: 100, z: 50 },
        triangleCount: 21596,
      }),
      cfg(),
    )
    expect(Math.abs(q.unitPricePln - 21.64) / 21.64).toBeLessThan(0.01)
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
    // PLA base 6.5063 → 5.86
    const q = computePartQuote(metrics(), cfg({ leadTime: 'economy' }))
    expect(q.unitPricePln).toBe(5.86)
  })
  it('express = base × 1.30', () => {
    const q = computePartQuote(metrics(), cfg({ leadTime: 'express' }))
    expect(q.unitPricePln).toBe(8.46)
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
  it('exceeds the 340×320×340 mm plate → blocked, no alternatives', () => {
    // Every material shares the one H2S plate, so nothing else fits either.
    const q = computePartQuote(
      metrics({ bboxMm: { x: 350, y: 350, z: 350 } }),
      cfg(),
    )
    expect(q.blocked).toBe(true)
    const flag = q.dfmFlags.find((f) => f.code === 'exceeds_build_volume')
    expect(flag?.suggestedProcesses).toBeUndefined()
  })
  it('rotation-aware fit: 335×320×338 passes 340×320×340', () => {
    const q = computePartQuote(
      metrics({ bboxMm: { x: 335, y: 320, z: 338 } }),
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

describe('multi-piece 3MF plate packing', () => {
  // One plate-filling piece + three mid pieces → packs onto 2 plates even
  // though the merged bbox (438 mm wide) exceeds the 340×320×340 plate.
  const pieces = [
    { bboxMm: { x: 320, y: 300, z: 100 } },
    { bboxMm: { x: 150, y: 150, z: 50 } },
    { bboxMm: { x: 150, y: 150, z: 50 } },
    { bboxMm: { x: 150, y: 150, z: 50 } },
  ]
  const multi = metrics({ bboxMm: { x: 438, y: 150, z: 245 }, pieces })

  it('oversize merged bbox is not blocked when every piece fits', () => {
    const q = computePartQuote(multi, cfg())
    expect(q.blocked).toBe(false)
    expect(q.pieceCount).toBe(4)
    expect(q.plates).toBe(2)
  })
  it('adds one extra-plate fee to the unit price with a breakdown line', () => {
    // PLA base 6.5063 + 10 zł plate fee = 16.5063 → 16.51
    const q = computePartQuote(multi, cfg())
    expect(q.unitPricePln).toBe(16.51)
    const line = q.breakdown.find((l) => l.key === 'plates')
    expect(line?.amountPln).toBe(10)
  })
  it('raises the multi_plate info flag', () => {
    const q = computePartQuote(multi, cfg())
    const flag = q.dfmFlags.find((f) => f.code === 'multi_plate')
    expect(flag?.severity).toBe('info')
  })
  it('breakdown lines still sum to the line total at quantity', () => {
    const q = computePartQuote(multi, cfg({ quantity: 7 }))
    const sum = q.breakdown.reduce((s, l) => s + l.amountPln, 0)
    expect(Math.round(sum * 100) / 100).toBe(q.lineTotalPln)
  })
  it('pieces on a single plate: no fee, no flag', () => {
    const q = computePartQuote(
      metrics({
        bboxMm: { x: 250, y: 100, z: 50 },
        pieces: [
          { bboxMm: { x: 100, y: 100, z: 50 } },
          { bboxMm: { x: 100, y: 100, z: 50 } },
        ],
      }),
      cfg(),
    )
    expect(q.plates).toBe(1)
    expect(q.unitPricePln).toBe(6.51)
    expect(q.breakdown.some((l) => l.key === 'plates')).toBe(false)
    expect(q.dfmFlags.some((f) => f.code === 'multi_plate')).toBe(false)
  })
  it('still blocked when one piece cannot fit any plate', () => {
    const q = computePartQuote(
      metrics({
        bboxMm: { x: 100, y: 100, z: 350 },
        pieces: [
          { bboxMm: { x: 100, y: 100, z: 350 } },
          { bboxMm: { x: 50, y: 50, z: 50 } },
        ],
      }),
      cfg(),
    )
    expect(q.blocked).toBe(true)
    expect(q.dfmFlags.some((f) => f.code === 'exceeds_build_volume')).toBe(true)
    expect(q.dfmFlags.some((f) => f.code === 'multi_plate')).toBe(false)
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
