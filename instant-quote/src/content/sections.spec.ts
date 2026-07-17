import { describe, expect, test } from 'bun:test'
import {
  correctedWordFor,
  sectionAlternates,
  sectionKeyFor,
  sectionPath,
} from './sections'

describe('sectionKeyFor', () => {
  test('resolves each locale word to its section key', () => {
    expect(sectionKeyFor('pl', 'materialy')).toBe('materials')
    expect(sectionKeyFor('en', 'materials')).toBe('materials')
    expect(sectionKeyFor('pl', 'cennik')).toBe('pricing')
    expect(sectionKeyFor('en', 'pricing')).toBe('pricing')
    expect(sectionKeyFor('pl', 'porownanie')).toBe('compare')
    expect(sectionKeyFor('en', 'compare')).toBe('compare')
    expect(sectionKeyFor('pl', 'baza-wiedzy')).toBe('blog')
    expect(sectionKeyFor('en', 'blog')).toBe('blog')
  })

  test('rejects the other locale word and unknown words', () => {
    expect(sectionKeyFor('en', 'materialy')).toBeNull()
    expect(sectionKeyFor('pl', 'pricing')).toBeNull()
    expect(sectionKeyFor('pl', 'nonsense')).toBeNull()
  })
})

describe('correctedWordFor', () => {
  test('corrects a wrong-locale word to the requested locale', () => {
    expect(correctedWordFor('materials', 'pl')).toBe('materialy')
    expect(correctedWordFor('porownanie', 'en')).toBe('compare')
    expect(correctedWordFor('compare', 'pl')).toBe('porownanie')
    expect(correctedWordFor('baza-wiedzy', 'en')).toBe('blog')
  })

  test('is identity for a word already in the requested locale', () => {
    expect(correctedWordFor('cennik', 'pl')).toBe('cennik')
  })

  test('returns null for words no locale owns', () => {
    expect(correctedWordFor('nonsense', 'pl')).toBeNull()
  })
})

describe('sectionPath', () => {
  test('builds the localized index path', () => {
    expect(sectionPath('pl', 'compare')).toBe('/pl/porownanie')
    expect(sectionPath('en', 'blog')).toBe('/en/blog')
  })
})

describe('sectionAlternates', () => {
  test('returns both locale paths', () => {
    expect(sectionAlternates('materials')).toEqual({
      pl: '/pl/materialy',
      en: '/en/materials',
    })
  })
})
