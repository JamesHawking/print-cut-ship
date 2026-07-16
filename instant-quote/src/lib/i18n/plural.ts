// Minimal plural helpers — no CLDR runtime; two locales don't justify one.
// Used *inside* the locale files; consumers only ever see `(n) => string`.

/**
 * Polish three-form plural: 1 → one; 2–4 (except 12–14) → few; else many.
 * e.g. plPlural(n, 'część', 'części', 'części').
 */
export function plPlural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  if (n === 1) return one
  const d10 = n % 10
  const d100 = n % 100
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few
  return many
}

/** English binary plural. */
export function enPlural(n: number, one: string, other: string): string {
  return n === 1 ? one : other
}
