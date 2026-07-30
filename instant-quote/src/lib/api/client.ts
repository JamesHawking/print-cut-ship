// Typed client for the Go backend (../../../backend). Types are generated
// from its OpenAPI spec into schema.d.ts — regenerate with `make gen-ts`
// in backend/ after any spec change.

import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export const api = createClient<paths>()

// Friendly aliases for the generated schema types. These replace the types
// that lived in src/lib/pricing.ts before pricing moved server-side.
export type ProcessId = components['schemas']['ProcessId']
export type LeadTimeId = components['schemas']['LeadTimeId']
export type NozzleId = components['schemas']['NozzleId']
export type InfillId = components['schemas']['InfillId']
export type ColorId = components['schemas']['ColorId']
export type EuCountry = components['schemas']['EuCountry']
export type PartQuote = components['schemas']['PartQuote']
export type OrderTotals = components['schemas']['OrderTotals']
export type DfmFlag = components['schemas']['DfmFlag']
export type PriceBreak = components['schemas']['PriceBreak']
export type OptionPrice = components['schemas']['OptionPrice']
export type BreakdownLine = components['schemas']['BreakdownLine']
export type Catalog = components['schemas']['CatalogResponse']
export type CatalogProcess = components['schemas']['CatalogProcess']
export type CatalogNozzle = components['schemas']['CatalogNozzle']
export type CatalogInfill = components['schemas']['CatalogInfill']
export type CatalogColor = components['schemas']['CatalogColor']
export type ShipDate = components['schemas']['ShipDate']
export type ApiMeshMetrics = components['schemas']['MeshMetrics']

export interface PartConfig {
  process: ProcessId
  quantity: number
  leadTime: LeadTimeId
  nozzle: NozzleId
  infill: InfillId
  color: ColorId
}

/** The engine's defaults, mirrored from pricing.DefaultNozzleID and friends. */
export const DEFAULT_NOZZLE: NozzleId = 'n04'
export const DEFAULT_INFILL: InfillId = 'standard'
export const DEFAULT_COLOR: ColorId = 'black'

// Runtime mirror of the EuCountry schema enum (openapi-typescript emits
// types only). Order drives the country dropdown.
export const EU_COUNTRIES: EuCountry[] = [
  'PL',
  'DE',
  'FR',
  'NL',
  'BE',
  'CZ',
  'AT',
  'IT',
  'ES',
  'SE',
  'DK',
  'FI',
  'IE',
  'PT',
  'SK',
  'SI',
  'HU',
  'RO',
  'LT',
  'LV',
  'EE',
  'LU',
  'BG',
  'HR',
  'GR',
]

/**
 * One part's entry in a POST /api/v1/price body, and the query-key fragment
 * that identifies it. The hero's single-part query and the quote page's
 * multi-part query must produce byte-identical keys so the quote page renders
 * from cache after the hero auto-navigates — they share these two functions
 * rather than each spelling the fields out, which is how they used to drift.
 */
export function toPricePart(part: {
  metrics: Parameters<typeof toApiMetrics>[0]
  config: PartConfig
}) {
  return {
    metrics: toApiMetrics(part.metrics),
    process: part.config.process,
    quantity: part.config.quantity,
    leadTime: part.config.leadTime,
    nozzle: part.config.nozzle,
    infill: part.config.infill,
    color: part.config.color,
  }
}

export function pricePartKey(part: { hash: string; config: PartConfig }) {
  return [
    part.hash,
    part.config.process,
    part.config.quantity,
    part.config.leadTime,
    part.config.nozzle,
    part.config.infill,
    part.config.color,
  ]
}

/** The pricing-relevant subset of client mesh analysis sent to the API. */
export function toApiMetrics(m: {
  volumeCm3: number
  surfaceAreaCm2: number
  bboxMm: { x: number; y: number; z: number }
  usedHullFallback: boolean
  pieces?: Array<{ bboxMm: { x: number; y: number; z: number } }>
}): ApiMeshMetrics {
  return {
    volumeCm3: m.volumeCm3,
    surfaceAreaCm2: m.surfaceAreaCm2,
    bboxMm: m.bboxMm,
    usedHullFallback: m.usedHullFallback,
    ...(m.pieces && { pieces: m.pieces.map((p) => ({ bboxMm: p.bboxMm })) }),
  }
}
