// In-memory geometry fixture builders for tests. No files on disk.
import { zipSync } from 'fflate'

type V3 = [number, number, number]

// Cube corners for [0,s]^3.
function cubeCorners(s: number): V3[] {
  return [
    [0, 0, 0],
    [s, 0, 0],
    [s, s, 0],
    [0, s, 0],
    [0, 0, s],
    [s, 0, s],
    [s, s, s],
    [0, s, s],
  ]
}

const CUBE_FACES: number[][] = [
  [0, 1, 2, 3], // z=0
  [4, 5, 6, 7], // z=s
  [0, 1, 5, 4], // y=0
  [3, 2, 6, 7], // y=s
  [0, 3, 7, 4], // x=0
  [1, 2, 6, 5], // x=s
]

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Build outward-wound triangles for a cube of side s. Returns [ntri][9] flat. */
export function cubeTriangles(s: number, reversed = false): number[] {
  const corners = cubeCorners(s)
  const center: V3 = [s / 2, s / 2, s / 2]
  const out: number[] = []
  const push = (a: V3, b: V3, c: V3) => {
    // Ensure outward winding: (b-a)×(c-a) should point away from center.
    const n = cross(sub(b, a), sub(c, a))
    const outward = dot(n, sub(a, center))
    let tri: [V3, V3, V3] = outward >= 0 ? [a, b, c] : [a, c, b]
    if (reversed) tri = [tri[0], tri[2], tri[1]]
    for (const v of tri) out.push(v[0], v[1], v[2])
  }
  for (const [i0, i1, i2, i3] of CUBE_FACES) {
    push(corners[i0], corners[i1], corners[i2])
    push(corners[i0], corners[i2], corners[i3])
  }
  return out
}

/** Binary STL ArrayBuffer for a cube of side s. */
export function cubeBinaryStl(s: number, reversed = false): ArrayBuffer {
  const tris = cubeTriangles(s, reversed)
  const triCount = tris.length / 9
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const view = new DataView(buffer)
  view.setUint32(80, triCount, true)
  let offset = 84
  for (let t = 0; t < triCount; t++) {
    offset += 12 // zero normal
    for (let k = 0; k < 9; k++) {
      view.setFloat32(offset, tris[t * 9 + k], true)
      offset += 4
    }
    offset += 2 // attribute
  }
  return buffer
}

/** "solid"-prefixed BINARY STL — header literally starts with the word solid. */
export function cubeBinaryStlSolidPrefixed(s: number): ArrayBuffer {
  const buffer = cubeBinaryStl(s)
  const view = new Uint8Array(buffer)
  const solid = new TextEncoder().encode('solid')
  view.set(solid, 0)
  return buffer
}

/** ASCII STL string → ArrayBuffer for a cube. */
export function cubeAsciiStl(s: number): ArrayBuffer {
  const tris = cubeTriangles(s)
  let text = 'solid cube\n'
  for (let t = 0; t < tris.length / 9; t++) {
    text += 'facet normal 0 0 0\n outer loop\n'
    for (let v = 0; v < 3; v++) {
      const o = t * 9 + v * 3
      text += `  vertex ${tris[o]} ${tris[o + 1]} ${tris[o + 2]}\n`
    }
    text += ' endloop\nendfacet\n'
  }
  text += 'endsolid cube\n'
  return new TextEncoder().encode(text).buffer
}

/** OBJ using quad faces (tests fan triangulation). Quads are ordered so their
 *  fan triangulation is outward-consistent → correct signed volume. */
export function cubeObj(s: number): ArrayBuffer {
  const corners = cubeCorners(s)
  const center: V3 = [s / 2, s / 2, s / 2]
  let text = ''
  for (const c of corners) text += `v ${c[0]} ${c[1]} ${c[2]}\n`
  for (const face of CUBE_FACES) {
    const [i0, i1, i2, i3] = face
    const n = cross(
      sub(corners[i1], corners[i0]),
      sub(corners[i2], corners[i0]),
    )
    const outward = dot(n, sub(corners[i0], center)) >= 0
    const q = outward ? [i0, i1, i2, i3] : [i0, i3, i2, i1]
    // OBJ is 1-based.
    text += `f ${q[0] + 1} ${q[1] + 1} ${q[2] + 1} ${q[3] + 1}\n`
  }
  return new TextEncoder().encode(text).buffer
}

