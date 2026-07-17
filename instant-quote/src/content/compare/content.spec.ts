import { describe, expect, test } from 'bun:test'
import { plCompareCopy } from './pl'
import { enCompareCopy } from './en'
import {
  COMPARISONS,
  compareAlternates,
  comparisonsFor,
  isCompareSlug,
} from './slugs'
import { COMPARE_DATES, compareValues } from './data'
import { PUBLISHED_MATERIALS } from '@/content/materials/slugs'
import { referenceUnitPrice } from '@/content/materials/prices'

describe('comparison slugs', () => {
  test('registry is self-consistent and materials stay published', () => {
    expect(COMPARISONS).toHaveLength(3)
    for (const { slug, materials } of COMPARISONS) {
      expect(isCompareSlug(slug)).toBe(true)
      for (const id of materials) {
        expect(PUBLISHED_MATERIALS.some((m) => m.id === id)).toBe(true)
      }
    }
  })

  test('alternates carry the localized section word', () => {
    const alt = compareAlternates('asa-vs-petg')
    expect(alt.pl).toBe('/pl/porownanie/asa-vs-petg')
    expect(alt.en).toBe('/en/compare/asa-vs-petg')
  })

  test('material-page backlinks resolve', () => {
    expect(comparisonsFor('asa')).toEqual(['asa-vs-petg'])
    expect(comparisonsFor('petg')).toEqual(['asa-vs-petg'])
    expect(comparisonsFor('pa12_cf')).toEqual(['pa-cf-vs-aluminum'])
  })
})

describe('comparison content', () => {
  test('FAQ is 4–6 entries per comparison per locale (FAQPage schema input)', () => {
    for (const copy of [plCompareCopy, enCompareCopy]) {
      for (const { slug } of COMPARISONS) {
        expect(copy[slug].faq.length).toBeGreaterThanOrEqual(4)
        expect(copy[slug].faq.length).toBeLessThanOrEqual(6)
      }
    }
  })

  test('Article dates are valid ISO days with dateModified >= datePublished', () => {
    for (const { slug } of COMPARISONS) {
      const { datePublished, dateModified } = COMPARE_DATES[slug]
      for (const date of [datePublished, dateModified]) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(Date.parse(date))).toBe(false)
      }
      expect(dateModified >= datePublished).toBe(true)
    }
  })
})

describe('compare values (engine-derived)', () => {
  test('every value is finite and positive', () => {
    for (const value of Object.values(compareValues())) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  test('ASA premium is consistent with the reference prices', () => {
    const v = compareValues()
    expect(v.petgBracket1Pln).toBe(referenceUnitPrice('petg', 'bracket', 1))
    expect(v.asaBracket1Pln).toBe(referenceUnitPrice('asa', 'bracket', 1))
    expect(v.asaOverPetgPct).toBe(
      Math.round((v.asaBracket1Pln / v.petgBracket1Pln - 1) * 100),
    )
  })

  test('in-house ledger: costed total exceeds hobby total', () => {
    const v = compareValues()
    expect(v.inHouseCostedPln).toBeGreaterThan(v.inHouseHobbyPln)
    expect(v.inHouseCostedPln).toBeGreaterThan(
      v.inHouseMaterialPln + v.inHouseMachinePln + v.inHouseOperatorPln,
    )
  })
})
