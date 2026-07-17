import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/funnel'
import type { LogLine, Stage } from './demo'

/** Grace before a (re)run starts, letting the dot transition back to station 0. */
const RESET_GRACE_MS = 450

interface DemoRunState {
  status: 'done' | 'idle' | 'running'
  visible: number
}

/**
 * Playback state machine for the demo run. SSR/hydration-safe by
 * construction: the initial state is the completed run (prerendered HTML
 * shows the full log), and every divergence — reduced-motion detection, the
 * in-view reset, timers — happens in effects only. Reduced-motion visitors
 * keep the permanent done state.
 */
export function useDemoRun(script: LogLine[]) {
  const [state, setState] = useState<DemoRunState>({
    status: 'done',
    visible: script.length,
  })
  const sectionRef = useRef<HTMLElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playedRef = useRef(false)

  function play() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setState({ status: 'idle', visible: 0 })
    timeoutRef.current = setTimeout(() => {
      setState({ status: 'running', visible: 0 })
    }, RESET_GRACE_MS)
  }

  // Mount: reduced-motion (or no IO support) keeps the done state forever;
  // otherwise arm an observer that starts the run once, on first view.
  useEffect(() => {
    const el = sectionRef.current
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined' ||
      !el
    )
      return
    setState({ status: 'idle', visible: 0 })
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || playedRef.current) return
        playedRef.current = true
        io.disconnect()
        track('demo_played')
        play()
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // The timer chain: reveal the next line after its delay.
  useEffect(() => {
    if (state.status !== 'running') return
    if (state.visible >= script.length) {
      setState({ status: 'done', visible: script.length })
      return
    }
    timeoutRef.current = setTimeout(() => {
      setState((s) => ({ ...s, visible: s.visible + 1 }))
    }, script[state.visible].delayMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [state, script])

  const stage: Stage =
    state.visible > 0 ? script[state.visible - 1].stage : 'recv'

  function replay() {
    track('demo_replayed')
    play()
  }

  return { ...state, stage, replay, sectionRef }
}
