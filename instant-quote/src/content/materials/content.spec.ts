import { describe, expect, test } from 'bun:test'
import { MATERIAL_DATA } from './data'
import { plMaterialsCopy } from './pl'
import { enMaterialsCopy } from './en'
import {
  isMaterialSlug,
  materialAlternates,
  materialIdForSlug,
  PUBLISHED_MATERIALS,
} from './slugs'
import {
  REFERENCE_PARTS,
  REFERENCE_QUANTITIES,
  referenceUnitPrice,
} from './prices'
import { MATERIALS } from '@/lib/catalog-static'

describe('reference prices (engine-generated JSON)', () => {
  test('covers every published material × part × quantity, positive and non-increasing', () => {
    expect(REFERENCE_PARTS).toHaveLength(3)
    for (const { id } of PUBLISHED_MATERIALS) {
      for (const part of REFERENCE_PARTS) {
        let prev = Infinity
        for (const qty of REFERENCE_QUANTITIES) {
          const price = referenceUnitPrice(id, part.id, qty)
          expect(price).toBeGreaterThan(0)
          expect(price).toBeLessThanOrEqual(prev)
          prev = price
        }
      }
    }
  })
})

describe('material content', () => {
  test('published materials exist in the catalog and data module', () => {
    for (const { id, slug } of PUBLISHED_MATERIALS) {
      expect(MATERIALS.some((m) => m.id === id)).toBe(true)
      expect(MATERIAL_DATA[id]).toBeDefined()
      expect(isMaterialSlug(slug)).toBe(true)
      expect(materialIdForSlug(slug)).toBe(id)
    }
  })

  test('FAQ is 5–7 entries per material per locale (FAQPage schema input)', () => {
    for (const copy of [plMaterialsCopy, enMaterialsCopy]) {
      for (const { id } of PUBLISHED_MATERIALS) {
        expect(copy[id].faq.length).toBeGreaterThanOrEqual(5)
        expect(copy[id].faq.length).toBeLessThanOrEqual(7)
      }
    }
  })

  test('compare-with never points at itself and stays published', () => {
    for (const { id } of PUBLISHED_MATERIALS) {
      for (const other of MATERIAL_DATA[id].compareWith) {
        expect(other).not.toBe(id)
        expect(PUBLISHED_MATERIALS.some((m) => m.id === other)).toBe(true)
      }
    }
  })

  test('alternates carry the localized section word', () => {
    const alt = materialAlternates('asa')
    expect(alt.pl).toBe('/pl/materialy/asa')
    expect(alt.en).toBe('/en/materials/asa')
  })
})
