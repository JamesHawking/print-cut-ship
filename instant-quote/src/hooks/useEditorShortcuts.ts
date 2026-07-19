import { useEffect } from 'react'
import type { CameraPreset } from '@/lib/camera-presets'
import { editorActionForKey, isEditableTarget } from '@/lib/editor-shortcuts'

/**
 * Window-level keyboard shortcuts for the quote editor viewport. Ignores
 * modified keys and editable targets; `enabled` gates the listener so the
 * mobile layout never reacts.
 */
export function useEditorShortcuts({
  enabled,
  onPreset,
  onReset,
  onToggleGrid,
  onToggleAutoRotate,
}: {
  enabled: boolean
  onPreset: (preset: CameraPreset) => void
  onReset: () => void
  onToggleGrid: () => void
  onToggleAutoRotate: () => void
}): void {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.defaultPrevented) return
      if (isEditableTarget(event.target as HTMLElement | null)) return
      // Radix widgets handle single-character keys without preventDefault
      // (Select typeahead — the closed trigger keeps focus after a
      // selection — and open listboxes/menus/dialogs), so tag-name guards
      // don't catch them.
      const widget = (event.target as HTMLElement | null)?.closest?.(
        '[role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="dialog"], [role="alertdialog"]',
      )
      if (widget) return
      const action = editorActionForKey(event.key)
      if (!action) return
      event.preventDefault()
      switch (action.type) {
        case 'preset':
          onPreset(action.preset)
          break
        case 'reset':
          onReset()
          break
        case 'toggle-grid':
          onToggleGrid()
          break
        case 'toggle-rotate':
          onToggleAutoRotate()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onPreset, onReset, onToggleGrid, onToggleAutoRotate])
}
