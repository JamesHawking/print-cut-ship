import { describe, expect, test } from 'bun:test'
import { detectLocale, parseAcceptLanguage, parseLocaleCookie } from './detect'
import { localizedPath } from './head'

describe('parseAcceptLanguage', () => {
  test('matches base languages and regional tags', () => {
    expect(parseAcceptLanguage('pl')).toBe('pl')
    expect(parseAcceptLanguage('pl-PL,pl;q=0.9,en;q=0.8')).toBe('pl')
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en')
  })
  test('first supported language wins over later entries', () => {
    expect(parseAcceptLanguage('de-DE,en;q=0.8,pl;q=0.7')).toBe('en')
  })
  test('unsupported or garbage input yields null', () => {
    expect(parseAcceptLanguage('de-DE,fr;q=0.8')).toBeNull()
    expect(parseAcceptLanguage('*')).toBeNull()
    expect(parseAcceptLanguage('')).toBeNull()
    expect(parseAcceptLanguage(undefined)).toBeNull()
  })
})

describe('parseLocaleCookie', () => {
  test('reads the locale cookie among others', () => {
    expect(parseLocaleCookie('locale=en')).toBe('en')
    expect(parseLocaleCookie('a=1; locale=pl; b=2')).toBe('pl')
  })
  test('ignores invalid values and unrelated cookies', () => {
    expect(parseLocaleCookie('locale=xx')).toBeNull()
    expect(parseLocaleCookie('other=en')).toBeNull()
    expect(parseLocaleCookie(undefined)).toBeNull()
  })
})

describe('detectLocale', () => {
  test('cookie beats Accept-Language beats default', () => {
    expect(
      detectLocale({ cookie: 'locale=pl', acceptLanguage: 'en-US,en' }),
    ).toBe('pl')
    expect(detectLocale({ acceptLanguage: 'en-US,en' })).toBe('en')
    expect(detectLocale({})).toBe('pl')
    expect(detectLocale({ cookie: 'locale=bad', acceptLanguage: 'fr' })).toBe(
      'pl',
    )
  })
})

describe('localizedPath', () => {
  test('swaps the locale prefix in place', () => {
    expect(localizedPath('/pl/quote', 'en')).toBe('/en/quote')
    expect(localizedPath('/en', 'pl')).toBe('/pl')
    expect(localizedPath('/pl', 'pl')).toBe('/pl')
  })
  test('does not touch look-alike segments', () => {
    expect(localizedPath('/please/login', 'en')).toBe('/please/login')
  })
})
