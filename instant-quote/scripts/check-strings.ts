#!/usr/bin/env bun
// No-hardcoded-copy gate (Plans/08-i18n.md phase C): every user-facing string
// must live in src/lib/i18n. Scans JSX text and prose-bearing string props in
// components and routes; fails with file:line on any hit. Plan 03's CI runs
// this next to lint/typecheck. Escape hatch for deliberate exceptions:
// append `// i18n-exempt` to the offending line.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src/components', 'src/routes']
const EXCLUDED = [
  'src/components/ui/', // vendored shadcn primitives
  'src/routes/admin/', // EN-only operator tool (plan 07), i18n-exempt
  // Shelved R3F hero — not routed; re-sweep if it returns.
  'src/components/FactoryHero.tsx',
  'src/components/FactoryScene.tsx',
]

// Tokens that are legitimately locale-neutral: units, currencies, formats,
// country/tech codes, symbols. A candidate string whose words are all
// allowlisted (or numeric) passes.
const ALLOWED_WORDS = new Set(
  [
    'mm',
    'cm',
    'cm³',
    'g',
    'h',
    'kg',
    'zł',
    'PLN',
    'VAT',
    'EU',
    'UE',
    'PL',
    'EN',
    'DE',
    'FDM',
    'STL',
    '3MF',
    'OBJ',
    'STEP',
    'STP',
    'MB',
    'D+1',
    'D+2',
    'g/cm³',
    'zł/kg',
    'zł/h',
    'g/h',
    'Q',
    'ID',
    'OTP',
  ].map((w) => w.toLowerCase()),
)

// JSX text between tags containing a run of ≥3 letters (Latin + Polish).
const LETTERS = 'A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ'
const JSX_TEXT = new RegExp(`>([^<>{}\`\n]*[${LETTERS}]{3,}[^<>{}\`\n]*)<`, 'g')
// Prose in string props that render or announce to users.
const PROP_TEXT = new RegExp(
  `(?:aria-label|placeholder|title|alt)=["']([^"']*[${LETTERS}]{3,}[^"']*)["']`,
  'g',
)

function isAllowed(text: string): boolean {
  const words = text
    .split(/[\s·—×→↑✓|/()+%,.:;&?!'’-]+/)
    .filter((w) => w.length > 0)
  return words.every(
    (w) =>
      /^[\d.,]+$/.test(w) ||
      ALLOWED_WORDS.has(w.toLowerCase()) ||
      // All-caps identifier-ish tokens up to 4 chars (badges like "EU").
      /^[A-Z0-9]{1,4}$/.test(w),
  )
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (full.endsWith('.tsx')) yield full
  }
}

const violations: string[] = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative('.', file)
    if (EXCLUDED.some((prefix) => rel.startsWith(prefix))) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (line.includes('// i18n-exempt')) return
      const trimmed = line.trimStart()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
      for (const re of [JSX_TEXT, PROP_TEXT]) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(line)) !== null) {
          const text = m[1].trim()
          if (text && !isAllowed(text)) {
            violations.push(`${rel}:${i + 1}: ${JSON.stringify(text)}`)
          }
        }
      }
    })
  }
}

if (violations.length > 0) {
  console.error(`check-strings: ${violations.length} hardcoded string(s):\n`)
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\nMove copy into src/lib/i18n (or mark the line // i18n-exempt).',
  )
  process.exit(1)
}
console.log('check-strings: no hardcoded user-facing strings found.')
