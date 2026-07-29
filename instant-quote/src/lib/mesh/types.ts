// Shared types for the mesh-analysis pipeline (worker <-> main thread).

export interface MeshMetrics {
  volumeCm3: number // billable/geometric volume (hull-substituted if needed)
  rawSignedVolumeCm3: number // signed tetrahedron sum, before abs/hull
  surfaceAreaCm2: number
  bboxMm: { x: number; y: number; z: number }
  triangleCount: number
  watertight: boolean // heuristic; false => hull fallback used
  usedHullFallback: boolean
  // Per-piece bounding boxes for multi-item 3MF files (one entry per
  // top-level build item). Computed on the main thread; absent for
  // single-piece files and non-3MF formats.
  pieces?: Array<{ bboxMm: { x: number; y: number; z: number } }>
}

export type MeshFormat = 'stl' | 'obj' | 'step' | 'positions'

/**
 * The four stages a file passes through between the drop and the price
 * (Mobile Audit 5c, "progress is honest"). Each one is a real await boundary,
 * not a paced fiction: `read` is the bytes plus their SHA-256, `mesh` is the
 * parser returning triangles, `solid` is analyze() returning volume, area and
 * watertightness, and `price` is the engine answering. There is deliberately
 * no "slice" stage — nothing in this app or the backend slices.
 */
export type MeshStage = 'read' | 'mesh' | 'solid' | 'price'

/** Ordered, so a stage can be compared against the one on screen. */
export const MESH_STAGES: readonly MeshStage[] = [
  'read',
  'mesh',
  'solid',
  'price',
]

/**
 * How far through the pipeline the given stage leaves us, as a percentage.
 * Of the pipeline, not of the bytes — which is why it can be checked against
 * the stage list beside it, and why it moves in four steps rather than
 * sweeping smoothly like a fiction would.
 */
export function stagePercent(stage?: MeshStage): number {
  const done = stage ? MESH_STAGES.indexOf(stage) + 1 : 0
  return (done / MESH_STAGES.length) * 100
}

export interface WorkerRequest {
  id: string
  format: MeshFormat
  buffer: ArrayBuffer
  fileName: string
}

export type WorkerErrorCode = 'corrupt' | 'empty' | 'unsupported'

export type WorkerResponse =
  // Non-terminal: a stage finished, the job continues. Sent before either
  // reply below, so handle it (and return) before narrowing on `ok`.
  | { id: string; ok: 'progress'; stage: MeshStage }
  | {
      id: string
      ok: true
      metrics: MeshMetrics
      hash: string
      positions: ArrayBuffer // Float32Array buffer, transferred back for preview
    }
  | {
      id: string
      ok: false
      error: { code: WorkerErrorCode; message: string }
    }
