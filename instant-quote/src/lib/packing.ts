// Plate packing for multi-piece 3MF files. Pure and deterministic: given the
// per-piece bounding boxes and a plate size, estimate how many build plates
// the job needs. Pieces keep their build orientation (a 3MF's items are
// already laid out for printing) — only a 90° yaw swap of the footprint is
// considered. Packing is a shelf / first-fit-decreasing heuristic, which
// over-estimates only in adversarial cases and never under-estimates height.

import type { BuildVolumeMm } from './pricing-config'

export interface PieceBboxMm {
  x: number
  y: number
  z: number
}

interface PackOpts {
  gutterMm: number // required spacing between pieces
}

/**
 * Number of plates needed to print every piece, or null if some piece cannot
 * fit a plate at all (too tall, or footprint exceeds the plate even rotated).
 */
export function countPlates(
  pieces: ReadonlyArray<{ bboxMm: PieceBboxMm }>,
  plate: BuildVolumeMm,
  opts: PackOpts,
): number | null {
  if (pieces.length === 0) return 1
  const g = opts.gutterMm
  // Inflating every footprint by the gutter (and the plate by one gutter)
  // spaces pieces from each other without double-charging the plate edges.
  const plateW = plate.x + g
  const plateD = plate.y + g

  const rects: { w: number; d: number }[] = []
  for (const piece of pieces) {
    const { x, y, z } = piece.bboxMm
    if (z > plate.z) return null
    const fitsAsIs = x <= plate.x && y <= plate.y
    const fitsSwapped = y <= plate.x && x <= plate.y
    if (!fitsAsIs && !fitsSwapped) return null
    // Canonical orientation: long side along X when the plate allows it.
    const long = Math.max(x, y)
    const short = Math.min(x, y)
    const wide = long <= plate.x && short <= plate.y
    rects.push(
      wide ? { w: long + g, d: short + g } : { w: short + g, d: long + g },
    )
  }

  // First-fit-decreasing by shelf depth: deepest rects open shelves first.
  rects.sort((a, b) => b.d - a.d || b.w - a.w)

  interface Shelf {
    depth: number
    xUsed: number
  }
  interface Plate {
    yUsed: number
    shelves: Shelf[]
  }
  const plates: Plate[] = [{ yUsed: 0, shelves: [] }]

  for (const rect of rects) {
    let placed = false
    for (const p of plates) {
      // Existing shelf with room (rects are depth-sorted, so rect.d fits any
      // shelf opened earlier on this pass).
      const shelf = p.shelves.find(
        (s) => rect.d <= s.depth && s.xUsed + rect.w <= plateW,
      )
      if (shelf) {
        shelf.xUsed += rect.w
        placed = true
        break
      }
      // New shelf on this plate.
      if (p.yUsed + rect.d <= plateD) {
        p.shelves.push({ depth: rect.d, xUsed: rect.w })
        p.yUsed += rect.d
        placed = true
        break
      }
    }
    if (!placed) {
      plates.push({
        yUsed: rect.d,
        shelves: [{ depth: rect.d, xUsed: rect.w }],
      })
    }
  }
  return plates.length
}
