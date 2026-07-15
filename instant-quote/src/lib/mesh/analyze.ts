// Geometry analysis from a position soup (9 floats/triangle, mm units).
// Single pass for signed volume, surface area, bbox, triangle count.
// Falls back to convex-hull volume when the mesh isn't watertight.

import type { MeshMetrics } from './types'
import { convexHullVolume, pointsFromPositions } from './hull'
import { MeshParseError } from './parse-stl'

export function analyze(positions: Float32Array): MeshMetrics {
  const triangleCount = Math.floor(positions.length / 9)
  if (triangleCount === 0) {
    throw new MeshParseError('empty', 'Mesh has no triangles.')
  }

  let signedVol6 = 0 // 6× signed volume, mm³
  let area2 = 0 // 2× area, mm²
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (let i = 0; i < triangleCount * 9; i += 9) {
    const ax = positions[i]
    const ay = positions[i + 1]
    const az = positions[i + 2]
    const bx = positions[i + 3]
    const by = positions[i + 4]
    const bz = positions[i + 5]
    const cx = positions[i + 6]
    const cy = positions[i + 7]
    const cz = positions[i + 8]

    // Signed volume: dot(a, cross(b, c))
    const crx = by * cz - bz * cy
    const cry = bz * cx - bx * cz
    const crz = bx * cy - by * cx
    signedVol6 += ax * crx + ay * cry + az * crz

    // Area: |cross(b-a, c-a)| / 2
    const e1x = bx - ax
    const e1y = by - ay
    const e1z = bz - az
    const e2x = cx - ax
    const e2y = cy - ay
    const e2z = cz - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    area2 += Math.sqrt(nx * nx + ny * ny + nz * nz)

    if (ax < minX) minX = ax
    if (ay < minY) minY = ay
    if (az < minZ) minZ = az
    if (ax > maxX) maxX = ax
    if (ay > maxY) maxY = ay
    if (az > maxZ) maxZ = az
    if (bx < minX) minX = bx
    if (by < minY) minY = by
    if (bz < minZ) minZ = bz
    if (bx > maxX) maxX = bx
    if (by > maxY) maxY = by
    if (bz > maxZ) maxZ = bz
    if (cx < minX) minX = cx
    if (cy < minY) minY = cy
    if (cz < minZ) minZ = cz
    if (cx > maxX) maxX = cx
    if (cy > maxY) maxY = cy
    if (cz > maxZ) maxZ = cz
  }

  const bboxMm = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ,
  }
  const bboxVolumeCm3 = (bboxMm.x * bboxMm.y * bboxMm.z) / 1000

  const signedVolumeCm3 = signedVol6 / 6 / 1000
  const rawSignedVolumeCm3 = signedVolumeCm3
  const absVolumeCm3 = Math.abs(signedVolumeCm3)

  // Watertight test: positive signed volume within the bounding box, and — for
  // meshes small enough to check cheaply — every edge shared by exactly two
  // triangles (2-manifold, i.e. actually closed). Skip the edge check on very
  // large meshes for performance; fall back to the sign+bbox heuristic there.
  const signOk = signedVolumeCm3 > 0 && absVolumeCm3 <= bboxVolumeCm3 * 1.001
  const manifold =
    triangleCount >= 200_000 ? true : isEdgeManifold(positions, triangleCount)
  const watertight = signOk && manifold

  let volumeCm3 = absVolumeCm3
  let usedHullFallback = false
  if (!watertight) {
    const hullVolMm3 = convexHullVolume(pointsFromPositions(positions))
    if (hullVolMm3 > 0) {
      volumeCm3 = hullVolMm3 / 1000
      usedHullFallback = true
    }
  }

  return {
    volumeCm3,
    rawSignedVolumeCm3,
    surfaceAreaCm2: area2 / 2 / 100,
    bboxMm,
    triangleCount,
    watertight,
    usedHullFallback,
  }
}

/** True when every edge is shared by exactly two triangles (closed 2-manifold). */
function isEdgeManifold(
  positions: Float32Array,
  triangleCount: number,
): boolean {
  const vertexId = new Map<string, number>()
  const idOf = (i: number): number => {
    const key = `${Math.round(positions[i] * 1e4)},${Math.round(positions[i + 1] * 1e4)},${Math.round(positions[i + 2] * 1e4)}`
    let id = vertexId.get(key)
    if (id === undefined) {
      id = vertexId.size
      vertexId.set(key, id)
    }
    return id
  }

  const edgeCount = new Map<string, number>()
  const bump = (u: number, v: number) => {
    const key = u < v ? `${u}_${v}` : `${v}_${u}`
    edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
  }

  for (let t = 0; t < triangleCount; t++) {
    const i = t * 9
    const a = idOf(i)
    const b = idOf(i + 3)
    const c = idOf(i + 6)
    bump(a, b)
    bump(b, c)
    bump(c, a)
  }

  for (const count of edgeCount.values()) {
    if (count !== 2) return false
  }
  return true
}
