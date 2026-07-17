// Pure data + script logic for the "How it works" live demo run. No React —
// everything here is unit-testable (demo.spec.ts) and shared between the
// animated playback and the SSR done-state.

import type { Dictionary, Locale } from '@/lib/i18n'
import { formatDecimal, formatDims, formatInt, formatPln } from '@/lib/format'
import type { MeshMetrics } from '@/lib/mesh/types'

export type Stage = 'recv' | 'measure' | 'price' | 'order' | 'ship' | 'done'

export interface LogLine {
  stage: Stage
  /** Mono log tag (RECV/MEASURE/…); absent on the `$ quote …` command line. */
  tag?: string
  text: string
  /** Delay before this line appears, ms. */
  delayMs: number
  /** Emphasized line (the engine's answer, the DONE line). */
  strong?: boolean
}

/** Which rail anchor each stage parks the dot on: stations 0-2, SHIPS chip 3. */
export const STAGE_ANCHOR: Record<Stage, 0 | 1 | 2 | 3> = {
  recv: 0,
  measure: 0,
  price: 1,
  order: 2,
  ship: 3,
  done: 3,
}

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

/** The exact config the demo's POST /api/v1/price sends (and the PRICE line shows). */
export const DEMO_CONFIG = {
  process: 'petg',
  quantity: 1,
  leadTime: 'standard',
} as const

/** The slice of the engine's PartQuote the log consumes. */
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

/**
 * The full machine log for one demo run. Pure: prerender and hydration call
 * it with `quote`/`expressWeekday` undefined (fallbacks bake in), and the
 * script self-upgrades to live numbers when the queries resolve.
 */
export function buildScript(
  demo: Dictionary['process']['demo'],
  locale: Locale,
  quote: DemoQuote | undefined,
  expressWeekday: string | undefined,
): LogLine[] {
  const q = quote ?? FALLBACK_QUOTE
  const m = SAMPLE_METRICS
  const sizeKb = formatDecimal(
    Math.round(SAMPLE_FILE.bytes / 100) / 10,
    locale,
    1,
  )
  const dims = formatDims(m.bboxMm, locale)
  return [
    { stage: 'recv', text: demo.cmd(SAMPLE_FILE.name), delayMs: 300 },
    {
      stage: 'recv',
      tag: demo.tags.recv,
      text: demo.recv(SAMPLE_FILE.name, `${sizeKb} KB`),
      delayMs: 500,
    },
    {
      stage: 'measure',
      tag: demo.tags.measure,
      text: demo.measureMesh(formatInt(m.triangleCount, locale)),
      delayMs: 700,
    },
    {
      stage: 'measure',
      tag: demo.tags.measure,
      text: demo.measureDims(
        `${formatDecimal(m.volumeCm3, locale, 1)} cm³`,
        dims,
      ),
      delayMs: 550,
    },
    {
      stage: 'price',
      tag: demo.tags.price,
      text: demo.priceConfig,
      delayMs: 600,
    },
    {
      stage: 'price',
      tag: demo.tags.price,
      text: demo.priceResult(
        formatPln(q.lineTotalPln, locale),
        formatInt(Math.round(q.weightG), locale),
        formatDecimal(q.printHours, locale, 1),
      ),
      delayMs: 900,
      strong: true,
    },
    { stage: 'order', tag: demo.tags.order, text: demo.order1, delayMs: 650 },
    { stage: 'order', tag: demo.tags.order, text: demo.order2, delayMs: 550 },
    {
      stage: 'ship',
      tag: demo.tags.ship,
      text: expressWeekday ? demo.ship(expressWeekday) : demo.shipFallback,
      delayMs: 800,
    },
    {
      stage: 'done',
      tag: demo.tags.done,
      text: demo.done,
      delayMs: 700,
      strong: true,
    },
  ]
}
