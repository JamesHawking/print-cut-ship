import { describe, expect, test } from 'bun:test'
import { parseStl } from '@/lib/mesh/parse-stl'
import { bracketBinaryStl } from '../../../tests/fixtures/generate'
import {
  BRACKET_EDGES_MM,
  BRACKET_WIREFRAME,
  project,
  type EdgeMm,
} from './bracket-svg'

// The wireframe's honesty contract: BRACKET_EDGES_MM must be exactly the
// crease edges of the STL the demo claims to measure — no hand-drawn
// lookalike. Recomputed here from the parsed triangles: an edge is a crease
// when its two adjacent faces are not coplanar (cap triangulation diagonals
// fail this test, profile edges and verticals pass it).

type V3 = [number, number, number]

function triSoup(buf: ArrayBuffer): V3[][] {
  const f = parseStl(buf)
  const tris: V3[][] = []
  for (let t = 0; t < f.length; t += 9) {
    tris.push([
      [f[t], f[t + 1], f[t + 2]],
      [f[t + 3], f[t + 4], f[t + 5]],
      [f[t + 6], f[t + 7], f[t + 8]],
    ])
  }
  return tris
}

function normal([a, b, c]: V3[]): V3 {
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n: V3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ]
  const len = Math.hypot(...n)
  return [n[0] / len, n[1] / len, n[2] / len]
}

const ptKey = (p: V3) => p.map((c) => c.toFixed(2)).join(',')
const edgeKey = (a: V3, b: V3) => [ptKey(a), ptKey(b)].sort().join('|')

function creaseEdges(buf: ArrayBuffer): Set<string> {
  const byEdge = new Map<string, V3[]>()
  for (const tri of triSoup(buf)) {
    const n = normal(tri)
    for (let i = 0; i < 3; i++) {
      const key = edgeKey(tri[i], tri[(i + 1) % 3])
      const list = byEdge.get(key) ?? []
      list.push(n)
      byEdge.set(key, list)
    }
  }
  const creases = new Set<string>()
  for (const [key, ns] of byEdge) {
    const coplanar =
      ns.length > 1 &&
      ns.every(
        (n) =>
          Math.abs(n[0] * ns[0][0] + n[1] * ns[0][1] + n[2] * ns[0][2]) >
          1 - 1e-3,
      )
    if (!coplanar) creases.add(key)
  }
  return creases
}

const mmEdgeKey = (e: EdgeMm) => edgeKey([e[0], e[1], e[2]], [e[3], e[4], e[5]])

describe('bracket wireframe drift', () => {
  test('BRACKET_EDGES_MM is exactly the STL crease-edge set', () => {
    const expected = creaseEdges(bracketBinaryStl())
    const actual = new Set(BRACKET_EDGES_MM.map(mmEdgeKey))
    expect(actual.size).toBe(BRACKET_EDGES_MM.length) // no duplicates
    expect(actual).toEqual(expected)
  })

  test('projection is the documented dimetric camera', () => {
    const cos30 = Math.cos(Math.PI / 6)
    expect(project(0, 0, 0)).toEqual([0, 0])
    expect(project(96, 0, 0)).toEqual([96 * cos30, 48])
    expect(project(0, 0, 24)).toEqual([0, -24]) // z is up (screen-y negative)
  })

  test('viewBox contains every drawn line and label', () => {
    const [, , w, h] = BRACKET_WIREFRAME.viewBox.split(' ').map(Number)
    const lines = [
      ...BRACKET_WIREFRAME.edges,
      ...BRACKET_WIREFRAME.dims.flatMap((d) => [d.line, ...d.ticks]),
    ]
    for (const l of lines) {
      for (const [x, y] of [
        [l.x1, l.y1],
        [l.x2, l.y2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(w)
        expect(y).toBeLessThanOrEqual(h)
      }
    }
    for (const d of BRACKET_WIREFRAME.dims) {
      expect(d.labelX).toBeGreaterThanOrEqual(0)
      expect(d.labelX).toBeLessThanOrEqual(w)
      expect(d.labelY).toBeGreaterThanOrEqual(0)
      expect(d.labelY).toBeLessThanOrEqual(h)
    }
  })

  test('dims carry the bbox values the log announces', () => {
    expect(BRACKET_WIREFRAME.dims.map((d) => d.mm)).toEqual([96, 64, 24])
  })

  test('top face is the 8-point L-profile, inside the viewBox', () => {
    const [, , w, h] = BRACKET_WIREFRAME.viewBox.split(' ').map(Number)
    expect(BRACKET_WIREFRAME.topFace).toHaveLength(8)
    for (const p of BRACKET_WIREFRAME.topFace) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(w)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(h)
    }
  })
})
