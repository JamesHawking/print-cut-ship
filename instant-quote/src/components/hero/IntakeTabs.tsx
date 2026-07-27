import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpFromLine, Box, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { track } from '@/lib/funnel'
import { useStrings } from '@/lib/i18n'
import { ACCEPT_ATTR, partitionFiles, type IntakeRejection } from '@/lib/upload'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DemoId } from '../how-it-works/demo'
import {
  DemoPanel,
  DragFace,
  LinkPanel,
  RejectedPanel,
  UploadPanel,
} from './intake-panels'

type IntakeTab = 'upload' | 'link' | 'demo'

/** Never on a phone: the keyboard would cover the panel the user just opened. */
const wantsFieldFocus = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(min-width: 640px)').matches

const TABS: Array<{
  id: IntakeTab
  icon: typeof Box
  labelKey: 'tabUpload' | 'tabLink' | 'tabDemo'
}> = [
  { id: 'upload', icon: ArrowUpFromLine, labelKey: 'tabUpload' },
  { id: 'link', icon: Link2, labelKey: 'tabLink' },
  // Demo stays third — it must never outrank a real file (build note 4).
  { id: 'demo', icon: Box, labelKey: 'tabDemo' },
]

/**
 * The hero intake, as three tabs (Mobile Audit Turn 4). Upload is always the
 * active tab on mount — a returning visitor almost always has a file, and a
 * link or demo panel on load reads as "this isn't for me" (build note 1), so
 * the choice is deliberately never persisted.
 *
 * The panel box is a fixed height at every state so switching tabs cannot
 * move the quote chamber or the fold (build note 2), and the drop target is
 * the whole window, not this box — a file dropped anywhere switches to Upload
 * and proceeds (build note 3).
 */