/** Cube with the top face removed — an open, non-watertight mesh. */
export function openBoxBinaryStl(s: number): ArrayBuffer {
  const tris = cubeTriangles(s)
  const open = tris.slice(0, tris.length - 18) // drop last 2 triangles (top)
  const triCount = open.length / 9
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const view = new DataView(buffer)
  view.setUint32(80, triCount, true)
  let offset = 84
  for (let t = 0; t < triCount; t++) {
    offset += 12
    for (let k = 0; k < 9; k++) {
      view.setFloat32(offset, open[t * 9 + k], true)
      offset += 4
    }
    offset += 2
  }
  return buffer
}

/** A regular tetrahedron-ish set of 4 points with a known volume. */
export function tetraPoints(): [number, number, number][] {
  // Volume of tetra with vertices at origin and axis points = (a*b*c)/6.
  return [
    [0, 0, 0],
    [6, 0, 0],
    [0, 6, 0],
    [0, 0, 6],
  ] // volume = 6*6*6/6 = 36 mm³
}

// --- 3MF (production extension) -------------------------------------------

/** Outward-oriented triangle index triples for a cube [0,s]^3 (12 tris). */
function cubeIndexTriangles(s: number): number[] {
  const corners = cubeCorners(s)
  const center: V3 = [s / 2, s / 2, s / 2]
  const out: number[] = []
  for (const [i0, i1, i2, i3] of CUBE_FACES) {
    const n = cross(
      sub(corners[i1], corners[i0]),
      sub(corners[i2], corners[i0]),
    )
    const outward = dot(n, sub(corners[i0], center)) >= 0
    const q = outward ? [i0, i1, i2, i3] : [i0, i3, i2, i1]
    out.push(q[0], q[1], q[2], q[0], q[2], q[3])
  }
  return out
}

/**
 * A .3mf ArrayBuffer in the *production extension* layout that Bambu/Orca/Prusa
 * emit: the root `3D/3dmodel.model` holds no geometry — its build item points at
 * a components object that references the cube mesh in a SEPARATE part
 * (`3D/Objects/object_1.model`) via `p:path`. `transform` is applied to the
 * build item (12 numbers, 3MF row-vector order). Requires fflate's zipSync.
 */
export function productionExtension3mf(
  s: number,
  transform: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
): ArrayBuffer {
  const corners = cubeCorners(s)
  const tris = cubeIndexTriangles(s)
  const verts = corners
    .map((c) => `   <vertex x="${c[0]}" y="${c[1]}" z="${c[2]}"/>`)
    .join('\n')
  const faces: string[] = []
  for (let i = 0; i < tris.length; i += 3) {
    faces.push(
      `   <triangle v1="${tris[i]}" v2="${tris[i + 1]}" v3="${tris[i + 2]}"/>`,
    )
  }
  const ns =
    'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
    'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"'

  const objectModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" ${ns}>
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>
${verts}
    </vertices>
    <triangles>
${faces.join('\n')}
    </triangles>
   </mesh>
  </object>
 </resources>
</model>`

  const rootModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" ${ns} requiredextensions="p">
 <resources>
  <object id="2" type="model">
   <components>
    <component p:path="/3D/Objects/object_1.model" objectid="1"/>
   </components>
  </object>
 </resources>
 <build>
  <item objectid="2" transform="${transform.join(' ')}"/>
 </build>
</model>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

  const enc = (str: string) => new TextEncoder().encode(str)
  const zipped = zipSync({
    '[Content_Types].xml': enc(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
    ),
    '_rels/.rels': enc(rootRels),
    '3D/3dmodel.model': enc(rootModel),
    '3D/Objects/object_1.model': enc(objectModel),
  })
  return zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer
}
