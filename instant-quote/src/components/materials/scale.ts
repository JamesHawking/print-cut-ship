// Ladder math for the landing Materials grid: a value's share of the
// section's max, as a percentage for meter widths. Pure — the spec pins both
// ladders (zł/kg rates and the captured demo-bracket prices) so catalog or
// pricing drift shows up in the suite.

/** Meter width, % of the section max, rounded to 0.1 for stable styles. */
export function shareOfMax(value: number, all: readonly number[]): number {
  const max = Math.max(...all)
  return Math.round((value / max) * 1000) / 10
}
