import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { PROCESS_IDS, LEAD_TIME_IDS } from '@/lib/pricing-config'

// A small EU country list (shipping destinations). Not exhaustive by design.
export const EU_COUNTRIES = [
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
] as const

const partSchema = z.object({
  fileName: z.string().min(1),
  hash: z.string().min(1),
  process: z.enum(PROCESS_IDS as [string, ...string[]]),
  quantity: z.number().int().min(1),
  leadTime: z.enum(LEAD_TIME_IDS as [string, ...string[]]),
  unitPricePln: z.number().nonnegative(),
  lineTotalPln: z.number().nonnegative(),
})

const submitQuoteSchema = z.object({
  email: z.email(),
  country: z.enum(EU_COUNTRIES),
  parts: z.array(partSchema).min(1).max(5),
  grossTotalPln: z.number().nonnegative(),
  pricesExVat: z.boolean(),
})

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export const submitQuote = createServerFn({ method: 'POST' })
  .validator(submitQuoteSchema)
  .handler(async ({ data }) => {
    const quoteId = makeId('Q')
    console.info('[order] submitQuote', {
      quoteId,
      email: data.email,
      country: data.country,
      parts: data.parts.length,
      grossTotalPln: data.grossTotalPln,
    })
    return { quoteId }
  })

const stepQuoteSchema = z.object({
  email: z.email(),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
})

export const requestStepQuote = createServerFn({ method: 'POST' })
  .validator(stepQuoteSchema)
  .handler(async ({ data }) => {
    const requestId = makeId('STEP')
    console.info('[order] requestStepQuote', {
      requestId,
      email: data.email,
      fileName: data.fileName,
    })
    return { requestId }
  })
