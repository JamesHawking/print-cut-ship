import { describe, expect, test } from 'bun:test'
import type { Part } from '@/hooks/useParts'
import { pickSelectedPart } from './select-part'

function part(id: string, status: Part['status'] = 'ready'): Part {
  return {
    id,
    fileName: `${id}.stl`,
    fileSize: 1,
    kind: 'mesh',
    status,
    config: { process: 'pla', quantity: 1, leadTime: 'standard' },
  }
}

describe('pickSelectedPart', () => {
  test('explicit selection wins even when not ready', () => {
    const parts = [part('a'), part('b', 'parsing')]
    expect(pickSelectedPart(parts, 'b')?.id).toBe('b')
  })

  test('no selection prefers the first ready part over the last part', () => {
    const parts = [part('a'), part('b'), part('c', 'parsing')]
    expect(pickSelectedPart(parts, null)?.id).toBe('a')
  })

  test('all parsing falls back to the last part', () => {
    const parts = [part('a', 'parsing'), part('b', 'parsing')]
    expect(pickSelectedPart(parts, null)?.id).toBe('b')
  })

  test('removed selection falls back to the first ready part', () => {
    const parts = [part('a'), part('b')]
    expect(pickSelectedPart(parts, 'gone')?.id).toBe('a')
  })

  test('empty list yields null', () => {
    expect(pickSelectedPart([], null)).toBeNull()
  })
})
