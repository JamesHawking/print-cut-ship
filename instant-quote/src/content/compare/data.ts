// Locale-neutral facts for the comparison pages (seo_prompts/04). TWO kinds
// of numbers live here and ONLY here:
//  - engine-derived values, read from reference-prices.json via the typed
//    accessors (never call the API — these pages prerender at build time);
//  - static externally-sourced figures (aluminum CNC ranges, in-house TCO
//    inputs), each with a source comment and a footnote the copy renders.
//    These are explicitly NOT our quotes.
// PLN amounts are bare numbers with Pln-suffixed names; the `zł` string never
// appears in this file, so no-literal-prices.spec.ts can scan the whole
// compare tree and still guarantee every rendered amount is an interpolation.

import { referenceUnitPrice } from '@/content/materials/prices'
import {
  MIN_ORDER_EXAMPLE,
  PRICING_CATALOG,
  pricingValues,
} from '@/content/pricing/data'
import { MATERIALS } from '@/lib/catalog-static'
import type { CompareSlug } from './slugs'

// Express lead time in business days, from the engine catalog.
const EXPRESS_BUSINESS_DAYS = (
  PRICING_CATALOG.leadTimes as Array<{ id: string; businessDays: number }>
).find((l) => l.id === 'express')!.businessDays

/** Article JSON-LD dates — bump dateModified when a page's copy materially changes. */
export const COMPARE_DATES: Record<
  CompareSlug,
  { datePublished: string; dateModified: string }
> = {
  'asa-vs-petg': { datePublished: '2026-07-17', dateModified: '2026-07-17' },
  'pa-cf-vs-aluminum': {
    datePublished: '2026-07-17',
    dateModified: '2026-07-17',
  },
  'print-in-house-vs-order': {
    datePublished: '2026-07-17',
    dateModified: '2026-07-17',
  },
}

/**
 * Machined aluminum reference for pa-cf-vs-aluminum. Spec figures are typical
 * published 6061-T6 datasheet values [footnote 1]; price and lead-time ranges
 * are the typical spread quoted by EU CNC job shops for a bracket-sized
 * milled part, mid-2026 [footnote 2] — a cited external range, not our quote.
 */
export const ALUMINUM = {
  tensileMPa: 310, // 6061-T6, typical datasheet [1]
  densityGCm3: 2.7, // [1]
  maxServiceC: 150, // conservative continuous-service figure [1]
  toleranceMm: 0.05, // ± mm, standard CNC (ISO 2768-m and finer) [1]
  leadTimeBusinessDaysMin: 10, // typical EU job shop, incl. queue [2]
  leadTimeBusinessDaysMax: 15, // [2]
  // Gross per part, bracket-sized (~80×60×30 mm) 3-axis milled part [2]
  bracketQty1MinPln: 400,
  bracketQty1MaxPln: 900,
  bracketQty10MinPln: 150,
  bracketQty10MaxPln: 350,
  bracketQty50MinPln: 80,
  bracketQty50MaxPln: 200,
}

/**
 * In-house desktop-FDM cost inputs for print-in-house-vs-order. Street
 * prices and rates for Poland, mid-2026 [footnote 1]; failure share for
 * unattended office/hobby printing [footnote 2].
 */
export const IN_HOUSE = {
  printerCostPln: 6500, // enclosed desktop printer + accessories [1]
  printerLifePrintHours: 5000, // service life before major overhaul [1]
  operatorPlnPerHour: 120, // fully-loaded engineer hour, PL [1]
  operatorMinPerJob: 30, // slicing, setup, post-processing, retries
  failureRatePct: 10, // failed or discarded prints [2]
  filamentPlaPlnPerKg: 90, // retail 1 kg PLA spool [1]
  // Worked example part: a one-off bracket-sized print.
  examplePartWeightG: 50,
  examplePartPrintHours: 4,
}

/**
 * The numbers the compare prose interpolates — never write zł amounts as
 * literals in copy. Engine-derived fields come from reference-prices.json;
 * static fields pass through ALUMINUM / IN_HOUSE.
 */
