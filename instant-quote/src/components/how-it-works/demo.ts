// The demo bracket's canonical data: the sample part the hero's fused
// console quotes live (and the price ladder re-quotes in every material).
// No React — everything here is unit-testable (demo.spec.ts) and shared
// between the hero, the ladder, and the Materials specimen grid.

import type { MeshMetrics } from '@/lib/mesh/types'

/** The demo's sample part persona. `bytes` matches the generated fixture. */
export const SAMPLE_FILE = { name: 'bracket_v2.stl', bytes: 1484 }

// Measured by the real mesh pipeline from tests/fixtures/generate.ts
// bracketBinaryStl() — demo.spec.ts drift-pins every field against a fresh
// analyze(parseStl(...)) run, so these can never silently diverge from what
// the engine would actually see.
export const SAMPLE_METRICS: MeshMetrics = {
  volumeCm3: 67.2,
  rawSignedVolumeCm3: 67.2,
  surfaceAreaCm2: 132.8,
  bboxMm: { x: 96, y: 64, z: 24 },
  triangleCount: 28,
  watertight: true,
  usedHullFallback: false,
}

/** The exact config the demo's POST /api/v1/price sends (and the hero shows). */
export const DEMO_CONFIG = {
  process: 'petg',
  quantity: 1,
  leadTime: 'standard',
} as const

/** The slice of the engine's PartQuote the fallbacks cover. */
export interface DemoQuote {
  lineTotalPln: number
  weightG: number
  printHours: number
}

// Captured from a real engine response for SAMPLE_METRICS + DEMO_CONFIG
// (2026-07-17). Shown only pre-fetch / no-JS / API-down — the live response
// replaces it the moment the demo-price query resolves. Refresh when pricing
// config changes; the gross line total is a number, never a display string.
export const FALLBACK_QUOTE: DemoQuote = {
  lineTotalPln: 7.78,
  weightG: 29.2,
  printHours: 2.68,
}

// Same capture (2026-07-24), engine breakdown for the hero console's itemized
// rows. Lines are scaled server-side to sum exactly to lineTotalPln
// (demo.spec.ts pins the sum); the zero-amount finishing line is omitted.
export const FALLBACK_BREAKDOWN = {
  materialPln: 1.75,
  machinePln: 6.03,
}
