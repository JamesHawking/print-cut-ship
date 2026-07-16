// Typed accessors over the engine-generated pricing-page dataset
// (reference-prices.json — `make gen-reference-prices`; drift pinned in
// backend/cmd/api). The prerendered pricing page reads ONLY from here; the
// volume slider is the page's single deliberate client-side API consumer.

import referencePrices from '../reference-prices.json'

export const PRICING_CATALOG = referencePrices.catalog
export const RATE_CARD = referencePrices.rateCard as Record<
  string,
  Record<string, number>
>
export const RATE_CARD_VOLUMES = [1, 10, 100] as const
export const DISCOUNT_EXAMPLE = referencePrices.discountExample
export const MIN_ORDER_EXAMPLE = referencePrices.minOrderExample
export const SHIP_DATE_EXAMPLES = referencePrices.shipDateExamples as Array<{
  orderIso: string
  afterCutoff: boolean
  shipIso: Record<string, string>
}>

/** The numbers the prose interpolates — never write zł amounts as literals. */
export interface PricingValues {
  minPartPricePln: number
  minOrderPln: number
  orderFeePln: number
  shippingFlatPln: number
  freeShippingThresholdPln: number
  vatPct: number
  maxDiscountPct: number
  cutoffHour: number
}

export function pricingValues(): PricingValues {
  const { fees, discountTiers, sameDayCutoffHour } = PRICING_CATALOG
  return {
    minPartPricePln: fees.minPartPricePln,
    minOrderPln: fees.minOrderPln,
    orderFeePln: fees.orderFeePln,
    shippingFlatPln: fees.shippingFlatPln,
    freeShippingThresholdPln: fees.freeShippingThresholdPln,
    vatPct: Math.round(fees.vatRate * 100),
    maxDiscountPct: Math.round(
      Math.max(...discountTiers.map((t) => t.fraction)) * 100,
    ),
    cutoffHour: sameDayCutoffHour,
  }
}
