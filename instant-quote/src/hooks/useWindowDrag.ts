import { useEffect, useRef, useState } from 'react'

/**
 * Window-wide file drag (Mobile Audit build note 3): the whole page is the
 * drop target, not just the intake panel — "the tabs are a view, not a mode
 * you can get stuck in". Also stops the browser's default behaviour of
 * navigating away when a file lands anywhere outside a drop zone.
 *
 * Depth-counted: dragenter/dragleave fire per element, so crossing a child
 * boundary would otherwise flicker the state off (the bug the old
 * per-element handler had). Only file drags arm it — dragging selected text
 * or a link must not put the intake in its drop face.
 */
export function useWindowDrag(onDrop: (files: File[]) => void): {
  dragging: boolean
  fileCount: number
} {
  const [dragging, setDragging] = useState(false)
  // dataTransfer.items is readable during the drag; the FILES are not
  // (getAsFile() returns null until drop), so the count is all we can show.
  const [fileCount, setFileCount] = useState(0)
  const depth = useRef(0)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    const carriesFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    function reset() {
      depth.current = 0
      setDragging(false)
      setFileCount(0)
    }

    function handleEnter(e: DragEvent) {
      if (!carriesFiles(e)) return
      depth.current += 1
      setFileCount(
        Array.from(e.dataTransfer?.items ?? []).filter((i) => i.kind === 'file')
          .length,
      )
      setDragging(true)
    }

    function handleOver(e: DragEvent) {
      if (!carriesFiles(e)) return
      // Required for `drop` to fire at all, and it is what suppresses the
      // browser opening the file in this tab.
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    function handleLeave(e: DragEvent) {
      if (!carriesFiles(e)) return
      depth.current -= 1
      if (depth.current <= 0) reset()
    }

    function handleDrop(e: DragEvent) {
      if (!carriesFiles(e)) return
      e.preventDefault()
      reset()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) onDropRef.current(files)
    }

    window.addEventListener('dragenter', handleEnter)
    window.addEventListener('dragover', handleOver)
    window.addEventListener('dragleave', handleLeave)
    window.addEventListener('drop', handleDrop)
    // A drag that ends outside the window (Esc, or dropped on another app)
    // leaves no dragleave on some platforms.
    window.addEventListener('dragend', reset)
    return () => {
      window.removeEventListener('dragenter', handleEnter)
      window.removeEventListener('dragover', handleOver)
      window.removeEventListener('dragleave', handleLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', reset)
    }
  }, [])

  return { dragging, fileCount }
}
