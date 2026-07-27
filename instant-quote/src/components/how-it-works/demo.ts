// The demo parts' canonical data: the sample parts the hero's fused console
// quotes live (the first one is also what the price ladder re-quotes in every
// material). No React — everything here is unit-testable (demo.spec.ts) and
// shared between the hero, the ladder, and the Materials specimen grid.

import type { LeadTimeId, ProcessId } from '@/lib/api/client'
import type { MeshMetrics } from '@/lib/mesh/types'

/** Which sample part the intake's Demo tab is showing. */
export type DemoId = 'bracket' | 'bearing' | 'lid'

export interface DemoPart {
  id: DemoId
  /** Persona filename + the byte size of the generated fixture. */
  file: { name: string; bytes: number }
  metrics: MeshMetrics
  config: { process: ProcessId; quantity: number; leadTime: LeadTimeId }
  fallbackQuote: DemoQuote
  fallbackBreakdown: { materialPln: number; machinePln: number }
}

/** The slice of the engine's PartQuote the fallbacks cover. */
export interface DemoQuote {
  lineTotalPln: number
  weightG: number
  printHours: number
}

// Every `metrics` block below was measured by the real mesh pipeline from a
// tests/fixtures/generate.ts geometry, and every `fallback*` block was
// captured from a real engine response for that geometry + config (2026-07-27;
// the bracket's dates back to 2026-07-17/24 and is unchanged). demo.spec.ts
// drift-pins all of it against fresh analyze(parseStl(...)) runs, so a number
// here can never silently diverge from what the engine would actually see.
// Fallbacks are shown only pre-fetch / no-JS / API-down.
//
// Order matters: index 0 is the bracket and is load-bearing — useDemoPrice()
// returns parts[0] for the price ladder and the hero's default.
export const DEMO_PARTS: DemoPart[] = [
  {
    id: 'bracket',
    file: { name: 'bracket_v2.stl', bytes: 1484 },
    metrics: {
      volumeCm3: 67.2,
      rawSignedVolumeCm3: 67.2,
      surfaceAreaCm2: 132.8,
      bboxMm: { x: 96, y: 64, z: 24 },
      triangleCount: 28,
      watertight: true,
      usedHullFallback: false,
    },
    config: { process: 'petg', quantity: 1, leadTime: 'standard' },
    fallbackQuote: { lineTotalPln: 7.78, weightG: 29.2, printHours: 2.68 },
    fallbackBreakdown: { materialPln: 1.75, machinePln: 6.03 },
  },
  {
    // Small and thick in an expensive self-lubricating material — the row
    // that shows what a bearing-grade part costs.
    id: 'bearing',
    file: { name: 'bearing_block.stl', bytes: 684 },
    metrics: {
      volumeCm3: 72,
      rawSignedVolumeCm3: 72,
      surfaceAreaCm2: 108,
      bboxMm: { x: 60, y: 40, z: 30 },
      triangleCount: 12,
      watertight: true,
      usedHullFallback: false,
    },
    config: { process: 'iglidur', quantity: 1, leadTime: 'standard' },
    fallbackQuote: { lineTotalPln: 24.53, weightG: 28.83, printHours: 2.48 },
    fallbackBreakdown: { materialPln: 15.85, machinePln: 8.68 },
  },
  {
    // Large, flat and thin: machine time dominates, which is exactly the
    // lesson the row carries.
    id: 'lid',
    file: { name: 'enclosure_lid.stl', bytes: 684 },
    metrics: {
      volumeCm3: 45,
      rawSignedVolumeCm3: 45,
      surfaceAreaCm2: 315,
      bboxMm: { x: 150, y: 100, z: 3 },
      triangleCount: 12,
      watertight: true,
      usedHullFallback: false,
    },
    config: { process: 'asa', quantity: 1, leadTime: 'standard' },
    fallbackQuote: { lineTotalPln: 15.78, weightG: 33.26, printHours: 3.92 },
    fallbackBreakdown: { materialPln: 5.99, machinePln: 9.79 },
  },
]

// The bracket stays reachable under its original names so the ladder, the
// Materials grid and the compare query keep compiling unchanged.
export const SAMPLE_FILE = DEMO_PARTS[0].file
export const SAMPLE_METRICS = DEMO_PARTS[0].metrics
export const DEMO_CONFIG = DEMO_PARTS[0].config
export const FALLBACK_QUOTE = DEMO_PARTS[0].fallbackQuote
export const FALLBACK_BREAKDOWN = DEMO_PARTS[0].fallbackBreakdown
