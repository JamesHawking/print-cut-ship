import { describe, it, expect } from 'bun:test'
import { sha256Hex } from '../src/hooks/useMeshWorker'
import { parse3mfParts } from '../src/lib/mesh/parse-3mf'
import { multiItem3mf } from './fixtures/generate'

function bunSha256Hex(buffer: ArrayBuffer): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(new Uint8Array(buffer))
  return hasher.digest('hex')
}

describe('sha256Hex', () => {
  it('matches the SHA-256 known vector for "abc"', async () => {
    const buffer = new TextEncoder().encode('abc').buffer as ArrayBuffer
    expect(await sha256Hex(buffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('hashes 3MF file bytes, not the merged worker positions', async () => {
    const fixture = multiItem3mf(10, 3, 20)
    const fileHash = await sha256Hex(fixture)

    // Same bytes hashed independently must agree (content-addressed keys and
    // the backend MakerWorld tee hash these exact bytes).
    expect(fileHash).toBe(bunSha256Hex(fixture))

    // The old, wrong value: hash of the flattened positions the worker sees.
    const parts = parse3mfParts(fixture)
    const total = parts.reduce((s, p) => s + p.length, 0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const p of parts) {
      merged.set(p, offset)
      offset += p.length
    }
    const positionsHash = await sha256Hex(merged.buffer as ArrayBuffer)
    expect(fileHash).not.toBe(positionsHash)
  })
})
