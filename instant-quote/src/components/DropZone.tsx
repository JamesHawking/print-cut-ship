import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { ACCEPT_ATTR } from '@/lib/upload'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  variant?: 'default' | 'compact' | 'hero'
  disabled?: boolean
}

export function DropZone({
  onFiles,
  variant = 'default',
  disabled,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const compact = variant === 'compact'
  const hero = variant === 'hero'

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  const dnd = {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': strings.dropzone.idle,
    'aria-disabled': disabled,
    onClick: () => !disabled && inputRef.current?.click(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault()
        inputRef.current?.click()
      }
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      if (!disabled) setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  }

  const input = (
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
  )

  if (hero) {
    return (
      <div
        {...dnd}
        className={cn(
          'group bg-card relative isolate overflow-hidden rounded-lg border px-6 py-16 text-center transition-colors sm:py-20',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/60',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {/* alignment / registration marks */}
        <CornerMarks />
        {/* dashed intake frame */}
        <div
          className={cn(
            'pointer-events-none absolute inset-4 rounded border border-dashed transition-colors',
            dragging ? 'border-primary/60' : 'border-border',
          )}
        />
        <div className="relative flex flex-col items-center gap-4">
          <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.2em] uppercase">
            File intake
          </span>
          <p className="text-2xl font-bold tracking-tight sm:text-3xl">
            {dragging ? strings.dropzone.dragActive : strings.dropzone.idle}
          </p>
          <span className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold transition-transform group-hover:-translate-y-px">
            <Upload className="size-4" />
            {strings.dropzone.button}
          </span>
          <span className="text-muted-foreground font-mono text-[0.7rem] tracking-widest uppercase">
            STL · 3MF · OBJ · STEP — up to 100 MB
          </span>
        </div>
        {input}
      </div>
    )
  }

  return (
    <div
      {...dnd}
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
      {input}
    </div>
  )
}

/** TE/Anduril-style corner alignment marks. */
function CornerMarks() {
  const base = 'pointer-events-none absolute size-3 border-foreground/25'
  return (
    <>
      <span className={cn(base, 'top-2.5 left-2.5 border-t-2 border-l-2')} />
      <span className={cn(base, 'top-2.5 right-2.5 border-t-2 border-r-2')} />
      <span className={cn(base, 'bottom-2.5 left-2.5 border-b-2 border-l-2')} />
      <span
        className={cn(base, 'right-2.5 bottom-2.5 border-r-2 border-b-2')}
      />
    </>
  )
}
