import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { PRICING, PROCESS_IDS } from '@/lib/pricing-config'
import { DropZone } from './DropZone'

// Capability figures pulled straight from the pricing config, zipped with the
// labels in strings.hero.specs (same order).
const SPEC_VALUES = [
  String(PROCESS_IDS.length),
  `${PRICING.processes.pla.build.x}³`,
  `${PRICING.leadTimes.express.businessDays}–${PRICING.leadTimes.economy.businessDays}`,
  'PLN',
]

export function Hero({ onFiles }: { onFiles: (files: File[]) => void }) {
  const specs = strings.hero.specs.map((label, i) => ({
    label,
    value: SPEC_VALUES[i],
  }))

  return (
    <section
      id="top"
      className="relative isolate min-h-screen scroll-mt-0 overflow-hidden"
    >
      {/* faint technical dot-grid, faded toward the fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] [background-size:22px_22px]"
      />
      <CornerMarks />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* brand / status bar */}
        <div className="text-muted-foreground flex items-center justify-between border-b py-4 font-mono text-xs tracking-widest uppercase">
          <span className="text-foreground font-bold">
            {strings.hero.wordmark}
          </span>
          <span className="flex items-center gap-4">
            <span className="hidden sm:inline">{strings.hero.status}</span>
            <span className="text-foreground flex items-center gap-1.5">
              <span className="bg-signal size-1.5 rounded-full" />
              {strings.hero.ready}
            </span>
          </span>
        </div>

        {/* hero body — on mobile the upload panel follows the headline directly
            (copy → upload → specs); on lg it's copy top-left, specs bottom-left,
            upload spanning the right column. */}
        <div className="grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-x-16 lg:gap-y-10 lg:py-24">
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
              {strings.hero.kicker}
            </p>
            <h1 className="mt-5 text-4xl leading-[0.95] font-black tracking-tight text-balance sm:text-5xl md:text-6xl">
              {strings.hero.headline}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
              {strings.hero.sub}
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:self-center">
            <DropZone onFiles={onFiles} variant="hero" />
            <p className="text-muted-foreground mt-3 text-center font-mono text-[0.7rem] tracking-widest uppercase">
              {strings.hero.privacy}
            </p>
          </div>

          <dl className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4 lg:col-start-1 lg:row-start-2">
            {specs.map((s) => (
              <div key={s.label} className="bg-card p-4">
                <dt className="font-mono text-xl font-bold tracking-tight tabular-nums">
                  {s.value}
                </dt>
                <dd className="text-muted-foreground mt-1 font-mono text-[0.65rem] tracking-wider uppercase">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/** Section-framing alignment marks (TE / Anduril). */
function CornerMarks() {
  const base = 'pointer-events-none absolute z-10 size-4 border-foreground/20'
  return (
    <>
      <span className={cn(base, 'top-4 left-4 border-t-2 border-l-2')} />
      <span className={cn(base, 'top-4 right-4 border-t-2 border-r-2')} />
      <span className={cn(base, 'bottom-4 left-4 border-b-2 border-l-2')} />
      <span className={cn(base, 'right-4 bottom-4 border-r-2 border-b-2')} />
    </>
  )
}
