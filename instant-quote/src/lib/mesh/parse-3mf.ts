// 3MF parsing. We parse the container ourselves instead of using
// three-stdlib's ThreeMFLoader because that loader does not support the 3MF
// *production extension* (Bambu Studio, OrcaSlicer, PrusaSlicer, Fusion 360),
// where a build item references a components object whose parts live in
// separate `.model` files inside the zip, addressed by `p:path`. The loader
// ignores `p:path` and looks the referenced object up in the wrong part,
// throwing on the resulting undefined. This parser resolves those cross-part
// references and flattens everything to a world-space triangle soup.
//
// It is intentionally DOM-free (no DOMParser), so it can run anywhere and is
// unit-testable. The heavy geometry MATH still runs in the worker; we only hand
// it the flattened positions.

import { unzipSync } from 'fflate'
import { MeshParseError } from './parse-stl'

// A 3MF transform: 4 rows of 3 (row-vector convention). A point p maps to world
// as [x y z 1] · M, i.e. x' = x*m0 + y*m3 + z*m6 + m9, etc.
type Mat = number[]
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

interface ObjectDef {
  vertices?: Float32Array
  triangles?: Uint32Array
  components?: { path?: string; objectid: string; transform: Mat }[]
}
type ModelPart = Map<string, ObjectDef>

