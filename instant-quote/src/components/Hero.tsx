import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { PRICING, PROCESS_IDS } from '@/lib/pricing-config'
import { DropZone } from './DropZone'

// Capability figures pulled straight from the pricing config, zipped with the
// labels in strings.hero.specs (same order).
const SPEC_VALUES = [
  String(PROCESS_IDS.length).padStart(2, '0'),
  `${PRICING.processes.pla.build.x}³`,
  `${PRICING.leadTimes.express.businessDays}–${PRICING.leadTimes.economy.businessDays}`,
  `${Math.round(PRICING.vatRate * 100)}%`,
]

// The three line stages, positioned over their machine in the hero figure.
// Decorative (aria-hidden) — the illustration's alt text carries the meaning.
const STAGES = [
  { n: '01', label: '3D printing', left: '6%', line: 'h-9' },
  { n: '02', label: 'Pick & place', left: '33%', line: 'h-14' },
  { n: '03', label: 'Pack & ship', left: '61%', line: 'h-16' },
]

export function Hero({
  onFiles,
  onUrl,
  urlPending,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
}) {
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

        {/* hero body — copy and the upload panel sit side by side; below them a
            full-width capability strip, then the full-width factory figure.
            On mobile everything stacks in that order. */}
        <div className="py-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-12">
            <div className="flex flex-col justify-center">
              <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
                {strings.hero.kicker}
              </p>
              <h1 className="mt-5 text-4xl leading-[0.95] font-black tracking-tight text-balance sm:text-5xl md:text-6xl">
                {strings.hero.headline}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-[17px] leading-relaxed text-pretty">
                {strings.hero.sub}
              </p>
              <p className="text-muted-foreground mt-7 font-mono text-[0.65rem] tracking-wider uppercase">
                {strings.hero.trust}
              </p>
            </div>

            <div className="flex flex-col">
              <DropZone
                onFiles={onFiles}
                variant="hero"
                onUrl={onUrl}
                urlPending={urlPending}
              />
              <p className="text-muted-foreground mt-3.5 text-center font-mono text-[0.7rem] tracking-widest uppercase">
                {strings.hero.privacy}
              </p>
            </div>
          </div>

          <dl className="bg-border mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4">
            {specs.map((s) => (
              <div key={s.label} className="bg-card p-5">
                <dt className="font-mono text-2xl leading-none font-bold tracking-tight tabular-nums">
                  {s.value}
                </dt>
                <dd className="text-muted-foreground mt-2.5 font-mono text-[0.65rem] tracking-wider uppercase">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>

          <FactoryFigure className="mt-16 lg:mt-[72px]" />
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
      <figcaption className="text-muted-foreground mt-5 flex items-center justify-between gap-4 border-t pt-3 font-mono text-[0.65rem] tracking-wider uppercase">
        <span>{strings.hero.figCaption}</span>
        <span>{strings.hero.figNo}</span>
      </figcaption>
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
