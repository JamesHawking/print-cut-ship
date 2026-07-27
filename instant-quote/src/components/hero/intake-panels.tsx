import { useEffect, useRef } from 'react'
import { Box, Disc2, Link2, Loader2, PanelTop, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDims, formatPln } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { DEMO_PARTS, type DemoId } from '../how-it-works/demo'
import type { IntakeRejection } from '@/lib/upload'

// The four faces of the intake's fixed-height panel (Mobile Audit 4b).
// Presentational only — IntakeTabs owns every piece of state. Each fills its
// box with h-full so the box, not the content, sets the height.

const DASHED =
  'border-muted-foreground/45 rounded-lg border-[1.5px] border-dashed'
const PRIMARY_BUTTON =
  'bg-primary text-primary-foreground focus-visible:ring-ring flex cursor-pointer items-center justify-center rounded-md font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'

export function UploadPanel({ onChoose }: { onChoose: () => void }) {
  const c = useStrings().hero.console
  return (
    <div
      className={cn(
        DASHED,
        'flex h-full flex-col items-center justify-center gap-3 px-4 text-center',
      )}
    >
      {/* plus medallion — the intake's mark, orange like the CTA it sits on */}
      <span
        aria-hidden
        className="border-primary relative size-11 shrink-0 rounded-[7px] border-[1.5px]"
      >
        <span className="bg-primary absolute top-1/2 left-1/2 h-[1.5px] w-4 -translate-x-1/2 -translate-y-1/2" />
        <span className="bg-primary absolute top-1/2 left-1/2 h-4 w-[1.5px] -translate-x-1/2 -translate-y-1/2" />
      </span>
      {/* Drag language is sm+ only: there is nothing to drag on touch. */}
      <p className="text-[19px]/[1.15] font-extrabold tracking-[-0.015em] max-sm:hidden">
        {c.uploadLead}
      </p>
      <button
        type="button"
        onClick={onChoose}
        className={cn(
          PRIMARY_BUTTON,
          'h-12 px-6 text-[15px] max-sm:h-14 max-sm:w-full',
        )}
      >
        {c.chooseFile}
      </button>
      <p className="text-muted-foreground text-[13px]">{c.formats}</p>
    </div>
  )
}

