import { describe, expect, test } from 'bun:test'
import { editorActionForKey, isEditableTarget } from './editor-shortcuts'

describe('editorActionForKey', () => {
  test('digits map to camera presets', () => {
    expect(editorActionForKey('1')).toEqual({
      type: 'preset',
      preset: 'front',
    })
    expect(editorActionForKey('3')).toEqual({
      type: 'preset',
      preset: 'right',
    })
    expect(editorActionForKey('7')).toEqual({ type: 'preset', preset: 'top' })
    expect(editorActionForKey('0')).toEqual({ type: 'preset', preset: 'iso' })
  })

  test('letters map to viewport actions, case-insensitive', () => {
    expect(editorActionForKey('r')).toEqual({ type: 'reset' })
    expect(editorActionForKey('G')).toEqual({ type: 'toggle-grid' })
    expect(editorActionForKey('A')).toEqual({ type: 'toggle-rotate' })
  })

  test('unknown keys yield null', () => {
    expect(editorActionForKey('x')).toBeNull()
    expect(editorActionForKey('2')).toBeNull()
    expect(editorActionForKey('Escape')).toBeNull()
  })
})

describe('isEditableTarget', () => {
  test('form fields are editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true)
  })

  test('contentEditable is editable', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true,
    )
  })

  test('everything else is not', () => {
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false)
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
