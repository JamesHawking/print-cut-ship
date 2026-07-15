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

// The three line stages, positioned over their machine in the hero figure.
// Decorative (aria-hidden) — the illustration's alt text carries the meaning.
const STAGES = [
  { n: '01', label: '3D printing', left: '6%', line: 'h-9' },
  { n: '02', label: 'Pick & place', left: '33%', line: 'h-14' },
  { n: '03', label: 'Pack & ship', left: '61%', line: 'h-16' },
]

export function Hero({ onFiles }: { onFiles: (files: File[]) => void }) {
  const specs = strings.hero.specs.map((label, i) => ({
    label,
    value: SPEC_VALUES[i],
  }))

  return (
    <section id="top" className="relative scroll-mt-0">
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

        {/* hero body — left column carries the copy, specs and upload panel;
            the right column is the factory-line illustration. On mobile they
            stack: copy → illustration → upload → specs. */}
        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-center lg:gap-x-12 lg:gap-y-8 lg:py-20">
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

          <FactoryFigure className="lg:col-start-2 lg:row-span-3 lg:self-start" />

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

          <div className="lg:col-start-1 lg:row-start-3">
            <DropZone onFiles={onFiles} variant="hero" />
            <p className="text-muted-foreground mt-3 text-center font-mono text-[0.7rem] tracking-widest uppercase">
              {strings.hero.privacy}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Factory-line illustration with numbered stage callouts. */
function FactoryFigure({ className }: { className?: string }) {
  return (
    <figure className={cn('relative pt-11 sm:pt-14', className)}>
      <img
        src="/factory-line.webp"
        width={1412}
        height={765}
        alt="Automated production line: a part is 3D-printed, moved by a robot arm, then packed for shipping."
        className="h-auto w-full"
      />
      {/* stage callouts — decorative overlay, hidden on small screens */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden sm:block"
      >
        {STAGES.map((s) => (
          <div
            key={s.n}
            className="absolute top-0 flex flex-col items-start"
            style={{ left: s.left }}
          >
            <div className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground grid h-5 min-w-5 place-items-center px-1 font-mono text-[0.72rem] leading-none font-bold">
                {s.n}
              </span>
              <span className="text-foreground font-mono text-[0.7rem] font-semibold tracking-wider whitespace-nowrap uppercase">
                {s.label}
              </span>
            </div>
            <span
              className={cn(
                'border-foreground/25 mt-1 ml-2 w-px border-l border-dashed',
                s.line,
              )}
            />
          </div>
        ))}
      </div>
    </figure>
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
