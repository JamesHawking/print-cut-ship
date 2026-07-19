import type { CameraPreset } from './camera-presets'

/**
 * Key map for the quote editor viewport. Digits are a Blender numpad homage
 * (1 front / 3 right / 7 top / 0 iso); letters toggle viewport chrome.
 */
export type EditorAction =
  | { type: 'preset'; preset: CameraPreset }
  | { type: 'reset' }
  | { type: 'toggle-grid' }
  | { type: 'toggle-rotate' }

export function editorActionForKey(key: string): EditorAction | null {
  switch (key.toLowerCase()) {
    case '1':
      return { type: 'preset', preset: 'front' }
    case '3':
      return { type: 'preset', preset: 'right' }
    case '7':
      return { type: 'preset', preset: 'top' }
    case '0':
      return { type: 'preset', preset: 'iso' }
    case 'r':
      return { type: 'reset' }
    case 'g':
      return { type: 'toggle-grid' }
    case 'a':
      return { type: 'toggle-rotate' }
    default:
      return null
  }
}

/** Shortcuts must not fire while the user is typing in a field. */
export function isEditableTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!target) return false
  if (target.isContentEditable) return true
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}
