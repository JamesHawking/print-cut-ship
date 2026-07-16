// Client-side MakerWorld coverage: URL parsing and error-message mapping.
// Profile resolution and the download flow moved to the Go backend and are
// tested in backend/internal/makerworld.
import { describe, it, expect } from 'bun:test'
import {
  parseMakerworldUrl,
  makerworldErrorMessage,
  type MakerworldErrorCode,
} from '../src/lib/makerworld'
import { getStrings, LOCALES } from '../src/lib/i18n'

describe('parseMakerworldUrl', () => {
  it('parses a canonical model URL with locale and slug', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/123456-cool-benchy'),
    ).toEqual({ designId: 123456 })
  })
  it('parses other locales', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/de/models/98765'),
    ).toEqual({
      designId: 98765,
    })
    expect(
      parseMakerworldUrl('https://makerworld.com/zh-tw/models/42-widget'),
    ).toEqual({ designId: 42 })
  })
  it('parses without a locale prefix', () => {
    expect(parseMakerworldUrl('https://makerworld.com/models/123')).toEqual({
      designId: 123,
    })
  })
  it('parses scheme-less and www. inputs', () => {
    expect(parseMakerworldUrl('makerworld.com/en/models/123')).toEqual({
      designId: 123,
    })
    expect(
      parseMakerworldUrl('https://www.makerworld.com/en/models/123'),
    ).toEqual({ designId: 123 })
  })
  it('tolerates trailing slash and query string', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/123-x/?from=search'),
    ).toEqual({ designId: 123 })
  })
  it('extracts profileId from the fragment', () => {
    expect(
      parseMakerworldUrl(
        'https://makerworld.com/en/models/123-x#profileId-456',
      ),
    ).toEqual({ designId: 123, profileId: 456 })
  })
  it('rejects non-makerworld hosts', () => {
    expect(
      parseMakerworldUrl('https://www.thingiverse.com/thing:123'),
    ).toBeNull()
  })
  it('rejects non-model makerworld pages', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/collections/1-api'),
    ).toBeNull()
    expect(parseMakerworldUrl('https://makerworld.com/en/@someone')).toBeNull()
  })
  it('rejects non-numeric ids and garbage', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/abc-def'),
    ).toBeNull()
    expect(parseMakerworldUrl('')).toBeNull()
    expect(parseMakerworldUrl('not a url at all')).toBeNull()
  })
})

describe('makerworldErrorMessage', () => {
  it('has a user-facing message for every error code in every locale', () => {
    const codes: MakerworldErrorCode[] = [
      'token_missing',
      'design_not_found',
      'no_instance',
      'auth_expired',
      'download_failed',
      'too_large',
    ]
    for (const locale of LOCALES) {
      for (const code of codes) {
        expect(makerworldErrorMessage(code, getStrings(locale))).toBeTruthy()
      }
    }
  })
})
