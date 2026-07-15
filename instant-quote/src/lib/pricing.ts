// Pure, deterministic pricing engine. No Date, no randomness, no I/O.
// All numbers come from PRICING (pricing-config.ts). Currency: PLN.

import {
  PRICING,
  type LeadTimeId,
  type ProcessId,
  type ProcessDef,
} from './pricing-config'
import type { MeshMetrics } from './mesh/types'
import { countPlates } from './packing'

export type { LeadTimeId, ProcessId } from './pricing-config'

export interface PartConfig {
  process: ProcessId
  quantity: number
  leadTime: LeadTimeId
}

export interface DfmFlag {
  code:
    | 'exceeds_build_volume'
    | 'small_feature'
    | 'min_volume_billed'
    | 'geometry_approximated'
    | 'multi_plate'
  severity: 'block' | 'warn' | 'info'
  message: string
  suggestedProcesses?: ProcessId[]
}

export interface BreakdownLine {
  key: 'material' | 'machine' | 'finishing' | 'plates'
  label: string
  amountPln: number
}

export interface PriceBreak {
  quantity: number
  unitPricePln: number
}

export interface PartQuote {
  blocked: boolean
  billableVolumeCm3: number
  unitBasePln: number
  discountFraction: number
  leadTimeMultiplier: number
  unitPricePln: number
  lineTotalPln: number
  breakdown: BreakdownLine[]
  dfmFlags: DfmFlag[]
  priceBreaks: PriceBreak[]
  // Present only for multi-piece 3MF parts.
  pieceCount?: number
  plates?: number
}

