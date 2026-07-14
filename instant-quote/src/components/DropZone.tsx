import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { ACCEPT_ATTR } from '@/lib/upload'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  compact?: boolean
  disabled?: boolean
}

export function DropZone({ onFiles, compact, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={strings.dropzone.idle}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'pointer-events-none opacity-50',
        compact ? 'gap-1 px-4 py-6' : 'gap-2 px-6 py-16',
      )}
    >
      <Upload
        className={cn(
          'text-muted-foreground group-hover:text-primary transition-colors',
          compact ? 'size-5' : 'size-8',
        )}
      />
      <p className={cn('font-medium', compact ? 'text-sm' : 'text-lg')}>
        {dragging ? strings.dropzone.dragActive : strings.dropzone.idle}
      </p>
      {!compact && (
        <p className="text-muted-foreground text-sm">{strings.dropzone.hint}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
