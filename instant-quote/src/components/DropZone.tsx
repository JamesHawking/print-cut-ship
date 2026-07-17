import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
import { ACCEPT_ATTR } from '@/lib/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  variant?: 'default' | 'compact' | 'hero'
  disabled?: boolean
  onUrl?: (url: string) => void
  urlPending?: boolean
}

export function DropZone({
  onFiles,
  variant = 'default',
  disabled,
  onUrl,
  urlPending,
}: DropZoneProps) {
  const strings = useStrings()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const compact = variant === 'compact'
  const hero = variant === 'hero'

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  // Two nested layers, deliberately split: the OUTER container owns the
  // drag-and-drop surface (no ARIA role), the INNER region is the
  // role="button" file picker. Keeping role="button" off the container
  // keeps the MakerWorld form out of it — ARIA forbids interactive
  // descendants inside a button role.
  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      if (!disabled) setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  }

  const pickerButton = {
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

  function handleUrlSubmit(e: FormEvent) {
    e.preventDefault()
    const url = urlValue.trim()
    if (!url || urlPending || !onUrl) return
    onUrl(url)
    setUrlValue('')
  }

  // The zone's clickable region is a role="button" file picker — the form
  // must not let clicks or keystrokes (e.g. Space in the input) bubble up
  // to it.
  const urlForm = onUrl && (
    <form
      className={cn(
        'flex w-full max-w-sm cursor-auto flex-col gap-2',
        compact && 'mx-auto max-w-xs',
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onSubmit={handleUrlSubmit}
    >
      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-widest uppercase">
        {strings.dropzone.mwLabel}
      </span>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="url"
          value={urlValue}
          disabled={urlPending}
          placeholder={strings.dropzone.mwPlaceholder}
          aria-label={strings.dropzone.mwLabel}
          className="h-9 font-mono text-xs"
          onChange={(e) => setUrlValue(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 font-bold"
          disabled={urlPending || !urlValue.trim()}
        >
          {urlPending ? (
            <>
              <Loader2 className="animate-spin" />
              {strings.dropzone.mwFetching}
            </>
          ) : (
            strings.dropzone.mwButton
          )}
        </Button>
      </div>
    </form>
  )

  if (hero) {
    return (
      <div
        {...dropHandlers}
        className={cn(
          'group border-border bg-card hover:border-primary/60 relative isolate flex min-h-[300px] flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border px-[22px] py-9 text-center shadow-xl shadow-black/[0.06] transition-[border-color,box-shadow] hover:shadow-2xl md:min-h-[440px] md:px-8 md:py-14',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {/* alignment / registration marks */}
        <CornerMarks />
        {/* dashed intake frame */}
        <div className="border-border pointer-events-none absolute inset-4 rounded border border-dashed" />
        <div className="relative flex flex-col items-center gap-4">
          <div
            {...pickerButton}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-4 rounded-md',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
          >
            <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.2em] uppercase">
              {strings.dropzone.intake}
            </span>
            <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {strings.dropzone.idle}
            </p>
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-bold transition-transform group-hover:-translate-y-px">
              {strings.dropzone.button}
            </span>
            <span className="text-muted-foreground font-mono text-[0.7rem] tracking-widest uppercase">
              {strings.dropzone.formats}
            </span>
          </div>
          {urlForm}
        </div>
        {/* build-envelope limit, pinned to the frame's lower edge */}
        <span className="text-muted-foreground/80 pointer-events-none absolute inset-x-0 bottom-6 font-mono text-[0.6rem] tracking-[0.18em] uppercase">
          {strings.dropzone.maxSize}
        </span>
        {/* full-cover armed overlay while a file is dragged over the zone */}
        {dragging && (
          <div className="bg-primary-tint border-primary animate-in fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-lg border-2 duration-150 ease-out">
            <span className="border-primary/70 pointer-events-none absolute inset-3.5 rounded border border-dashed" />
            <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.2em] uppercase">
              {strings.dropzone.intakeArmed}
            </span>
            <p className="text-3xl font-extrabold tracking-tight">
              {strings.dropzone.dragActive}
            </p>
          </div>
        )}
        {input}
      </div>
    )
  }

  return (
    <div
      {...dropHandlers}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'pointer-events-none opacity-50',
        compact ? 'gap-1 px-4 py-6' : 'gap-2 px-6 py-16',
      )}
    >
      <div
        {...pickerButton}
        className={cn(
          'flex cursor-pointer flex-col items-center rounded-md',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          compact ? 'gap-1' : 'gap-2',
        )}
      >
        <Upload
          className={cn(
            'text-muted-foreground group-hover:text-primary transition-colors',
            compact ? 'size-4' : 'size-8',
          )}
        />
        <p className={cn('font-medium', compact ? 'text-sm' : 'text-lg')}>
          {dragging ? strings.dropzone.dragActive : strings.dropzone.idle}
        </p>
        {compact ? (
          <p className="text-muted-foreground font-mono text-[0.59375rem] tracking-wider uppercase">
            {strings.dropzone.multiHint}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {strings.dropzone.hint}
          </p>
        )}
      </div>
      {urlForm && (
        <div className={cn('w-full px-2', compact ? 'mt-3' : 'mt-2')}>
          {urlForm}
        </div>
      )}
      {input}
    </div>
  )
}

/** TE/Anduril-style corner alignment marks. */
export function CornerMarks() {
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