export interface OrderTotals {
  partsSubtotalPln: number
  minOrderTopUpPln: number
  orderFeePln: number
  shippingPln: number
  netTotalPln: number
  vatPln: number
  grossTotalPln: number
  freeShipping: boolean
  minOrderApplied: boolean
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Piecewise-linear discount fraction for a quantity, clamped outside tiers. */
export function interpolateDiscount(quantity: number): number {
  const tiers = PRICING.discountTiers
  const q = Math.max(1, Math.floor(quantity))
  if (q <= tiers[0][0]) return tiers[0][1]
  const last = tiers[tiers.length - 1]
  if (q >= last[0]) return last[1]
  for (let i = 0; i < tiers.length - 1; i++) {
    const [lo, loD] = tiers[i]
    const [hi, hiD] = tiers[i + 1]
    if (q >= lo && q <= hi) {
      const t = (q - lo) / (hi - lo)
      return loD + t * (hiD - loD)
    }
  }
  return last[1] // unreachable
}

/**
 * Base unit price for a single part before discount & lead-time multiplier.
 * FDM model (mapi-tech): weight approximates a slicer's walls + solid
 * top/bottom as a shell (surface area × thickness, clamped to the part
 * volume) plus infill of the remaining interior; material cost from that
 * weight × per-material rate and factor. Print time books the shell and
 * infill grams at their own throughputs — perimeters extrude far slower
 * than sparse infill, which is what makes thin-walled parts expensive.
 */
function unitBasePrice(
  proc: ProcessDef,
  volumeCm3: number,
  surfaceAreaCm2: number,
): { total: number; lines: BreakdownLine[] } {
  const shellVolCm3 = Math.min(
    volumeCm3,
    surfaceAreaCm2 * (PRICING.fdm.shellThicknessMm / 10),
  )
  const infillVolCm3 = PRICING.fdm.infillFraction * (volumeCm3 - shellVolCm3)
  const shellG = shellVolCm3 * proc.densityGCm3
  const infillG = infillVolCm3 * proc.densityGCm3
  const weightG = shellG + infillG
  const material = (weightG * proc.plnPerKg * proc.factor) / 1000
  const printH =
    shellG / PRICING.fdm.shellGramsPerPrintHour +
    infillG / PRICING.fdm.infillGramsPerPrintHour
  const machine = printH * proc.plnPerHour
  return {
    total: material + machine,
    lines: [
      { key: 'material', label: 'Material', amountPln: material },
      { key: 'machine', label: 'Machine time', amountPln: machine },
      { key: 'finishing', label: 'Finishing', amountPln: 0 },
    ],
  }
}

/** Sorted descending — lets us compare a part against a build box allowing any rotation. */
function sortedDesc(v: { x: number; y: number; z: number }): number[] {
  return [v.x, v.y, v.z].sort((a, b) => b - a)
}

function fitsBuildVolume(
  proc: ProcessDef,
  bboxMm: MeshMetrics['bboxMm'],
): boolean {
  const part = sortedDesc(bboxMm)
  const build = sortedDesc(proc.build)
  return part[0] <= build[0] && part[1] <= build[1] && part[2] <= build[2]
}

function processesThatFit(bboxMm: MeshMetrics['bboxMm']): ProcessId[] {
  return (Object.keys(PRICING.processes) as ProcessId[]).filter((id) =>
    fitsBuildVolume(PRICING.processes[id], bboxMm),
  )
}

export function computePartQuote(
  metrics: MeshMetrics,
  config: PartConfig,
): PartQuote {
  const proc = PRICING.processes[config.process]
  const dfmFlags: DfmFlag[] = []

  // Billable volume: minimum 1 cm³.
  const rawVolume = metrics.volumeCm3
  const billableVolumeCm3 = Math.max(rawVolume, PRICING.minBillableVolumeCm3)
  if (rawVolume < PRICING.minBillableVolumeCm3) {
    dfmFlags.push({
      code: 'min_volume_billed',
      severity: 'info',
      message: `Under 1 cm³ — billed at the ${PRICING.minBillableVolumeCm3} cm³ minimum.`,
    })
  }

  // Approximated geometry from convex-hull fallback.
  if (metrics.usedHullFallback) {
    dfmFlags.push({
      code: 'geometry_approximated',
      severity: 'warn',
      message:
        'Mesh is not watertight — volume estimated from its convex hull. Final price may change.',
    })
  }

  // Smallest feature warning.
  const minDim = Math.min(metrics.bboxMm.x, metrics.bboxMm.y, metrics.bboxMm.z)
  if (minDim < PRICING.minFeatureMm) {
    dfmFlags.push({
      code: 'small_feature',
      severity: 'warn',
      message: `Smallest dimension is ${minDim.toFixed(2)} mm — thin features may not survive printing.`,
    })
  }

  // Build-volume check for the chosen process (blocking). Multi-piece 3MF
  // files are gated piece-by-piece with plate packing — a merged bbox that
  // exceeds the plate is fine as long as every piece fits (possibly across
  // several plates). Single-piece parts keep the rotation-aware bbox check.
  const pieces = metrics.pieces
  const multiPiece = pieces !== undefined && pieces.length >= 2
  let plates = 1
  let fits: boolean
  if (multiPiece) {
    const packOpts = { gutterMm: PRICING.plateGutterMm }
    const counted = countPlates(pieces, proc.build, packOpts)
    fits = counted !== null
    plates = counted ?? 1
    if (!fits) {
      const alternatives = (
        Object.keys(PRICING.processes) as ProcessId[]
      ).filter(
        (id) =>
          countPlates(pieces, PRICING.processes[id].build, packOpts) !== null,
      )
      dfmFlags.push({
        code: 'exceeds_build_volume',
        severity: 'block',
        message: `A piece exceeds the ${proc.build.x}×${proc.build.y}×${proc.build.z} mm build plate.`,
        suggestedProcesses: alternatives.length ? alternatives : undefined,
      })
    } else if (plates > 1) {
      dfmFlags.push({
        code: 'multi_plate',
        severity: 'info',
        message: `${pieces.length} pieces pack onto ${plates} build plates — ${PRICING.extraPlateFeePln} zł per extra plate.`,
      })
    }
  } else {
    fits = fitsBuildVolume(proc, metrics.bboxMm)
    if (!fits) {
      const alternatives = processesThatFit(metrics.bboxMm)
      dfmFlags.push({
        code: 'exceeds_build_volume',
        severity: 'block',
        message: `Part exceeds the ${proc.build.x}×${proc.build.y}×${proc.build.z} mm build volume.`,
        suggestedProcesses: alternatives.length ? alternatives : undefined,
      })
    }
  }

  const base = unitBasePrice(proc, billableVolumeCm3, metrics.surfaceAreaCm2)
  const baseLines = base.lines
  let unitBasePln = base.total
  // Per-unit fee for each plate beyond the first, folded into the base so
  // discounts, lead-time multipliers, and breakdown scaling apply uniformly.
  const plateFeePln = (plates - 1) * PRICING.extraPlateFeePln
  if (plateFeePln > 0) {
    unitBasePln += plateFeePln
    baseLines.push({
      key: 'plates',
      label: `Extra plates (${plates - 1})`,
      amountPln: plateFeePln,
    })
  }
  const discountFraction = interpolateDiscount(config.quantity)
  const leadTimeMultiplier = PRICING.leadTimes[config.leadTime].mult

  const rawUnit = unitBasePln * (1 - discountFraction) * leadTimeMultiplier
  // mapi-tech floors every part at a minimum price.
  const unitPricePln = Math.max(round2(rawUnit), PRICING.minPartPricePln)
  const qty = Math.max(1, Math.floor(config.quantity))
  const lineTotalPln = round2(unitPricePln * qty)

  // Scale breakdown lines to the line total so they sum exactly.
  const scale = unitBasePln > 0 ? lineTotalPln / unitBasePln : 0
  const scaled = baseLines.map((l) => ({
    ...l,
    amountPln: round2(l.amountPln * scale),
  }))
  // Absorb rounding drift into the machine line so lines sum to lineTotal.
  const drift = lineTotalPln - scaled.reduce((s, l) => s + l.amountPln, 0)
  const machineLine = scaled.find((l) => l.key === 'machine')
  if (machineLine) machineLine.amountPln = round2(machineLine.amountPln + drift)

  // Price-break table for the currently-selected process & lead time.
  const priceBreaks: PriceBreak[] = [1, 5, 10, 25, 50].map((q) => ({
    quantity: q,
    unitPricePln: Math.max(
      round2(unitBasePln * (1 - interpolateDiscount(q)) * leadTimeMultiplier),
      PRICING.minPartPricePln,
    ),
  }))

  return {
    blocked: !fits,
    billableVolumeCm3,
    unitBasePln: round2(unitBasePln),
    discountFraction,
    leadTimeMultiplier,
    unitPricePln,
    lineTotalPln,
    breakdown: scaled,
    dfmFlags,
    priceBreaks,
    ...(multiPiece && { pieceCount: pieces.length, plates }),
  }
}

/**
 * Order-level totals: minimum order, flat order fee, shipping. Blocked parts
 * excluded. All prices are gross (VAT-inclusive, like mapi-tech's checkout);
 * vatPln is the included portion, netTotalPln the gross minus that VAT.
 */
export function computeOrderTotals(quotes: PartQuote[]): OrderTotals {
  const active = quotes.filter((q) => !q.blocked)
  const partsSubtotalPln = round2(
    active.reduce((s, q) => s + q.lineTotalPln, 0),
  )

  const minOrderTopUpPln = round2(
    Math.max(0, PRICING.minOrderPln - partsSubtotalPln),
  )
  const minOrderApplied = minOrderTopUpPln > 0

  const afterMin = round2(partsSubtotalPln + minOrderTopUpPln)
  const orderFeePln = active.length > 0 ? PRICING.orderFeePln : 0
  const freeShipping = afterMin >= PRICING.freeShippingThresholdPln
  const shippingPln = freeShipping ? 0 : PRICING.shippingFlatPln

  const grossTotalPln = round2(afterMin + orderFeePln + shippingPln)
  const vatPln = round2(
    (grossTotalPln * PRICING.vatRate) / (1 + PRICING.vatRate),
  )
  const netTotalPln = round2(grossTotalPln - vatPln)

  return {
    partsSubtotalPln,
    minOrderTopUpPln,
    orderFeePln,
    shippingPln,
    netTotalPln,
    vatPln,
    grossTotalPln,
    freeShipping,
    minOrderApplied,
  }
}
