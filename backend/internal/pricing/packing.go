package pricing

import "sort"

// Plate packing for multi-piece 3MF files, ported from src/lib/packing.ts.
// Pieces keep their build orientation — only a 90° yaw swap of the footprint
// is considered. Packing is a shelf / first-fit-decreasing heuristic.

type PackOpts struct {
	GutterMm float64 // required spacing between pieces
}

// CountPlates returns the number of plates needed to print every piece, or
// nil if some piece cannot fit a plate at all (too tall, or footprint
// exceeds the plate even rotated).
func CountPlates(pieces []Piece, plate BuildVolumeMm, opts PackOpts) *int {
	one := 1
	if len(pieces) == 0 {
		return &one
	}
	g := opts.GutterMm
	// Inflating every footprint by the gutter (and the plate by one gutter)
	// spaces pieces from each other without double-charging the plate edges.
	plateW := plate.X + g
	plateD := plate.Y + g

	type rect struct{ w, d float64 }
	rects := make([]rect, 0, len(pieces))
	for _, piece := range pieces {
		x, y, z := piece.BboxMm.X, piece.BboxMm.Y, piece.BboxMm.Z
		if z > plate.Z {
			return nil
		}
		fitsAsIs := x <= plate.X && y <= plate.Y
		fitsSwapped := y <= plate.X && x <= plate.Y
		if !fitsAsIs && !fitsSwapped {
			return nil
		}
		// Canonical orientation: long side along X when the plate allows it.
		long := max(x, y)
		short := min(x, y)
		wide := long <= plate.X && short <= plate.Y
		if wide {
			rects = append(rects, rect{w: long + g, d: short + g})
		} else {
			rects = append(rects, rect{w: short + g, d: long + g})
		}
	}

	// First-fit-decreasing by shelf depth: deepest rects open shelves first.
	sort.SliceStable(rects, func(i, j int) bool {
		if rects[i].d != rects[j].d {
			return rects[i].d > rects[j].d
		}
		return rects[i].w > rects[j].w
	})

	type shelf struct{ depth, xUsed float64 }
	type plateState struct {
		yUsed   float64
		shelves []shelf
	}
	plates := []*plateState{{}}

	for _, r := range rects {
		placed := false
		for _, p := range plates {
			// Existing shelf with room (rects are depth-sorted, so r.d fits
			// any shelf opened earlier on this pass).
			for i := range p.shelves {
				s := &p.shelves[i]
				if r.d <= s.depth && s.xUsed+r.w <= plateW {
					s.xUsed += r.w
					placed = true
					break
				}
			}
			if placed {
				break
			}
			// New shelf on this plate.
			if p.yUsed+r.d <= plateD {
				p.shelves = append(p.shelves, shelf{depth: r.d, xUsed: r.w})
				p.yUsed += r.d
				placed = true
				break
			}
		}
		if !placed {
			plates = append(plates, &plateState{
				yUsed:   r.d,
				shelves: []shelf{{depth: r.d, xUsed: r.w}},
			})
		}
	}
	n := len(plates)
	return &n
}