/** Read a single quoted attribute value off a tag's attribute string. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*"([^"]*)"'))
  return m ? m[1] : undefined
}

function parseTransform(s: string | undefined): Mat {
  if (!s) return IDENTITY
  const n = s.trim().split(/\s+/).map(Number)
  return n.length === 12 && !n.some(Number.isNaN) ? n : IDENTITY
}

// Compose so a point maps as p · a · b (apply `a` first, then `b`).
function multiply(a: Mat, b: Mat): Mat {
  const r = new Array<number>(12)
  for (let i = 0; i < 4; i++) {
    const a0 = a[i * 3]
    const a1 = a[i * 3 + 1]
    const a2 = a[i * 3 + 2]
    for (let j = 0; j < 3; j++) {
      let v = a0 * b[j] + a1 * b[3 + j] + a2 * b[6 + j]
      if (i === 3) v += b[9 + j]
      r[i * 3 + j] = v
    }
  }
  return r
}

function parseModelPart(xml: string): ModelPart {
  const objects: ModelPart = new Map()
  const objRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g
  let om: RegExpExecArray | null
  while ((om = objRe.exec(xml))) {
    const id = attr(om[1], 'id')
    if (!id) continue
    const body = om[2]
    const def: ObjectDef = {}

    const meshM = body.match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/)
    if (meshM) {
      const meshBody = meshM[1]
      const verts: number[] = []
      const vre = /<vertex\b([^>]*?)\/?>/g
      let vm: RegExpExecArray | null
      while ((vm = vre.exec(meshBody))) {
        verts.push(
          Number(attr(vm[1], 'x')),
          Number(attr(vm[1], 'y')),
          Number(attr(vm[1], 'z')),
        )
      }
      const tris: number[] = []
      const tre = /<triangle\b([^>]*?)\/?>/g
      let tm: RegExpExecArray | null
      while ((tm = tre.exec(meshBody))) {
        tris.push(
          Number(attr(tm[1], 'v1')),
          Number(attr(tm[1], 'v2')),
          Number(attr(tm[1], 'v3')),
        )
      }
      def.vertices = Float32Array.from(verts)
      def.triangles = Uint32Array.from(tris)
    }

    const compM = body.match(/<components\b[^>]*>([\s\S]*?)<\/components>/)
    if (compM) {
      const list: NonNullable<ObjectDef['components']> = []
      const cre = /<component\b([^>]*?)\/?>/g
      let cm: RegExpExecArray | null
      while ((cm = cre.exec(compM[1]))) {
        const objectid = attr(cm[1], 'objectid')
        if (!objectid) continue
        // p:path in the production extension (prefix is arbitrary).
        const pathM = cm[1].match(/\s(?:\w+:)?path\s*=\s*"([^"]*)"/)
        list.push({
          objectid,
          path: pathM ? pathM[1] : undefined,
          transform: parseTransform(attr(cm[1], 'transform')),
        })
      }
      def.components = list
    }

    objects.set(id, def)
  }
  return objects
}

/** Parse a .3mf file into a flattened position soup (world-space, 9 floats/tri). */
export function parse3mf(buffer: ArrayBuffer): Float32Array {
  let zip: Record<string, Uint8Array>
  try {
    zip = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new MeshParseError('corrupt', 'Could not read the 3MF file.')
  }

  const dec = new TextDecoder()
  const files = new Map<string, Uint8Array>()
  for (const k of Object.keys(zip)) files.set(k.replace(/^\/+/, ''), zip[k])
  const findFile = (p: string) => files.get(p.replace(/^\/+/, ''))

  // Locate the primary model part via _rels/.rels, else fall back.
  let rootPath = '3D/3dmodel.model'
  const rels = findFile('_rels/.rels')
  if (rels) {
    const txt = dec.decode(rels)
    const re = /<Relationship\b[^>]*>/g
    let rm: RegExpExecArray | null
    while ((rm = re.exec(txt))) {
      const target = attr(rm[0], 'Target')
      if (target && /3dmodel$/i.test(attr(rm[0], 'Type') ?? '')) {
        rootPath = target.replace(/^\/+/, '')
        break
      }
    }
  }
  if (!findFile(rootPath)) {
    const first = [...files.keys()].find((k) => /^3D\/.*\.model$/i.test(k))
    if (first) rootPath = first
  }

  const partCache = new Map<string, ModelPart>()
  const getPart = (path: string): ModelPart | undefined => {
    const norm = path.replace(/^\/+/, '')
    const cached = partCache.get(norm)
    if (cached) return cached
    const f = findFile(norm)
    if (!f) return undefined
    const part = parseModelPart(dec.decode(f))
    partCache.set(norm, part)
    return part
  }

  const rootFile = findFile(rootPath)
  if (!rootFile)
    throw new MeshParseError('corrupt', 'Could not read the 3MF file.')
  const rootXml = dec.decode(rootFile)

  const chunks: Float32Array[] = []
  const emitObject = (
    partPath: string,
    objectId: string,
    matrix: Mat,
    depth: number,
  ): void => {
    if (depth > 50) return
    const def = getPart(partPath)?.get(objectId)
    if (!def) return
    if (def.vertices && def.triangles && def.triangles.length) {
      const v = def.vertices
      const t = def.triangles
      const out = new Float32Array(t.length * 3)
      let o = 0
      for (let i = 0; i < t.length; i++) {
        const vi = t[i] * 3
        const x = v[vi]
        const y = v[vi + 1]
        const z = v[vi + 2]
        out[o++] = x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9]
        out[o++] = x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10]
        out[o++] = x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11]
      }
      chunks.push(out)
    } else if (def.components) {
      for (const c of def.components) {
        emitObject(
          c.path ?? partPath,
          c.objectid,
          multiply(c.transform, matrix),
          depth + 1,
        )
      }
    }
  }

  const buildM = rootXml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/)
  if (buildM) {
    const ire = /<item\b([^>]*?)\/?>/g
    let im: RegExpExecArray | null
    while ((im = ire.exec(buildM[1]))) {
      const objectid = attr(im[1], 'objectid')
      if (!objectid) continue
      emitObject(
        rootPath,
        objectid,
        parseTransform(attr(im[1], 'transform')),
        0,
      )
    }
  }

  const total = chunks.reduce((s, c) => s + c.length, 0)
  if (total === 0) {
    throw new MeshParseError('empty', '3MF contains no printable geometry.')
  }
  const merged = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }
  return merged
}
