// Generates backend/internal/mesh/testdata/golden.json from the REAL TS mesh
// pipeline (parse-stl/parse-obj/parse-3mf + analyze), so the Go port is pinned
// to the client's behavior. Run manually (not picked up by the test glob):
//
//   cd instant-quote && bun tests/golden/mesh-generate.ts
//
// Comparison policy on the Go side is TOLERANCE-based (relative 1e-6), not
// bit-exact: the Go engine is authoritative at quote time, so the engines only
// need to agree within noise. Cases where TS used its convex-hull fallback
// (usedHullFallback: true) are still emitted verbatim — the Go test asserts
// only the hull-independent fields for those (Go has no hull).

import { parseStl } from '../../src/lib/mesh/parse-stl'
import { parseObj } from '../../src/lib/mesh/parse-obj'
import { parse3mfParts } from '../../src/lib/mesh/parse-3mf'
import { analyze } from '../../src/lib/mesh/analyze'
import { MeshParseError } from '../../src/lib/mesh/parse-stl'
import type { MeshMetrics } from '../../src/lib/mesh/types'
import {
  cubeBinaryStl,
  cubeBinaryStlSolidPrefixed,
  cubeAsciiStl,
  cubeObj,
  openBoxBinaryStl,
  productionExtension3mf,
  multiItem3mf,
} from '../fixtures/generate'

interface MetricsCase {
  name: string
  kind: 'stl' | 'obj' | '3mf'
  dataB64: string
  expected: MeshMetrics
}
interface ErrorCase {
  name: string
  kind: 'stl' | 'obj' | '3mf'
  dataB64: string
  expectedCode: 'corrupt' | 'empty' | 'unsupported'
}

function b64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
}

// Mirrors useMeshWorker.analyze()'s 3MF branch: per-piece bboxes when the
// build has ≥2 items, merged soup for the geometry math.
function analyzeBuffer(kind: MetricsCase['kind'], buffer: ArrayBuffer) {
  if (kind === 'stl') return analyze(parseStl(buffer))
  if (kind === 'obj') return analyze(parseObj(buffer))
  const parts = parse3mfParts(buffer)
  let pieces: MeshMetrics['pieces']
  if (parts.length >= 2) {
    pieces = parts.map((p) => ({ bboxMm: positionsBbox(p) }))
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const p of parts) {
    merged.set(p, offset)
    offset += p.length
  }
  const metrics = analyze(merged)
  if (pieces) metrics.pieces = pieces
  return metrics
}

function positionsBbox(positions: Float32Array) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
}

const metricsInputs: Array<{
  name: string
  kind: MetricsCase['kind']
  buffer: ArrayBuffer
}> = [
  { name: 'cube binary stl s=10', kind: 'stl', buffer: cubeBinaryStl(10) },
  { name: 'cube binary stl s=7.3', kind: 'stl', buffer: cubeBinaryStl(7.3) },
  {
    name: 'cube binary stl s=10 reversed (hull fallback in TS)',
    kind: 'stl',
    buffer: cubeBinaryStl(10, true),
  },
  {
    name: 'cube binary stl s=10 solid-prefixed header',
    kind: 'stl',
    buffer: cubeBinaryStlSolidPrefixed(10),
  },
  { name: 'cube ascii stl s=10', kind: 'stl', buffer: cubeAsciiStl(10) },
  { name: 'cube ascii stl s=0.1', kind: 'stl', buffer: cubeAsciiStl(0.1) },
  { name: 'cube obj s=10', kind: 'obj', buffer: cubeObj(10) },
  { name: 'cube obj s=3.7', kind: 'obj', buffer: cubeObj(3.7) },
  {
    name: 'open box stl s=10 (manifold fail, hull fallback in TS)',
    kind: 'stl',
    buffer: openBoxBinaryStl(10),
  },
  {
    name: 'open box stl s=25 (manifold fail, hull fallback in TS)',
    kind: 'stl',
    buffer: openBoxBinaryStl(25),
  },
  {
    name: 'production-extension 3mf s=10 identity',
    kind: '3mf',
    buffer: productionExtension3mf(10),
  },
  {
    name: 'production-extension 3mf s=10 scale-x2',
    kind: '3mf',
    buffer: productionExtension3mf(10, [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  },
  {
    name: 'production-extension 3mf s=10 rot90z+translate',
    kind: '3mf',
    buffer: productionExtension3mf(10, [0, 1, 0, -1, 0, 0, 0, 0, 1, 5, 7, -3]),
  },
  {
    name: 'multi-item 3mf s=10 count=3 spacing=20 (pieces)',
    kind: '3mf',
    buffer: multiItem3mf(10, 3, 20),
  },
  {
    name: 'multi-item 3mf s=10 count=2 spacing=15 (pieces threshold)',
    kind: '3mf',
    buffer: multiItem3mf(10, 2, 15),
  },
  {
    name: 'multi-item 3mf s=10 count=1 (no pieces field)',
    kind: '3mf',
    buffer: multiItem3mf(10, 1),
  },
]

// 84-byte binary STL header claiming zero triangles.
function zeroTriBinaryStl(): ArrayBuffer {
  const buffer = new ArrayBuffer(84)
  new DataView(buffer).setUint32(80, 0, true)
  return buffer
}

const errorInputs: Array<{
  name: string
  kind: ErrorCase['kind']
  buffer: ArrayBuffer
}> = [
  { name: 'empty buffer as stl', kind: 'stl', buffer: new ArrayBuffer(0) },
  {
    name: '84-byte zero-triangle binary stl',
    kind: 'stl',
    buffer: zeroTriBinaryStl(),
  },
  {
    name: 'plain text as stl',
    kind: 'stl',
    buffer: new TextEncoder().encode('hello, not a mesh at all').buffer,
  },
  {
    name: 'obj vertices without faces',
    kind: 'obj',
    buffer: new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\n').buffer,
  },
  {
    name: 'non-zip bytes as 3mf',
    kind: '3mf',
    buffer: new TextEncoder().encode('PK-but-not-really-a-zip-archive').buffer,
  },
]

const metrics: MetricsCase[] = metricsInputs.map(({ name, kind, buffer }) => ({
  name,
  kind,
  dataB64: b64(buffer),
  expected: analyzeBuffer(kind, buffer),
}))

const errors: ErrorCase[] = errorInputs.map(({ name, kind, buffer }) => {
  try {
    analyzeBuffer(kind, buffer)
  } catch (e) {
    if (e instanceof MeshParseError) {
      return { name, kind, dataB64: b64(buffer), expectedCode: e.code }
    }
    throw e
  }
  throw new Error(`error case "${name}" unexpectedly parsed`)
})

const out = `${JSON.stringify({ metrics, errors }, null, 1)}\n`
const dest = new URL(
  '../../../backend/internal/mesh/testdata/golden.json',
  import.meta.url,
)
await Bun.write(dest, out)
console.log(
  `wrote ${metrics.length} metrics + ${errors.length} error cases to ${dest.pathname}`,
)
