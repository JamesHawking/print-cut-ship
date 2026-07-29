/** How long a price takes to count to its final value (Mobile Audit 5b). */
export const COUNT_UP_MS = 700

/** Ease-out cubic: fast commitment, soft landing, never overshoots. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * The value to display `elapsedMs` into a count from `from` to `to`.
 * Clamped at both ends, so a frame that arrives late (or a backgrounded tab
 * that resumes after the run should have finished) lands exactly on `to`
 * rather than overshooting it.
 */
export function countUpValue(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs = COUNT_UP_MS,
): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to
  if (elapsedMs <= 0) return from
  return from + (to - from) * easeOutCubic(elapsedMs / durationMs)
}
