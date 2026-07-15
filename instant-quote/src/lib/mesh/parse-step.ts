// STEP (ISO 10303-21) parser → Float32Array position soup (9 floats/triangle).
// Tessellation is done by occt-import-js (OpenCascade WASM); this module only
// de-indexes its output. The caller owns loading the WASM module — in the app
// that happens lazily in the mesh worker, in tests directly — so this stays
// synchronous and DOM-free like the other parsers.

import { MeshParseError } from './parse-stl'

export interface OcctMesh {
  attributes: { position: { array: number[] } }
  index: { array: number[] }
}

export interface OcctReadResult {
  success: boolean
  meshes: OcctMesh[]
}

export interface OcctModule {
  ReadStepFile(
    content: Uint8Array,
    params: typeof STEP_TRIANGULATION_PARAMS,
  ): OcctReadResult
}

// Deflection as a bounding-box ratio scales tessellation density with part
// size; 0.001 reproduced the SeekMake analyzer's volume for the reference
// part to 5 decimal places (355.44645 cm³).
export const STEP_TRIANGULATION_PARAMS = {
  linearUnit: 'millimeter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.001,
  angularDeflection: 0.5,
} as const

export function parseStep(buffer: ArrayBuffer, occt: OcctModule): Float32Array {
  const result = occt.ReadStepFile(
    new Uint8Array(buffer),
    STEP_TRIANGULATION_PARAMS,
  )
  if (!result.success) {
    throw new MeshParseError('corrupt', 'STEP file could not be read.')
  }

  let indexCount = 0
  for (const mesh of result.meshes) indexCount += mesh.index.array.length
  if (indexCount === 0) {
    throw new MeshParseError('empty', 'STEP contains no surfaces.')
  }

  const out = new Float32Array(indexCount * 3)
  let o = 0
  for (const mesh of result.meshes) {
    const pos = mesh.attributes.position.array
    for (const idx of mesh.index.array) {
      out[o++] = pos[idx * 3]
      out[o++] = pos[idx * 3 + 1]
      out[o++] = pos[idx * 3 + 2]
    }
  }
  return out
}
