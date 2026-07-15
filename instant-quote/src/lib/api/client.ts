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
export type EuCountry = components['schemas']['EuCountry']
export type PartQuote = components['schemas']['PartQuote']
export type OrderTotals = components['schemas']['OrderTotals']
export type DfmFlag = components['schemas']['DfmFlag']
export type PriceBreak = components['schemas']['PriceBreak']
export type BreakdownLine = components['schemas']['BreakdownLine']
export type Catalog = components['schemas']['CatalogResponse']
export type CatalogProcess = components['schemas']['CatalogProcess']
export type ShipDate = components['schemas']['ShipDate']
export type ApiMeshMetrics = components['schemas']['MeshMetrics']

export interface PartConfig {
  process: ProcessId
  quantity: number
  leadTime: LeadTimeId
}

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
