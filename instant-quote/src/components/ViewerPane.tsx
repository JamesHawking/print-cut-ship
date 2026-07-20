import { Suspense, lazy, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CameraPreset } from '@/lib/camera-presets'
import { ViewerFallback } from './ViewerFallback'

const PartViewer = lazy(() => import('./PartViewer'))

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

/** Renders the 3D preview client-side only, falling back gracefully. */
export function ViewerPane({
  positions,
  bboxMm,
  enabled = true,
  showGrid,
  autoRotate,
  viewRequest,
  resetNonce,
  overlay,
  dimsBadgeCorner,
}: {
  positions: Float32Array
  bboxMm: { x: number; y: number; z: number }
  /** When false, never mounts the canvas — the other breakpoint owns it. */
  enabled?: boolean
  showGrid?: boolean
  autoRotate?: boolean
  viewRequest?: { preset: CameraPreset; nonce: number } | null
  resetNonce?: number
  overlay?: 'multi_plate' | null
  dimsBadgeCorner?: 'left' | 'right'
}) {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    if (!enabled) return
    setMounted(true)
    setWebgl(hasWebGL())
  }, [enabled])

  if (!enabled || !mounted) {
    return <Skeleton className="h-full w-full rounded-xl" />
  }
  if (!webgl) {
    return <ViewerFallback bboxMm={bboxMm} />
  }
  return (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
      <PartViewer
        positions={positions}
        bboxMm={bboxMm}
        showGrid={showGrid}
        autoRotate={autoRotate}
        viewRequest={viewRequest}
        resetNonce={resetNonce}
        overlay={overlay}
        dimsBadgeCorner={dimsBadgeCorner}
      />
    </Suspense>
  )
}
