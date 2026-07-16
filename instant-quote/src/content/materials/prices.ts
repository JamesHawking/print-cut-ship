// Typed accessor over the engine-generated reference-price tables
// (reference-prices.json — `make gen-reference-prices`; drift pinned by
// backend/cmd/api tests). Content pages read prices ONLY from here: they are
// prerendered at build time and must not call the API.

import referencePrices from '../reference-prices.json'
import type { PublishedMaterialId } from './slugs'

export const REFERENCE_QUANTITIES = [1, 10, 50] as const
export type ReferenceQuantity = (typeof REFERENCE_QUANTITIES)[number]

export type ReferencePartId = 'bracket' | 'enclosure' | 'housing'

export interface ReferencePart {
  id: ReferencePartId
  volumeCm3: number
  surfaceAreaCm2: number
  bboxMm: { x: number; y: number; z: number }
}

export const REFERENCE_PARTS = referencePrices.parts as ReferencePart[]

const prices = referencePrices.prices as Record<
  PublishedMaterialId,
  Record<ReferencePartId, Record<string, number>>
>

/** Gross PLN unit price (standard lead time) from the committed tables. */
export function referenceUnitPrice(
  material: PublishedMaterialId,
  part: ReferencePartId,
  qty: ReferenceQuantity,
): number {
  return prices[material][part][String(qty)]
}
