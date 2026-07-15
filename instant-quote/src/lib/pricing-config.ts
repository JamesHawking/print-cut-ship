// All tunable pricing numbers live here. The engine (pricing.ts) reads this
// config and contains no magic numbers, so prices can be tuned without touching
// logic. Rates mirror the Polish FDM service mapi-tech.pl (quoted through its
// SeekMake widget): per-material PLN/kg, density, a per-material price factor,
// and a machine hourly rate, plus mapi-tech's lead-time multipliers and
// order/part minimums. See references/mapi-tech-pricing.md. Currency: PLN.
// Prices are gross (VAT-inclusive), matching how mapi-tech quotes consumers.

export interface BuildVolumeMm {
  x: number
  y: number
  z: number
}

export interface FdmProcess {
  kind: 'fdm'
  label: string
  densityGCm3: number
  plnPerKg: number
  factor: number // per-material price multiplier (mapi-tech "factor")
  plnPerHour: number // machine-time rate
  build: BuildVolumeMm
}

export type ProcessDef = FdmProcess

// mapi-tech runs a single 320×320×320 mm build envelope across all materials.
const FDM_BUILD: BuildVolumeMm = { x: 320, y: 320, z: 320 }

export const PRICING = {
  processes: {
    pla: {
      kind: 'fdm',
      label: 'PLA',
      densityGCm3: 1.25,
      plnPerKg: 50,
      factor: 1.0,
      plnPerHour: 1.8,
      build: FDM_BUILD,
    },
    petg: {
      kind: 'fdm',
      label: 'PETG',
      densityGCm3: 1.27,
      plnPerKg: 50,
      factor: 1.2,
      plnPerHour: 2.25,
      build: FDM_BUILD,
    },
    pctg: {
      kind: 'fdm',
      label: 'PCTG',
      densityGCm3: 1.23,
      plnPerKg: 150,
      factor: 1.0,
      plnPerHour: 2.25,
      build: FDM_BUILD,
    },
    asa: {
      kind: 'fdm',
      label: 'ASA',
      densityGCm3: 1.05,
      plnPerKg: 120,
      factor: 1.5,
      plnPerHour: 2.5,
      build: FDM_BUILD,
    },
    petg_fr: {
      kind: 'fdm',
      label: 'PETG FR (V0)',
      densityGCm3: 1.03,
      plnPerKg: 180,
      factor: 1.0,
      plnPerHour: 2.5,
      build: FDM_BUILD,
    },
    pa12_cf: {
      kind: 'fdm',
      label: 'PA12-CF',
      densityGCm3: 1.08,
      plnPerKg: 350,
      factor: 2.0,
      plnPerHour: 3.5,
      build: FDM_BUILD,
    },
    iglidur: {
      kind: 'fdm',
      label: 'Iglidur I150PF',
      densityGCm3: 1.3,
      plnPerKg: 550,
      factor: 1.0,
      plnPerHour: 3.5,
      build: FDM_BUILD,
    },
  },
  // FDM material/time model. mapi-tech's slicer weighs walls + solid top/bottom
  // plus infilled interior; lacking a slicer we approximate that as a solid
  // shell (surface area × thickness) plus infill of the remaining interior,
  // and estimate print hours from the resulting weight. shellThicknessMm 0.9
  // calibrates the reference part (tests/test_object.step) to within 0.5% of
  // mapi-tech's 33.67 zł. See references/mapi-tech-pricing.md.
  fdm: {
    infillFraction: 0.2, // mapi-tech "Standard 20%" default
    shellThicknessMm: 0.9,
    gramsPerPrintHour: 12,
  },
  // Quantity discount applied to unit price. [quantity, discountFraction].
  discountTiers: [
    [1, 0],
    [5, 0.05],
    [10, 0.12],
    [25, 0.2],
    [50, 0.28],
  ] as ReadonlyArray<readonly [number, number]>,
  // mapi-tech lead-time multipliers and advertised day targets.
  leadTimes: {
    economy: { mult: 0.9, businessDays: 10 }, // "Nie pilne"
    standard: { mult: 1.0, businessDays: 5 },
    express: { mult: 1.3, businessDays: 3 }, // "Ekspres"
  },
  minOrderPln: 30,
  minPartPricePln: 1.5,
  orderFeePln: 1, // flat per-order fee observed in mapi-tech's cart (33.67 → 34.67)
  // Shipping is not part of mapi-tech's extracted config — sensible PL defaults.
  shippingFlatPln: 20,
  freeShippingThresholdPln: 500,
  vatRate: 0.23, // Poland standard rate
  minBillableVolumeCm3: 1,
  minFeatureMm: 1,
  sameDayCutoffHour: 14, // 14:00 Europe/Warsaw
} as const

export type ProcessId = keyof typeof PRICING.processes
export type LeadTimeId = keyof typeof PRICING.leadTimes

export const PROCESS_IDS = Object.keys(PRICING.processes) as ProcessId[]
export const LEAD_TIME_IDS = Object.keys(PRICING.leadTimes) as LeadTimeId[]
export const QUANTITY_CHIPS = [1, 5, 10, 25, 50] as const
