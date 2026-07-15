// Self-contained 3D convex hull (incremental algorithm) used to estimate the
// volume of non-watertight meshes. DOM-free and dependency-free so it runs in
// the worker and is trivially unit-testable. Points are [x,y,z] in mm.

type Vec3 = [number, number, number]

interface Face {
  a: number
  b: number
  c: number
  normal: Vec3
  offset: number // normal · a
}

const EPS = 1e-7

const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const cross = (u: Vec3, v: Vec3): Vec3 => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
]
const dot = (u: Vec3, v: Vec3): number =>
  u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
const norm = (u: Vec3): number => Math.sqrt(dot(u, u))

/** Convert a flat position soup (9 floats/triangle) into a deduped point list. */
export function pointsFromPositions(positions: Float32Array): Vec3[] {
  const seen = new Map<string, Vec3>()
  for (let i = 0; i < positions.length; i += 3) {
    const p: Vec3 = [positions[i], positions[i + 1], positions[i + 2]]
    // Quantize lightly to dedupe coincident vertices.
    const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`
    if (!seen.has(key)) seen.set(key, p)
  }
  return [...seen.values()]
}

function makeFace(
  points: Vec3[],
  a: number,
  b: number,
  c: number,
  interior: Vec3,
): Face {
  let normal = cross(sub(points[b], points[a]), sub(points[c], points[a]))
  const len = norm(normal)
  if (len > 0) normal = [normal[0] / len, normal[1] / len, normal[2] / len]
  let offset = dot(normal, points[a])
  // Orient outward: interior point must be on the negative side.
  if (dot(normal, interior) - offset > 0) {
    normal = [-normal[0], -normal[1], -normal[2]]
    offset = -offset
    return { a, b: c, c: b, normal, offset }
  }
  return { a, b, c, normal, offset }
}

/** Volume (mm³) of the convex hull of a point cloud. Returns 0 for degenerate input. */
export function convexHullVolume(points: Vec3[]): number {
  const n = points.length
  if (n < 4) return 0

  // Cap work for huge clouds by striding (hull is unaffected for our estimate).
  let pts = points
  if (n > 3000) {
    const stride = Math.ceil(n / 3000)
    pts = points.filter((_, i) => i % stride === 0)
  }

  // Find 4 non-coplanar seed points.
  const seed = findInitialTetra(pts)
  if (!seed) return 0
  const [i0, i1, i2, i3] = seed
  const interior: Vec3 = [
    (pts[i0][0] + pts[i1][0] + pts[i2][0] + pts[i3][0]) / 4,
    (pts[i0][1] + pts[i1][1] + pts[i2][1] + pts[i3][1]) / 4,
    (pts[i0][2] + pts[i1][2] + pts[i2][2] + pts[i3][2]) / 4,
  ]

  let faces: Face[] = [
    makeFace(pts, i0, i1, i2, interior),
    makeFace(pts, i0, i1, i3, interior),
    makeFace(pts, i0, i2, i3, interior),
    makeFace(pts, i1, i2, i3, interior),
  ]

  for (let p = 0; p < pts.length; p++) {
    const point = pts[p]
    const visible = faces.filter((f) => dot(f.normal, point) - f.offset > EPS)
    if (visible.length === 0) continue // inside hull

    // Collect horizon edges: edges shared by exactly one visible face.
    const edgeCount = new Map<string, [number, number]>()
    const bump = (u: number, v: number) => {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`
      if (edgeCount.has(key)) edgeCount.delete(key)
      else edgeCount.set(key, [u, v])
    }
    for (const f of visible) {
      bump(f.a, f.b)
      bump(f.b, f.c)
      bump(f.c, f.a)
    }

    const visibleSet = new Set(visible)
    faces = faces.filter((f) => !visibleSet.has(f))
    for (const [u, v] of edgeCount.values()) {
      faces.push(makeFace(pts, u, v, p, interior))
    }
  }

  // Volume via signed tetrahedra about the origin.
  let vol6 = 0
  for (const f of faces) {
    vol6 += dot(pts[f.a], cross(pts[f.b], pts[f.c]))
  }
  return Math.abs(vol6) / 6
}

function findInitialTetra(
  pts: Vec3[],
): [number, number, number, number] | null {
  const n = pts.length
  // First two: farthest-apart along x is a cheap heuristic; just take 0 and the
  // farthest point from it.
  const i0 = 0
  let i1 = -1
  let best = 0
  for (let i = 1; i < n; i++) {
    const d = norm(sub(pts[i], pts[i0]))
    if (d > best) {
      best = d
      i1 = i
    }
  }
  if (i1 < 0 || best < EPS) return null

  // Third: farthest from line i0-i1.
  let i2 = -1
  best = 0
  const line = sub(pts[i1], pts[i0])
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1) continue
    const area = norm(cross(sub(pts[i], pts[i0]), line))
    if (area > best) {
      best = area
      i2 = i
    }
  }
  if (i2 < 0 || best < EPS) return null

  // Fourth: farthest from plane i0-i1-i2.
  const planeNormal = cross(sub(pts[i1], pts[i0]), sub(pts[i2], pts[i0]))
  let i3 = -1
  best = 0
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2) continue
    const d = Math.abs(dot(planeNormal, sub(pts[i], pts[i0])))
    if (d > best) {
      best = d
      i3 = i
    }
  }
  if (i3 < 0 || best < EPS) return null

  return [i0, i1, i2, i3]
}
