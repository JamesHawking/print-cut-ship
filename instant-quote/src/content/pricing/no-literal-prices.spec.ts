import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// plans/seo/03 DoD: "a test must fail if any [currency] value on this page
// is a string literal in the page source". Every zł amount must interpolate
// from the engine dataset — a digit directly before `zł` in these sources is
// a hardcoded price that will go stale silently.
//
// The compare tree (plans/seo/04) is scanned under the same rule: its
// static cited figures (aluminum ranges, TCO inputs) are bare numbers with
// Pln-suffixed names in compare/data.ts, so any rendered `zł` amount is
// still necessarily an interpolation.

const SCANNED_DIRS = [
  'src/content/pricing',
  'src/components/pricing',
  'src/content/compare',
  'src/components/compare',
]
const LITERAL_PRICE = /\d(?:[\d\s.,]*)\s?zł/u

describe('no literal prices in pricing-page sources', () => {
  test('every zł amount is interpolated, never hardcoded', () => {
    const violations: string[] = []
    for (const dir of SCANNED_DIRS) {
      for (const entry of readdirSync(dir)) {
        if (!/\.(ts|tsx)$/.test(entry) || entry.endsWith('.spec.ts')) continue
        const path = join(dir, entry)
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (LITERAL_PRICE.test(line)) {
              violations.push(`${path}:${i + 1}: ${line.trim()}`)
            }
          })
      }
    }
    expect(violations).toEqual([])
  })
})
