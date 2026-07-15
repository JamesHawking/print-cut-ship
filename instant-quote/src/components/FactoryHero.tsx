import { Suspense, lazy, useEffect, useRef, useState } from 'react'

/*
 * FactoryHero — a self-contained, looping 3D hero animation of a miniature
 * automated factory line (3D print → 6-DoF pick-and-place → pack & ship).
 *
 * The heavy three.js scene is code-split (`./FactoryScene`) and only mounts
 * client-side after this wrapper is in the DOM, so it never blocks page load.
 * A cheap CSS placeholder shows until the scene chunk resolves.
 *
 * The loop pauses (frameloop → 'demand') when the hero scrolls off-screen, when
 * the tab is hidden, or when `paused` is set; with prefers-reduced-motion it
 * renders a single still frame instead of animating.
 *
 * Usage:
 *   <div className="relative h-[60vh]">
 *     <FactoryHero accentColor="var(--brand)" className="absolute inset-0" />
 *     <h1 className="relative z-10 …">Upload a part, get a price.</h1>
 *   </div>
 */

const FactoryScene = lazy(() => import('./FactoryScene'))

export interface FactoryHeroProps {
  /** Accent color for the printed part, gripper fingers, and conveyor details. */
  accentColor?: string
  /** Playback multiplier (1 = ~12 s cycle). */
  speed?: number
  /** Force-pause the animation regardless of visibility. */
  paused?: boolean
  className?: string
}

export function FactoryHero({
  accentColor = '#f97316',
  speed = 1,
  paused = false,
  className,
}: FactoryHeroProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [inView, setInView] = useState(true)
  const [tabHidden, setTabHidden] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => setReduced(mq.matches)
    const onVis = () => setTabHidden(document.hidden)
    onMq()
    onVis()
    mq.addEventListener('change', onMq)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      mq.removeEventListener('change', onMq)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.05,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  const running = mounted && inView && !tabHidden && !paused && !reduced

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {mounted ? (
        <Suspense fallback={<Placeholder accentColor={accentColor} />}>
          <FactoryScene
            accentColor={accentColor}
            speed={speed}
            running={running}
            staticMode={reduced}
          />
        </Suspense>
      ) : (
        <Placeholder accentColor={accentColor} />
      )}
    </div>
  )
}

/** Lightweight, asset-free stand-in shown before the scene chunk loads. */
function Placeholder({ accentColor }: { accentColor: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(120% 90% at 70% 20%, ${accentColor}22, transparent 60%), #f4f3f0`,
      }}
    />
  )
}