export function IntakeTabs({
  onFiles,
  onUrl,
  urlPending,
  quoted,
  linkOpenSignal,
  onPickerReady,
  selectedDemoId,
  onSelectDemo,
  demoTotals,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
  /** A live quote is showing: the tabs collapse to the add-another row. */
  quoted?: boolean
  /** Bumped by the sticky bar's link button — opens the Link tab. */
  linkOpenSignal?: number
  /** Hands the file input's opener out (the quoted chip, the demo CTA). */
  onPickerReady?: (open: () => void) => void
  selectedDemoId: DemoId
  onSelectDemo: (id: DemoId) => void
  demoTotals: number[]
}) {
  const strings = useStrings()
  const c = strings.hero.console
  const [tab, setTab] = useState<IntakeTab>('upload')
  const [error, setError] = useState<IntakeRejection | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus follows a pointer, never a key: a keyboard user arrowing to the
  // Link tab should keep focus on the tab (ARIA), and on a phone stealing
  // focus into the field would throw the keyboard over the panel.
  const pointerIntent = useRef(false)
  const [focusLinkInput, setFocusLinkInput] = useState(false)

  const openPicker = () => inputRef.current?.click()

  useEffect(() => {
    onPickerReady?.(openPicker)
  }, [onPickerReady])

  // The sticky bar's link button is explicit intent to paste, so it focuses
  // the field like a pointer would.
  useEffect(() => {
    if (!linkOpenSignal) return
    setTab('link')
    setFocusLinkInput(wantsFieldFocus())
  }, [linkOpenSignal])

  /** Every file enters here: picker, window drop, or an out-of-tree CTA. */
  function submitFiles(files: File[]) {
    // A drop while on Demo is not a mode you can get stuck in.
    selectTab('upload')
    const { accepted, rejected } = partitionFiles(files)
    if (accepted.length) {
      setError(null)
      onFiles(accepted)
    } else if (rejected.length) {
      setError(rejected[0])
    }
  }

  function selectTab(next: IntakeTab) {
    setError(null)
    // Consume the pointer flag here, where the activation actually lands.
    setFocusLinkInput(
      next === 'link' && pointerIntent.current && wantsFieldFocus(),
    )
    pointerIntent.current = false
    setTab((prev) => {
      if (prev !== next) track('intake_tab_changed', { tab: next })
      return next
    })
  }

  const { dragging, fileCount } = useWindowDrag(submitFiles)

  function handleUrlSubmit(e?: FormEvent) {
    e?.preventDefault()
    const url = urlValue.trim()
    if (!url || urlPending || !onUrl) return
    onUrl(url)
    setUrlValue('')
  }

  // Quoted: the tabs have done their job — all that is left is the way to
  // add another file. (Kept mounted, never conditionally unmounted, so the
  // file input and its registered opener survive.)
  if (quoted) {
    return (
      <div className="opacity-55 transition-opacity duration-300">
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          className="group border-muted-foreground/45 hover:border-primary/60 focus-visible:ring-ring flex cursor-pointer items-center gap-4 rounded-md border-[1.5px] border-dashed px-4 py-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="border-foreground relative size-[34px] shrink-0 rounded-[5px] border-[1.5px]"
          >
            <span className="bg-foreground absolute top-1/2 left-1/2 h-[1.5px] w-3 -translate-x-1/2 -translate-y-1/2" />
            <span className="bg-foreground absolute top-1/2 left-1/2 h-3 w-[1.5px] -translate-x-1/2 -translate-y-1/2" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{c.ownTitle}</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              <span className="max-sm:hidden">{c.ownHintAdd}</span>
              <span className="sm:hidden">{c.ownHintAddShort}</span>
            </span>
          </span>
        </div>
        {input(inputRef, submitFiles)}
      </div>
    )
  }

  const finePrint = dragging
    ? c.finePrintDrag
    : error
      ? c.finePrintReject
      : tab === 'link'
        ? c.finePrintLink
        : tab === 'demo'
          ? c.finePrintDemo
          : c.finePrint

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => selectTab(v as IntakeTab)}
      // Manual, stated rather than inherited: arrows move between tabs and
      // Enter/Space opens one. Activating on focus would drag a keyboard user
      // into the Link panel's URL input just by arrowing past it.
      activationMode="manual"
      className="flex-1"
    >
      <TabsList
        aria-label={c.tabsLabel}
        className={cn(
          'flex border-b-[1.5px] motion-safe:transition-opacity',
          // The tabs step back while a file is over the window.
          dragging && 'pointer-events-none opacity-40',
        )}
      >
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <TabsTrigger
            key={id}
            value={id}
            // Pointer-down, not click: Radix activates the tab on mousedown,
            // so a click-time flag would be read after the fact — and would
            // then fire on the *next* tab change.
            onPointerDown={() => {
              pointerIntent.current = true
            }}
            className={cn(
              // The border is always there, transparent when inactive, so
              // activating a tab never shifts its label by 2.5px.
              'relative -mb-[1.5px] flex min-h-11 cursor-pointer items-center gap-2 border-b-[2.5px] border-transparent px-3.5 max-[400px]:px-3',
              'font-mono text-[11px] font-bold tracking-[0.1em] whitespace-nowrap uppercase',
              'text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
              'motion-safe:transition-colors',
            )}
          >
            {/* Icons go before the type shrinks: three PL labels with icons
              need 338px and the island is 288px wide at 360. */}
            <Icon
              aria-hidden
              className="size-[15px] shrink-0 max-[430px]:hidden"
              strokeWidth={2}
            />
            {c[labelKey]}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* One fixed box for every face — the panels fill it, never size it. */}
      <div className="relative mt-5 h-[238px] max-sm:h-[15rem]">
        {dragging && (
          <div className="absolute inset-0 z-10">
            <DragFace count={fileCount} />
          </div>
        )}
        <TabsContent
          value="upload"
          className="h-full focus-visible:outline-none"
        >
          {error ? (
            <RejectedPanel rejection={error} onChoose={openPicker} />
          ) : (
            <UploadPanel onChoose={openPicker} />
          )}
        </TabsContent>
        <TabsContent value="link" className="h-full focus-visible:outline-none">
          <LinkPanel
            value={urlValue}
            onChange={setUrlValue}
            onSubmit={handleUrlSubmit}
            pending={urlPending}
            autoFocus={focusLinkInput}
          />
        </TabsContent>
        <TabsContent value="demo" className="h-full focus-visible:outline-none">
          <DemoPanel
            selectedId={selectedDemoId}
            onSelect={onSelectDemo}
            totals={demoTotals}
          />
        </TabsContent>
      </div>

      {/* Not a live region: the tablist already announces the switch, and the
        quote chamber below is the hero's one aria-live surface. */}
      <p className="text-muted-foreground/80 mt-3.5 font-mono text-[0.6rem] leading-relaxed tracking-[0.1em] uppercase">
        {finePrint}
      </p>
      {input(inputRef, submitFiles)}
    </Tabs>
  )
}

/** The one hidden file input — every picker path goes through it. */
function input(
  ref: React.RefObject<HTMLInputElement | null>,
  onPicked: (files: File[]) => void,
) {
  return (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT_ATTR}
      multiple
      className="sr-only"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        if (files.length) onPicked(files)
        e.target.value = ''
      }}
    />
  )
}
