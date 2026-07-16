import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { LEAD_TIME_DAYS, MATERIALS, VAT_RATE } from '@/lib/catalog-static'
import { DropZone } from './DropZone'

// Capability figures from the static marketing catalog, zipped with the
// labels in strings.hero.specs (same order).
const SPEC_VALUES = [
  String(MATERIALS.length).padStart(2, '0'),
  `${LEAD_TIME_DAYS.min}–${LEAD_TIME_DAYS.max}`,
  'D+1',
  `${Math.round(VAT_RATE * 100)}%`,
]

export function Hero({
  onFiles,
  onUrl,
  urlPending,
  onSample,
}: {
  onFiles: (files: File[]) => void
  onUrl?: (url: string) => void
  urlPending?: boolean
  onSample?: () => void
}) {
  const specs = strings.hero.specs.map((label, i) => ({
    label,
    value: SPEC_VALUES[i],
  }))

  return (
    <section id="top" className="relative overflow-hidden border-b">
      <Drone />

      <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6 md:pt-[72px]">
        <p className="text-muted-foreground flex items-center gap-3.5 font-mono text-[0.7rem] tracking-[0.24em] uppercase">
          <span className="bg-primary text-primary-foreground px-1.5 py-1 font-bold tracking-[0.14em]">
            {strings.hero.kickerBadge}
          </span>
          {strings.hero.kicker}
        </p>
        <h1 className="mt-[22px] text-[clamp(2.1rem,12vw,3rem)] leading-[0.92] font-black tracking-[-0.035em] uppercase min-[421px]:text-[clamp(2.5rem,13vw,3.8rem)] md:mt-7 md:text-[clamp(3rem,8.6vw,7.25rem)] md:leading-[0.88]">
          {strings.hero.headline1}
          <br />
          <span className="text-stroke-ink">{strings.hero.headline2}</span>
        </h1>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-9 pb-14 sm:px-6 md:pt-12 md:pb-[72px]">
        <div className="grid gap-9 md:gap-12 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <p className="text-muted-foreground max-w-md text-[17px] leading-relaxed text-pretty lg:text-lg">
                {strings.hero.sub}
              </p>
              {onSample && (
                <button
                  type="button"
                  onClick={onSample}
                  className="hover:text-primary-text focus-visible:ring-ring mt-6 cursor-pointer font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {strings.hero.sample}
                </button>
              )}
            </div>

            <dl className="grid grid-cols-2 border-t">
              {specs.map((s, i) => (
                <div
                  key={s.label}
                  className={cn(
                    i % 2 === 0 ? 'border-r pr-5' : 'pl-5',
                    i < 2 ? 'border-b py-5' : 'pt-5',
                  )}
                >
                  <dt className="font-mono text-[clamp(22px,2.4vw,30px)] leading-none font-bold whitespace-nowrap tabular-nums">
                    {s.value}
                  </dt>
                  <dd className="text-muted-foreground mt-2.5 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
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
      </div>
    </section>
  )
}

/** Courier drone drifting across the hero — pure decoration, motion-gated. */
function Drone() {
  return (
    <div
      aria-hidden
      className="motion-safe:animate-drone-x pointer-events-none absolute top-[11%] left-0 z-0 motion-reduce:hidden"
    >
      <div className="motion-safe:animate-drone-y">
        <svg
          width="84"
          height="44"
          viewBox="-42 -18 84 44"
          className="text-foreground/35"
        >
          <Rotor x={-26} />
          <Rotor x={26} />
          <line
            x1="-26"
            y1="0"
            x2="26"
            y2="0"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="-9"
            y="-3"
            width="18"
            height="8"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="0"
            y1="5"
            x2="0"
            y2="12"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {/* the parcel */}
          <rect
            x="-5"
            y="12"
            width="10"
            height="7"
            rx="1.5"
            className="fill-primary/75"
          />
        </svg>
      </div>
    </div>
  )
}

function Rotor({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},0)`}>
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="-5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <ellipse
        cx="0"
        cy="-6"
        rx="9"
        ry="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <animate
          attributeName="rx"
          values="9;2.5;9"
          dur="0.22s"
          repeatCount="indefinite"
        />
      </ellipse>
    </g>
  )
}
