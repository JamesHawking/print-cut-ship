import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpFromLine, Box, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { track } from '@/lib/funnel'
import { useStrings } from '@/lib/i18n'
import { ACCEPT_ATTR, partitionFiles, type IntakeRejection } from '@/lib/upload'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { HeroLiveState } from '@/hooks/useHeroLiveQuote'
import type { DemoId } from '../how-it-works/demo'
import { MeasuredCard } from './MeasuredCard'
import { MeasuringPanel } from './MeasuringPanel'
import {
  DemoPanel,
  DragFace,
  LinkPanel,
  RejectedPanel,
  UploadPanel,
} from './intake-panels'

type IntakeTab = 'upload' | 'link' | 'demo'

/**
 * 5b asks for a 120-out / 160-in crossfade. The incoming panel fades; the
 * outgoing one is simply gone, because the box is a fixed height and the swap
 * lands in a single frame — there is no gap to cover, and two panels stacked
 * at partial opacity would just double the ink for an eighth of a second.
 */
const PANEL_FACE =
  'h-full focus-visible:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[160ms] motion-safe:ease-enter'

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
  live,
  linkOpenSignal,
  onPickerReady,
  selectedDemoId,
  onSelectDemo,
  demoTotals,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
  /** Drives the two faces the tabs hand over to: measuring, then measured. */
  live: HeroLiveState
  /** Bumped by the sticky bar's link button — opens the Link tab. */
  linkOpenSignal?: number
  /** Hands the file input's opener out (the quoted chip, the demo CTA). */
  onPickerReady?: (open: () => void) => void
  selectedDemoId: DemoId | null
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

  // Where the sliding underline sits. Measured rather than derived: the tab
  // widths depend on the locale's labels, on whether the icons are showing
  // (they drop below 430px), and on when the mono font finishes loading — so
  // every trigger is observed, not just the list.
  const listRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]')
      if (active) {
        setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
      }
    }
    measure()
    // The mono webfont lands after first paint and every label changes width
    // with it; the observer below would catch that, but only once it has been
    // wired up, so ask directly too.
    void document.fonts?.ready.then(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    for (const child of list.children) ro.observe(child)
    return () => ro.disconnect()
  }, [tab, strings])

  function handleUrlSubmit(e?: FormEvent) {
    e?.preventDefault()
    const url = urlValue.trim()
    if (!url || urlPending || !onUrl) return
    onUrl(url)
    setUrlValue('')
  }

  // Once a file is in flight the tabs have made their choice, so the tablist
  // stays put (the box must not change height — 5c) but stops responding: a
  // tab switch mid-measure would move nothing behind the face on top of it.
  const handedOver = live.kind !== 'demo'

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
        ref={listRef}
        aria-label={c.tabsLabel}
        // inert, not just pointer-events-none: a dimmed control that keyboard
        // users can still tab into is worse than no control.
        inert={dragging || handedOver}
        className={cn(
          'relative flex border-b-[1.5px] motion-safe:transition-opacity motion-safe:duration-(--duration-flip)',
          // The tabs step back while a file is over the window, and again
          // once one has been handed to the engine.
          (dragging || handedOver) && 'opacity-40',
        )}
      >
        {/* One underline that travels, rather than three that blink on and
          off (5b): the mark stays the same object, so the eye follows it to
          the tab it landed on instead of re-finding it. */}
        <span
          aria-hidden
          className={cn(
            'bg-primary motion-safe:ease-enter absolute bottom-[-1.5px] h-[2.5px] motion-safe:transition-[left,width] motion-safe:duration-(--duration-tab)',
            // Nothing to draw until the first measurement lands, and drawing
            // a zero-width mark would make the first paint slide.
            !indicator.width && 'opacity-0',
          )}
          style={indicator}
        />
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
              // The 2.5px bottom border is now the sliding indicator's job;
              // the transparent border stays as the spacer that keeps the
              // label from shifting when the mark arrives.
              'relative -mb-[1.5px] flex min-h-11 cursor-pointer items-center gap-2 border-b-[2.5px] border-transparent px-3.5 max-[400px]:px-3',
              'font-mono text-[11px] font-bold tracking-[0.1em] whitespace-nowrap uppercase',
              'text-muted-foreground data-[state=active]:text-foreground',
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
          <div className="motion-safe:animate-in motion-safe:fade-in absolute inset-0 z-10 motion-safe:duration-(--duration-flip)">
            <DragFace count={fileCount} />
          </div>
        )}
        {/* The engine has the file: the tabs' panels give way rather than
          stack behind these, so nothing shows through and nothing keyboard-
          reachable survives underneath. */}
        {live.kind === 'measuring' ? (
          <MeasuringPanel
            fileName={live.fileName}
            fileSize={live.fileSize}
            stage={live.stage}
          />
        ) : live.kind === 'quoted' ? (
          <MeasuredCard
            fileName={live.fileName}
            metrics={live.metrics}
            onAdd={openPicker}
          />
        ) : (
          <>
            <TabsContent value="upload" className={PANEL_FACE}>
              {error ? (
                <RejectedPanel rejection={error} onChoose={openPicker} />
              ) : (
                <UploadPanel onChoose={openPicker} />
              )}
            </TabsContent>
            <TabsContent value="link" className={PANEL_FACE}>
              <LinkPanel
                value={urlValue}
                onChange={setUrlValue}
                onSubmit={handleUrlSubmit}
                pending={urlPending}
                autoFocus={focusLinkInput}
              />
            </TabsContent>
            <TabsContent value="demo" className={PANEL_FACE}>
              <DemoPanel
                selectedId={selectedDemoId}
                onSelect={onSelectDemo}
                totals={demoTotals}
              />
            </TabsContent>
          </>
        )}
      </div>

      {/* Not a live region: the tablist already announces the switch, and the
        hero's one announcer sits at the top of the section.

        The slot is reserved for the longest line the copy can wrap to, so
        this paragraph cannot change the island's height (5b: a tab switch has
        no height change). Without it, switching to Paste-a-link wrapped the
        fine print to a second line and pushed the whole page down 15px. */}
      <p className="text-muted-foreground/80 mt-3.5 min-h-8 font-mono text-[0.6rem] leading-relaxed tracking-[0.1em] uppercase max-sm:min-h-12">
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