export interface CompareValues {
  // asa-vs-petg (engine)
  petgBracket1Pln: number
  asaBracket1Pln: number
  asaOverPetgPct: number
  petgPlnPerKg: number
  asaPlnPerKg: number
  // pa-cf-vs-aluminum (engine + cited statics)
  paCfBracket1Pln: number
  paCfBracket10Pln: number
  paCfBracket50Pln: number
  aluBracketQty1MinPln: number
  aluBracketQty1MaxPln: number
  aluBracketQty50MinPln: number
  aluBracketQty50MaxPln: number
  aluLeadMinDays: number
  aluLeadMaxDays: number
  // print-in-house-vs-order (statics + derived worked example)
  printerCostPln: number
  operatorPlnPerHour: number
  failureRatePct: number
  filamentPlaPlnPerKg: number
  inHouseMaterialPln: number
  inHouseMachinePln: number
  inHouseOperatorPln: number
  inHouseHobbyPln: number
  inHouseCostedPln: number
  orderedBracketTotalPln: number
  // shared order-side context (engine)
  minOrderPln: number
  expressDays: number
}

const round = (v: number) => Math.round(v * 100) / 100

export function compareValues(): CompareValues {
  const petgBracket1Pln = referenceUnitPrice('petg', 'bracket', 1)
  const asaBracket1Pln = referenceUnitPrice('asa', 'bracket', 1)
  const v = pricingValues()

  const failureFactor = 1 / (1 - IN_HOUSE.failureRatePct / 100)
  const inHouseMaterialPln = round(
    (IN_HOUSE.examplePartWeightG / 1000) * IN_HOUSE.filamentPlaPlnPerKg,
  )
  const inHouseMachinePln = round(
    IN_HOUSE.examplePartPrintHours *
      (IN_HOUSE.printerCostPln / IN_HOUSE.printerLifePrintHours),
  )
  const inHouseOperatorPln = round(
    (IN_HOUSE.operatorMinPerJob / 60) * IN_HOUSE.operatorPlnPerHour,
  )

  return {
    petgBracket1Pln,
    asaBracket1Pln,
    asaOverPetgPct: Math.round((asaBracket1Pln / petgBracket1Pln - 1) * 100),
    petgPlnPerKg: MATERIALS.find((m) => m.id === 'petg')!.plnPerKg,
    asaPlnPerKg: MATERIALS.find((m) => m.id === 'asa')!.plnPerKg,
    paCfBracket1Pln: referenceUnitPrice('pa12_cf', 'bracket', 1),
    paCfBracket10Pln: referenceUnitPrice('pa12_cf', 'bracket', 10),
    paCfBracket50Pln: referenceUnitPrice('pa12_cf', 'bracket', 50),
    aluBracketQty1MinPln: ALUMINUM.bracketQty1MinPln,
    aluBracketQty1MaxPln: ALUMINUM.bracketQty1MaxPln,
    aluBracketQty50MinPln: ALUMINUM.bracketQty50MinPln,
    aluBracketQty50MaxPln: ALUMINUM.bracketQty50MaxPln,
    aluLeadMinDays: ALUMINUM.leadTimeBusinessDaysMin,
    aluLeadMaxDays: ALUMINUM.leadTimeBusinessDaysMax,
    printerCostPln: IN_HOUSE.printerCostPln,
    operatorPlnPerHour: IN_HOUSE.operatorPlnPerHour,
    failureRatePct: IN_HOUSE.failureRatePct,
    filamentPlaPlnPerKg: IN_HOUSE.filamentPlaPlnPerKg,
    inHouseMaterialPln,
    inHouseMachinePln,
    inHouseOperatorPln,
    inHouseHobbyPln: round(
      (inHouseMaterialPln + inHouseMachinePln) * failureFactor,
    ),
    inHouseCostedPln: round(
      (inHouseMaterialPln + inHouseMachinePln + inHouseOperatorPln) *
        failureFactor,
    ),
    orderedBracketTotalPln: MIN_ORDER_EXAMPLE.grossTotalPln,
    minOrderPln: v.minOrderPln,
    expressDays: EXPRESS_BUSINESS_DAYS,
  }
}
