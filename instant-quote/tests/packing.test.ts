import { describe, it, expect } from 'bun:test'
import { countPlates } from '../src/lib/packing'

// Bambu Lab H2S plate (matches PRINTER.plate in pricing-config).
const PLATE = { x: 340, y: 320, z: 340 }
const OPTS = { gutterMm: 5 }

const piece = (x: number, y: number, z: number) => ({ bboxMm: { x, y, z } })

describe('countPlates (shelf / first-fit-decreasing)', () => {
  it('one small piece → 1 plate', () => {
    expect(countPlates([piece(50, 50, 50)], PLATE, OPTS)).toBe(1)
  })
  it('four 100×100 pieces pack one plate (3 per shelf + 1)', () => {
    const pieces = Array.from({ length: 4 }, () => piece(100, 100, 50))
    expect(countPlates(pieces, PLATE, OPTS)).toBe(1)
  })
  it('two 300×300 pieces need two plates', () => {
    const pieces = [piece(300, 300, 100), piece(300, 300, 100)]
    expect(countPlates(pieces, PLATE, OPTS)).toBe(2)
  })
  it('one plate-filling piece + three mid pieces → 2 plates', () => {
    const pieces = [
      piece(320, 300, 100),
      piece(150, 150, 50),
      piece(150, 150, 50),
      piece(150, 150, 50),
    ]
    expect(countPlates(pieces, PLATE, OPTS)).toBe(2)
  })
  it('90° yaw swap: 100×330 footprint fits by rotating onto the X axis', () => {
    expect(countPlates([piece(100, 330, 50)], PLATE, OPTS)).toBe(1)
  })
  it('piece taller than the plate → null', () => {
    expect(countPlates([piece(50, 50, 350)], PLATE, OPTS)).toBeNull()
  })
  it('footprint too large in both orientations → null', () => {
    expect(countPlates([piece(330, 330, 50)], PLATE, OPTS)).toBeNull()
  })
  it('no pieces → 1 plate', () => {
    expect(countPlates([], PLATE, OPTS)).toBe(1)
  })
})
