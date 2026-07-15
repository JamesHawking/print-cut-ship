// Shared types for the mesh-analysis pipeline (worker <-> main thread).

export interface MeshMetrics {
  volumeCm3: number // billable/geometric volume (hull-substituted if needed)
  rawSignedVolumeCm3: number // signed tetrahedron sum, before abs/hull
  surfaceAreaCm2: number
  bboxMm: { x: number; y: number; z: number }
  triangleCount: number
  watertight: boolean // heuristic; false => hull fallback used
  usedHullFallback: boolean
}

export type MeshFormat = 'stl' | 'obj' | 'step' | 'positions'

export interface WorkerRequest {
  id: string
  format: MeshFormat
  buffer: ArrayBuffer
  fileName: string
}

export type WorkerErrorCode = 'corrupt' | 'empty' | 'unsupported'

export type WorkerResponse =
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
