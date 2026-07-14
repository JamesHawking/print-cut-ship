// STL parser (binary + ASCII) → Float32Array position soup (9 floats/triangle).
// DOM-free. Own parser (not three-stdlib's STLLoader) to avoid allocating a
// BufferGeometry + normals we don't need — matters for 50 MB / <5 s.

export class MeshParseError extends Error {
  constructor(
    public code: 'corrupt' | 'empty' | 'unsupported',
    message: string,
  ) {
    super(message)
    this.name = 'MeshParseError'
  }
}

function isBinarySTL(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false
  const view = new DataView(buffer)
  const triCount = view.getUint32(80, true)
  // The one reliable check: exact expected byte length for binary layout.
  return 84 + triCount * 50 === buffer.byteLength
}

function parseBinary(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer)
  const triCount = view.getUint32(80, true)
  if (triCount === 0) throw new MeshParseError('empty', 'STL has no triangles.')
  const out = new Float32Array(triCount * 9)
  let o = 0
  let offset = 84
  for (let t = 0; t < triCount; t++) {
    offset += 12 // skip normal
    for (let v = 0; v < 9; v++) {
      out[o++] = view.getFloat32(offset, true)
      offset += 4
    }
    offset += 2 // attribute byte count
  }
  return out
}

function parseAscii(text: string): Float32Array {
  const coords: number[] = []
  // Match "vertex x y z" lines.
  const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    coords.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  }
  if (coords.length === 0 || coords.length % 9 !== 0) {
    throw new MeshParseError('corrupt', 'Could not parse ASCII STL triangles.')
  }
  return new Float32Array(coords)
}

export function parseStl(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength === 0) {
    throw new MeshParseError('empty', 'File is empty.')
  }
  if (isBinarySTL(buffer)) {
    return parseBinary(buffer)
  }
  const text = new TextDecoder().decode(buffer)
  if (!/facet|vertex/i.test(text)) {
    throw new MeshParseError('corrupt', 'Not a recognizable STL file.')
  }
  return parseAscii(text)
}
