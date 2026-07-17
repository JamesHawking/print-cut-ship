// English copy for the pricing page — must satisfy the pl.ts shape. All zł
// amounts interpolate from the engine dataset (no-literal-prices.spec.ts).

import { formatDecimal } from '@/lib/format'
import type { PricingCopy } from './pl'

export const enPricingCopy: PricingCopy = {
  metaTitle: '3D printing price list — real rates, no RFQs | MICRO_FACTORY',
  metaDescription:
    'We publish the full FDM rate card: material rates, quantity discounts, lead times and fees. The same numbers the quote form computes with.',
  h1: 'Pricing',
  intro: [
    'Almost no European 3D printing service publishes real prices anymore — everything is "request a quote". We publish everything: rates, discounts, minimums and fees. These are exactly the numbers the quote form computes with; this page and the engine read one configuration.',
    'Below: the formula, the full rate card for seven materials, quantity discounts with a worked example, lead times with concrete ship dates, and the complete list of fees. If it is not listed here, we do not charge it.',
  ],
  formulaIntro:
    'A part price is material plus machine time, scaled by the quantity discount and the lead-time multiplier. Weight is estimated like a slicer: a 0.9 mm shell over the surface plus 20% infill, converted by material density.',
  rateCardNote: (v) =>
    `Unit prices for an idealized cube of the given volume, standard lead time, gross incl. ${v.vatPct}% VAT. Small volumes hit the ${formatDecimal(v.minPartPricePln, 'en', 2, 2)} zł minimum part price — which is why 1 cm³ and 10 cm³ can cost the same.`,
  discountIntro: (v) =>
    `The per-unit discount grows linearly between tiers, up to ${v.maxDiscountPct}% at 50 units and above. The quote form applies the identical discount — exact tiers and a worked example below.`,
  leadIntro: (v) =>
    `Three lead times, one price multiplier. Business days are counted from the order day (the order day itself is not one of them); ordering after ${v.cutoffHour}:00 Warsaw time moves the start of the countdown to the next business day. Two concrete scenarios below.`,
  minimumsIntro: (v) =>
    `The minimum order value is ${v.minOrderPln} zł (a one-time top-up per order). On top of that: a flat ${v.orderFeePln} zł order fee and ${v.shippingFlatPln} zł shipping — free from ${v.freeShippingThresholdPln} zł. Delivery D+1 in Poland and Germany, D+2 across the rest of the EU.`,
  minOrderExampleNote: (v) =>
    `The example below: a single small bracket does not reach ${v.minOrderPln} zł, so you can see exactly what the top-up amounts to. With two or three parts the minimum usually stops mattering.`,
  noHidden: (v) => [
    `No file fees, no setup fees, no "we'll get back to you with a custom quote". The only line items beyond part prices: the ${v.orderFeePln} zł order fee and shipping.`,
    `All prices are gross — ${v.vatPct}% VAT (PL) is included, never added at the end. The quote form has an ex-VAT toggle for the breakdown view; the amount you pay does not change.`,
  ],
  comparison: [
    'Honestly: for large, simple parts with no deadline, an Asian supplier can be cheaper — bigger scale, lower labor rates. If you have three weeks of slack and the part needs no iteration, it is worth comparing.',
    'We win where time and the revision loop matter: shipping in 3 business days instead of weeks, the next revision at the same price, and no customs or import-tax risk from outside the EU. For functional parts at typical sizes, the real gap is often smaller than catalog rates suggest.',
  ],
  faq: [
    {
      q: 'Why does my order cost more than the sum of the parts?',
      a: (v) =>
        `Beyond the part prices there is a flat ${v.orderFeePln} zł order fee and ${v.shippingFlatPln} zł shipping (free from ${v.freeShippingThresholdPln} zł). If the parts subtotal stays under ${v.minOrderPln} zł, a one-time top-up to the minimum applies.`,
    },
    {
      q: 'Do prices include VAT?',
      a: (v) =>
        `Yes — every price on this page and in the form is gross, incl. ${v.vatPct}% VAT (PL). Use the toggle in the quote to view net prices.`,
    },
    {
      q: 'What does shipping cost and how long does it take?',
      a: (v) =>
        `Shipping is ${v.shippingFlatPln} zł, free from ${v.freeShippingThresholdPln} zł. Parcels dispatched after printing arrive D+1 in Poland and Germany, D+2 across the rest of the EU.`,
    },
    {
      q: 'How do quantity discounts work?',
      a: (v) =>
        `The per-unit discount grows with quantity — tiers are in the table above, up to ${v.maxDiscountPct}% from 50 units. Between tiers the discount interpolates linearly, so 7 units get a sensible price too.`,
    },
    {
      q: 'How does payment work?',
      a: () =>
        'Right now placing an order reserves your quote — we follow up with a confirmation and invoice. Online payments (including BLIK and P24) are in the works.',
    },
    {
      q: 'How long is a quote valid?',
      a: () =>
        'Quotes and files are retained for 14 days. After that, just re-upload the file — the quote recomputes from the current configuration in seconds.',
    },
  ],
}
