// Wireframe data for the bracket panel: the crease edges of the SAME
// L-bracket prism the demo quotes (tests/fixtures/generate.ts
// bracketBinaryStl), projected to 2D with an orthographic isometric camera.
// Pure data + math, no React — drift-pinned against the parsed STL in
// bracket-svg.spec.ts, the same honesty contract as SAMPLE_METRICS.

/** One 3D edge in millimetres: [x1, y1, z1, x2, y2, z2]. */
export type EdgeMm = readonly [number, number, number, number, number, number]

// The fixture's L-profile (CCW) and extrusion depth. Cap-triangulation
// diagonals are NOT geometry — the wireframe is profile edges + verticals.
const PROFILE_MM: readonly (readonly [number, number])[] = [
  [0, 0],
  [20, 0],
  [96, 0],
  [96, 20],
  [20, 20],
  [20, 64],
  [0, 64],
  [0, 20],
]
const DEPTH_MM = 24

/** Crease edges of the bracket prism in mm: profile edges top + bottom, plus
 *  the vertical at each profile CORNER. Vertices where the profile runs
 *  straight through (collinear neighbours — (20,0) and (0,20) here) get no
 *  vertical: both adjacent walls are coplanar, so there is no edge to draw. */
export const BRACKET_EDGES_MM: EdgeMm[] = (() => {
  const edges: EdgeMm[] = []
  const n = PROFILE_MM.length
  for (let i = 0; i < n; i++) {
    const [x1, y1] = PROFILE_MM[i]
    const [x2, y2] = PROFILE_MM[(i + 1) % n]
    edges.push([x1, y1, 0, x2, y2, 0])
    edges.push([x1, y1, DEPTH_MM, x2, y2, DEPTH_MM])
    const [px, py] = PROFILE_MM[(i - 1 + n) % n]
    const collinear = (x1 - px) * (y2 - y1) === (y1 - py) * (x2 - x1)
    if (!collinear) edges.push([x1, y1, 0, x1, y1, DEPTH_MM])
  }
  return edges
})()

// Classic dimetric: viewer in the (+x, +y, +z) octant, so the L-shaped top
// face (the profile) reads clearly and the two outer arm faces show.
const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5

export function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS30, (x + y) * SIN30 - z]
}

export interface WireframeLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface WireframeDim {
  /** Dimension line (offset outward from the part, in projected space). */
  line: WireframeLine
  /** Short extension ticks at both ends, pointing back toward the part. */
  ticks: [WireframeLine, WireframeLine]
  /** Label anchor (middle text-anchor). Value is formatted by the caller. */
  labelX: number
  labelY: number
  /** The dimension in mm — formatted via formatMm in the component. */
  mm: number
}

export interface BracketWireframe {
  viewBox: string
  /** Part crease edges, projected. */
  edges: WireframeLine[]
  /** The L-shaped top face (z = DEPTH), for a faint solidity fill. */
  topFace: { x: number; y: number }[]
  /** The three bbox dimensions: 96 (x), 64 (y), 24 (z). */
  dims: WireframeDim[]
}

const DIM_OFFSET = 12 // mm outward from the measured edge
const TICK = 4 // mm, half-length of the end ticks along the offset axis
const LABEL_PAD = 10 // projected px reserved around labels
const EDGE_PAD = 6 // projected px breathing room

function dim3(
  from: [number, number, number],
  to: [number, number, number],
  axis: 0 | 1,
  dir: 1 | -1,
  mm: number,
): WireframeDim {
  const off = (p: [number, number, number], d: number) => {
    const q: [number, number, number] = [...p]
    q[axis] += d
    return q
  }
  const [x1, y1] = project(...off(from, dir * DIM_OFFSET))
  const [x2, y2] = project(...off(to, dir * DIM_OFFSET))
  const tickAt = (p: [number, number, number]): WireframeLine => {
    const [tx1, ty1] = project(...off(p, dir * (DIM_OFFSET - TICK)))
    const [tx2, ty2] = project(...off(p, dir * (DIM_OFFSET + TICK)))
    return { x1: tx1, y1: ty1, x2: tx2, y2: ty2 }
  }
  const [lx, ly] = project(
    ...off(
      [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      dir * (DIM_OFFSET + TICK),
    ),
  )
  return {
    line: { x1, y1, x2, y2 },
    ticks: [tickAt(from), tickAt(to)],
    labelX: lx,
    labelY: ly,
    mm,
  }
}

/** The full panel drawing, in a viewBox fitted around part + dimensions. */
export function buildBracketWireframe(): BracketWireframe {
  const edges: WireframeLine[] = BRACKET_EDGES_MM.map(
    ([x1, y1, z1, x2, y2, z2]) => {
      const [px1, py1] = project(x1, y1, z1)
      const [px2, py2] = project(x2, y2, z2)
      return { x1: px1, y1: py1, x2: px2, y2: py2 }
    },
  )
  // Measured along the three top-front edges of the bbox, offset away from
  // the part so the lines never cross it. The z-dim hangs off the front
  // corner facing the viewer, out into empty (+x) space.
  const dims: WireframeDim[] = [
    dim3([0, 0, DEPTH_MM], [96, 0, DEPTH_MM], 1, -1, 96),
    dim3([0, 0, DEPTH_MM], [0, 64, DEPTH_MM], 0, -1, 64),
    dim3([96, 0, 0], [96, 0, DEPTH_MM], 0, 1, DEPTH_MM),
  ]

  const lines = [...edges, ...dims.flatMap((d) => [d.line, ...d.ticks])]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const l of lines) {
    minX = Math.min(minX, l.x1, l.x2)
    maxX = Math.max(maxX, l.x1, l.x2)
    minY = Math.min(minY, l.y1, l.y2)
    maxY = Math.max(maxY, l.y1, l.y2)
  }
  for (const d of dims) {
    minX = Math.min(minX, d.labelX - LABEL_PAD)
    maxX = Math.max(maxX, d.labelX + LABEL_PAD)
    minY = Math.min(minY, d.labelY - LABEL_PAD)
    maxY = Math.max(maxY, d.labelY + LABEL_PAD)
  }
  const pad = EDGE_PAD
  const dx = -(minX - pad)
  const dy = -(minY - pad)
  const move = (l: WireframeLine): WireframeLine => ({
    x1: l.x1 + dx,
    y1: l.y1 + dy,
    x2: l.x2 + dx,
    y2: l.y2 + dy,
  })
  return {
    viewBox: `0 0 ${Math.ceil(maxX - minX + pad * 2)} ${Math.ceil(maxY - minY + pad * 2)}`,
    edges: edges.map(move),
    topFace: PROFILE_MM.map(([x, y]) => {
      const [px, py] = project(x, y, DEPTH_MM)
      return { x: px + dx, y: py + dy }
    }),
    dims: dims.map((d) => ({
      ...d,
      line: move(d.line),
      ticks: [move(d.ticks[0]), move(d.ticks[1])],
      labelX: d.labelX + dx,
      labelY: d.labelY + dy,
    })),
  }
}

/** Precomputed at module load — the geometry is a constant. */
export const BRACKET_WIREFRAME = buildBracketWireframe()
