// OBJ parser → Float32Array position soup. Parses v/f lines only, fan-
// triangulates n-gon faces, ignores materials/normals/UVs. DOM-free.

import { MeshParseError } from './parse-stl'

export function parseObj(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder().decode(buffer)
  const verts: number[] = [] // flat x,y,z
  const out: number[] = []

  const vertexAt = (index: number): [number, number, number] => {
    // OBJ indices are 1-based; negative indices are relative to the end.
    const count = verts.length / 3
    const i = index > 0 ? index - 1 : count + index
    if (i < 0 || i >= count) {
      throw new MeshParseError('corrupt', 'OBJ face references a missing vertex.')
    }
    return [verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]]
  }

  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const parts = trimmed.split(/\s+/)
    const kind = parts[0]
    if (kind === 'v') {
      verts.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      )
    } else if (kind === 'f') {
      // Each token may be "v", "v/vt", "v//vn", "v/vt/vn" — take the v index.
      const idx = parts
        .slice(1)
        .map((tok) => parseInt(tok.split('/')[0], 10))
        .filter((n) => !Number.isNaN(n))
      // Fan-triangulate.
      for (let i = 1; i + 1 < idx.length; i++) {
        const a = vertexAt(idx[0])
        const b = vertexAt(idx[i])
        const c = vertexAt(idx[i + 1])
        out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
      }
    }
  }

  if (out.length === 0) {
    throw new MeshParseError('corrupt', 'OBJ contains no triangles.')
  }
  return new Float32Array(out)
}