export function LinkPanel({
  value,
  onChange,
  onSubmit,
  pending,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  pending?: boolean
  /** Focus the URL field on mount — the panel opened by pointer on sm+. */
  autoFocus?: boolean
}) {
  const strings = useStrings()
  const c = strings.hero.console
  // The panel mounts exactly when its tab activates, so its own mount is the
  // one moment the field is guaranteed to exist — focusing from the parent's
  // effect raced the child's ref attachment.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])
  return (
    <form
      className="flex h-full flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <label className="border-primary focus-within:ring-primary/15 flex h-14 shrink-0 items-center gap-3 rounded-lg border-[1.5px] px-3.5 focus-within:ring-[3px]">
        <Link2
          aria-hidden
          className="text-muted-foreground size-[18px] shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          inputMode="url"
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          placeholder={strings.dropzone.mwPlaceholder}
          aria-label={c.pasteLink}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className={cn(
          PRIMARY_BUTTON,
          'h-12 shrink-0 gap-2 text-[15px] disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {pending ? strings.dropzone.mwFetching : c.linkFetch}
      </button>
      <div className="mt-auto border-t pt-3.5">
        <p className="text-muted-foreground font-mono text-[9.6px] font-bold tracking-[0.14em] uppercase">
          {c.worksWithLabel}
        </p>
        <p className="text-muted-foreground mt-1.5 text-[12.5px]/[1.45]">
          {c.worksWithBody}
        </p>
      </div>
    </form>
  )
}

// Persona meta + icon per demo part; the price comes from the live engine.
// Each icon has to read as a PART, never as a form control: a bare circle and
// square beside a selectable row are an unchecked radio and checkbox, which
// would fight the real selection cue (the orange border and tint). Concentric
// rings say bushing; a panel with its seam says lid.
const DEMO_META: Record<
  DemoId,
  {
    icon: typeof Box
    metaKey: 'demoMetaBracket' | 'demoMetaBearing' | 'demoMetaLid'
  }
> = {
  bracket: { icon: Box, metaKey: 'demoMetaBracket' },
  bearing: { icon: Disc2, metaKey: 'demoMetaBearing' },
  lid: { icon: PanelTop, metaKey: 'demoMetaLid' },
}

export function DemoPanel({
  selectedId,
  onSelect,
  totals,
}: {
  selectedId: DemoId
  onSelect: (id: DemoId) => void
  /** Line totals in DEMO_PARTS order, already fallback-resolved. */
  totals: number[]
}) {
  const c = useStrings().hero.console
  const locale = useLocale()
  return (
    <div className="flex h-full flex-col gap-2.5">
      <p className="text-muted-foreground shrink-0 text-[13.5px]/[1.4] text-pretty max-sm:hidden">
        {c.demoIntro}
      </p>
      {DEMO_PARTS.map((part, i) => {
        const selected = part.id === selectedId
        const { icon: Icon, metaKey } = DEMO_META[part.id]
        return (
          <button
            key={part.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(part.id)}
            className={cn(
              // A grid, not a flex row: the meta line runs under the price so
              // it gets the full width back. As a flex row it was squeezed to
              // ~129px at 360px and every filename and meta was cut in half.
              // minmax(0,1fr) is the grid form of min-w-0 — without it the
              // middle column refuses to shrink and pushes the island out.
              'focus-visible:ring-ring grid flex-1 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-lg border px-3.5 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none',
              selected
                ? 'border-primary bg-primary-tint border-[1.5px]'
                : 'hover:border-muted-foreground/40',
            )}
          >
            {/* Decorative, and the first thing to go at 360px: its 36px plus
              the gap is exactly what the filename and meta need to stay
              whole. Same call as the tab icons below 430px. */}
            <span
              aria-hidden
              className={cn(
                'row-span-2 flex size-9 shrink-0 items-center justify-center rounded-md border max-sm:hidden',
                selected ? 'border-primary/40' : 'border-muted-foreground/25',
              )}
            >
              <Icon
                className={cn(
                  'size-5',
                  selected ? 'text-primary-text' : 'text-muted-foreground',
                )}
                strokeWidth={1.5}
              />
            </span>
            <span className="col-start-2 truncate font-mono text-[12.5px] font-bold">
              {part.file.name}
            </span>
            <span
              className={cn(
                'col-start-3 row-start-1 text-right font-mono text-[12px] font-bold tabular-nums',
                selected ? 'text-primary-text' : 'text-muted-foreground',
              )}
            >
              {formatPln(totals[i], locale)}
            </span>
            {/* One line, always: a wrapping meta would make this row taller
              than its siblings inside the fixed panel. */}
            <span className="text-muted-foreground col-start-2 -col-end-1 mt-0.5 truncate font-mono text-[9.6px] tracking-[0.08em] uppercase">
              {/* The selected row states what the chamber is showing; the
                others carry their persona. */}
              {selected
                ? `${formatDims(part.metrics.bboxMm, locale)} · ${c.demoShowing}`
                : c[metaKey]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function RejectedPanel({
  rejection,
  onChoose,
}: {
  rejection: IntakeRejection
  onChoose: () => void
}) {
  const c = useStrings().hero.console
  const isType = rejection.reason === 'type'
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        role="alert"
        className="border-destructive/40 bg-destructive/5 shrink-0 rounded-lg border p-3.5"
      >
        <p className="text-destructive flex items-start gap-2 text-[14px]/[1.25] font-extrabold">
          <UploadCloud aria-hidden className="mt-px size-4 shrink-0" />
          <span className="min-w-0 break-all">
            {isType
              ? c.rejectTitleType(rejection.fileName)
              : c.rejectTitleSize(rejection.fileName)}
          </span>
        </p>
        <p className="text-muted-foreground mt-2 text-[13.5px]/[1.4] text-pretty">
          {isType ? c.rejectBodyType : c.rejectBodySize}
        </p>
      </div>
      <div
        className={cn(
          DASHED,
          'flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
        )}
      >
        <button
          type="button"
          onClick={onChoose}
          className={cn(PRIMARY_BUTTON, 'h-12 shrink-0 px-6 text-[15px]')}
        >
          {c.chooseAnother}
        </button>
        <p className="text-muted-foreground text-[13px]">{c.formats}</p>
      </div>
    </div>
  )
}

/** The whole page is the drop target — this is what a file over it looks like. */
export function DragFace({ count }: { count: number }) {
  const c = useStrings().hero.console
  return (
    <div className="border-primary bg-primary-tint flex h-full flex-col items-center justify-center gap-3 rounded-lg border-[2.5px] border-dashed px-4 text-center">
      <UploadCloud
        aria-hidden
        className="text-primary-text size-10"
        strokeWidth={1.8}
      />
      <p className="text-primary-text text-[22px]/[1.1] font-extrabold tracking-[-0.02em]">
        {c.dropToPrice}
      </p>
      {count > 0 && (
        <p className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase">
          {c.dropCount(count)}
        </p>
      )}
    </div>
  )
}
