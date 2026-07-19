import { Suspense, lazy, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
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
}: {
  positions: Float32Array
  bboxMm: { x: number; y: number; z: number }
}) {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    setMounted(true)
    setWebgl(hasWebGL())
  }, [])

  if (!mounted) {
    return <Skeleton className="h-full w-full rounded-xl" />
  }
  if (!webgl) {
    return <ViewerFallback bboxMm={bboxMm} />
  }
  return (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
      <PartViewer positions={positions} bboxMm={bboxMm} />
    </Suspense>
  )
}
