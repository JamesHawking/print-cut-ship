import { describe, it, expect } from 'bun:test'
import { parseStl } from '../src/lib/mesh/parse-stl'
import { parseObj } from '../src/lib/mesh/parse-obj'
import { analyze } from '../src/lib/mesh/analyze'
import { parse3mf } from '../src/lib/mesh/parse-3mf'
import { convexHullVolume } from '../src/lib/mesh/hull'
import {
  cubeBinaryStl,
  cubeBinaryStlSolidPrefixed,
  cubeAsciiStl,
  cubeObj,
  openBoxBinaryStl,
  cubeTriangles,
  tetraPoints,
  productionExtension3mf,
} from './fixtures/generate'

describe('10 mm cube (binary STL)', () => {
  const m = analyze(parseStl(cubeBinaryStl(10)))
  it('volume = 1 cm³', () => {
    expect(m.volumeCm3).toBeCloseTo(1, 6)
  })
  it('surface area = 6 cm²', () => {
    expect(m.surfaceAreaCm2).toBeCloseTo(6, 6)
  })
  it('bounding box = 10×10×10 mm', () => {
    expect(m.bboxMm).toEqual({ x: 10, y: 10, z: 10 })
  })
  it('12 triangles, watertight, no hull fallback', () => {
    expect(m.triangleCount).toBe(12)
    expect(m.watertight).toBe(true)
    expect(m.usedHullFallback).toBe(false)
  })
})

describe('format detection & parity', () => {
  it('ASCII STL matches binary', () => {
    const m = analyze(parseStl(cubeAsciiStl(10)))
    expect(m.volumeCm3).toBeCloseTo(1, 6)
    expect(m.triangleCount).toBe(12)
  })
  it('"solid"-prefixed binary STL is parsed as binary', () => {
    const m = analyze(parseStl(cubeBinaryStlSolidPrefixed(10)))
    expect(m.volumeCm3).toBeCloseTo(1, 6)
    expect(m.triangleCount).toBe(12)
  })
  it('OBJ with quad faces → 1 cm³', () => {
    const m = analyze(parseObj(cubeObj(10)))
    expect(m.volumeCm3).toBeCloseTo(1, 6)
  })
})

describe('non-watertight → convex-hull fallback', () => {
  it('reversed winding (negative signed volume) → hull ≈ 1 cm³', () => {
    const m = analyze(parseStl(cubeBinaryStl(10, true)))
    expect(m.watertight).toBe(false)
    expect(m.usedHullFallback).toBe(true)
    expect(m.volumeCm3).toBeCloseTo(1, 4)
  })
  it('open box (missing top face) → hull ≈ 1 cm³', () => {
    const m = analyze(parseStl(openBoxBinaryStl(10)))
    expect(m.watertight).toBe(false)
    expect(m.usedHullFallback).toBe(true)
    expect(m.volumeCm3).toBeCloseTo(1, 4)
  })
})

describe('convex hull volume', () => {
  it('tetrahedron exact volume = 36 mm³', () => {
    expect(convexHullVolume(tetraPoints())).toBeCloseTo(36, 6)
  })
  it('cube corners + interior noise → 1000 mm³', () => {
    const tris = cubeTriangles(10)
    const pts: [number, number, number][] = []
    for (let i = 0; i < tris.length; i += 3) {
      pts.push([tris[i], tris[i + 1], tris[i + 2]])
    }
    // Add interior points that must not change the hull.
    pts.push([5, 5, 5], [3, 4, 6], [7, 2, 8])
    expect(convexHullVolume(pts)).toBeCloseTo(1000, 3)
  })
})

describe('3MF (production extension, split model parts)', () => {
  it('resolves cross-part p:path references → correct volume', () => {
    const m = analyze(parse3mf(productionExtension3mf(10)))
    expect(m.volumeCm3).toBeCloseTo(1, 6)
    expect(m.triangleCount).toBe(12)
    expect(m.watertight).toBe(true)
    expect(m.bboxMm).toEqual({ x: 10, y: 10, z: 10 })
  })

  it('applies the build-item transform (non-uniform scale on X)', () => {
    // Scale X by 2 in the build item's transform matrix.
    const m = analyze(
      parse3mf(
        productionExtension3mf(10, [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      ),
    )
    expect(m.bboxMm).toEqual({ x: 20, y: 10, z: 10 })
    expect(m.volumeCm3).toBeCloseTo(2, 6)
  })
})
