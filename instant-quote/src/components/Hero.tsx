import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'
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
  const strings = useStrings()
  const specs = strings.hero.specs.map((label, i) => ({
    label,
    value: SPEC_VALUES[i],
  }))

  return (
    <section id="top" className="relative overflow-hidden border-b">
      <Drone className="top-[11%]" />

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

/**
 * Courier drone crossing the hero — pure decoration. Position, banking,
 * parcel swing, and the ground shadow all come from one damped-spring
 * simulation (rAF), so the motion reads as physics, not keyframes: the
 * drone pitches to accelerate, flares to brake into its hover above the
 * dropzone, and the parcel trails its actual acceleration. The loop
 * sleeps off-screen. Disabled entirely under prefers-reduced-motion.
 */
function Drone({
  className,
  svgClassName = 'text-foreground/45',
}: {
  className?: string
  svgClassName?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bankRef = useRef<HTMLDivElement>(null)
  const parcelRef = useRef<SVGGElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = rootRef.current
    const bank = bankRef.current
    const parcel = parcelRef.current
    const shadow = shadowRef.current
    if (!root || !bank || !parcel || !shadow) return

    const LOOP_S = 52
    const HOVER_UNTIL_S = 21
    const OFFSCREEN_S = 30
    const OMEGA = 0.9
    const ZETA = 0.85

    let w = root.parentElement?.clientWidth ?? window.innerWidth
    const onResize = () => {
      w = root.parentElement?.clientWidth ?? window.innerWidth
    }
    window.addEventListener('resize', onResize)

    const start = performance.now()
    let last = start
    let x = -180
    let y = 0
    let vx = 0
    let vy = 0
    let pitch = 0
    let swing = 0
    let swingV = 0
    let raf = 0
    let dwellTimer: ReturnType<typeof setTimeout> | undefined

    const step = (now: number) => {
      const t = ((now - start) / 1000) % LOOP_S
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (t >= OFFSCREEN_S) {
        // Dwell off-screen: park the drone at the entry point and sleep
        // until the next loop begins.
        root.style.transform = 'translate(-180px, 0px)'
        shadow.style.opacity = '0'
        dwellTimer = setTimeout(
          () => {
            x = -180
            y = 0
            vx = 0
            vy = 0
            swing = 0
            swingV = 0
            last = performance.now()
            raf = requestAnimationFrame(step)
          },
          (LOOP_S - t) * 1000,
        )
        return
      }

      const hovering = t < HOVER_UNTIL_S
      const tx = hovering ? w * 0.6 : w + 220
      const bob =
        Math.sin(t * ((2 * Math.PI) / 5.5)) * 7 +
        Math.sin(t * ((2 * Math.PI) / 2.3) + 1.7) * 3
      const ty = (hovering ? 8 : -12) + bob

      const ax = OMEGA * OMEGA * (tx - x) - 2 * ZETA * OMEGA * vx
      const ay = OMEGA * OMEGA * (ty - y) - 2 * ZETA * OMEGA * vy
      vx += ax * dt
      vy += ay * dt
      x += vx * dt
      y += vy * dt

      // Pitch into acceleration (smoothed): nose-down to speed up,
      // nose-up flare to brake.
      const targetPitch = Math.max(-11, Math.min(11, ax * 0.02))
      pitch += (targetPitch - pitch) * Math.min(1, dt * 6)

      // Parcel pendulum: lightly damped, chasing the drone's lateral
      // acceleration, so it trails and overswings naturally.
      const swingTarget = Math.max(-16, Math.min(16, -ax * 0.03))
      const SWING_OMEGA = 4
      const SWING_ZETA = 0.22
      const swingA =
        SWING_OMEGA * SWING_OMEGA * (swingTarget - swing) -
        2 * SWING_ZETA * SWING_OMEGA * swingV
      swingV += swingA * dt
      swing += swingV * dt

      root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      bank.style.transform = `rotate(${pitch.toFixed(2)}deg)`
      parcel.setAttribute('transform', `rotate(${swing.toFixed(2)} 0 6)`)

      // Ground shadow: fades in from the leading edge, tracks x, and
      // squashes slightly as the drone climbs.
      const fade = Math.max(0, Math.min(1, Math.min(x, w - x) / 160))
      const squash = 1 + Math.max(-0.06, Math.min(0.06, -vy * 0.01))
      shadow.style.opacity = (0.18 * fade).toFixed(3)
      shadow.style.transform = `translate(${(x + 20).toFixed(1)}px, 0px) scale(${squash.toFixed(3)})`

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      if (dwellTimer) clearTimeout(dwellTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <div
        ref={shadowRef}
        aria-hidden
        className="bg-foreground pointer-events-none absolute top-[24%] left-0 z-0 h-3 w-24 rounded-full opacity-0 blur-md motion-reduce:hidden"
      />
      <div
        ref={rootRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 z-0 motion-reduce:hidden',
          className,
        )}
        style={{ transform: 'translate(-180px, 0px)' }}
      >
        <div ref={bankRef}>
          <DroneSvg className={svgClassName} parcelRef={parcelRef} />
        </div>
      </div>
    </>
  )
}

function DroneSvg({
  className,
  parcelRef,
}: {
  className?: string
  parcelRef?: RefObject<SVGGElement | null>
}) {
  return (
    <svg width="104" height="56" viewBox="-52 -24 104 56" className={className}>
      {/* far-side arm pair, dimmed for depth */}
      <g opacity="0.35">
        <line
          x1="-4"
          y1="-5"
          x2="-22"
          y2="-17"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="-5"
          x2="26"
          y2="-19"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Rotor x={-22} y={-19} r={11} />
        <Rotor x={26} y={-21} r={11} />
      </g>

      {/* hull */}
      <rect
        x="-18"
        y="-9"
        width="38"
        height="15"
        rx="7"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* battery pack */}
      <rect
        x="-9"
        y="-14"
        width="20"
        height="6"
        rx="3"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {/* windshield */}
      <rect
        x="8"
        y="-7"
        width="10"
        height="8"
        rx="3.5"
        fill="currentColor"
        fillOpacity="0.3"
      />
      {/* panel seam + vents */}
      <line
        x1="2"
        y1="-8"
        x2="2"
        y2="5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <g stroke="currentColor" strokeWidth="1" opacity="0.5">
        <line x1="-15" y1="-4" x2="-11" y2="-4" />
        <line x1="-15" y1="-1" x2="-11" y2="-1" />
        <line x1="-15" y1="2" x2="-11" y2="2" />
      </g>

      {/* near-side arm pair */}
      <line
        x1="-4"
        y1="-3"
        x2="-30"
        y2="-8"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="-3"
        x2="34"
        y2="-6"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <Rotor x={-30} y={-10} r={14} />
      <Rotor x={34} y={-8} r={14} />

      {/* camera gimbal */}
      <circle
        cx="13"
        cy="9"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="13" cy="9" r="1.3" className="fill-primary/80" />

      {/* front nav light + rear strobe */}
      <circle cx="19" cy="-3" r="1.4" className="fill-primary">
        <animate
          attributeName="opacity"
          values="1;0.15;1"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="-17" cy="-11" r="1.2" fill="currentColor">
        <animate
          attributeName="opacity"
          values="0;0;1;0"
          keyTimes="0;0.85;0.92;1"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>

      {/* suspended parcel: rotation driven by the flight simulation
          around the attach point (0, 6) */}
      <g ref={parcelRef}>
        <line
          x1="0"
          y1="6"
          x2="0"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="-9"
          y="14"
          width="18"
          height="12"
          rx="2"
          className="fill-primary/75"
          stroke="currentColor"
          strokeOpacity="0.3"
        />
        <line
          x1="0"
          y1="14"
          x2="0"
          y2="26"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.25"
        />
      </g>
    </svg>
  )
}

/** Motor pod + spinning prop: faint blur disc with two counter-phased
    flickering blades. */
function Rotor({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x="-3.5"
        y="-2.5"
        width="7"
        height="5"
        rx="2"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <ellipse
        cx="0"
        cy={-4}
        rx={r}
        ry={r * 0.17}
        fill="currentColor"
        opacity="0.08"
      />
      <ellipse
        cx="0"
        cy={-4}
        rx={r}
        ry={r * 0.17}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <animate
          attributeName="rx"
          values={`${r};${r * 0.28};${r}`}
          dur="0.18s"
          repeatCount="indefinite"
        />
      </ellipse>
      <ellipse
        cx="0"
        cy={-4}
        rx={r * 0.28}
        ry={r * 0.17}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <animate
          attributeName="rx"
          values={`${r * 0.28};${r};${r * 0.28}`}
          dur="0.18s"
          repeatCount="indefinite"
        />
      </ellipse>
    </g>
  )
}
