import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Bounds,
  Center,
  Grid,
  OrbitControls,
  useBounds,
} from '@react-three/drei'
import * as THREE from 'three'
import type { CameraPreset } from '@/lib/camera-presets'
import { presetGoal } from '@/lib/camera-presets'
import { formatDims } from '@/lib/format'
import { useLocale } from '@/lib/i18n'

const ACCENT = '#f97316' // industrial orange

function PartMesh({ positions }: { positions: Float32Array }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.computeVertexNormals()
    return geom
  }, [positions])

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={ACCENT} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}

/**
 * Applies viewport toolbar requests from inside the Canvas. Must stay a
 * descendant of <Bounds> — useBounds() reads its context. Flights animate
 * over Bounds' default maxDuration (1s); scene units are mm and the fit
 * distance already includes the Bounds margin.
 */
function CameraRig({
  viewRequest,
  resetNonce,
}: {
  viewRequest?: { preset: CameraPreset; nonce: number } | null
  resetNonce?: number
}) {
  const bounds = useBounds()

  useEffect(() => {
    if (!viewRequest) return
    const { center, distance } = bounds.refresh().getSize()
    const goal = presetGoal(viewRequest.preset, center.toArray(), distance)
    bounds.moveTo(goal.position).lookAt({ target: goal.target })
  }, [bounds, viewRequest])

  useEffect(() => {
    if (!resetNonce) return
    bounds.refresh().reset()
  }, [bounds, resetNonce])

  return null
}

export default function PartViewer({
  positions,
  bboxMm,
  showGrid = false,
  autoRotate = false,
  viewRequest = null,
  resetNonce = 0,
}: {
  positions: Float32Array
  bboxMm: { x: number; y: number; z: number }
  showGrid?: boolean
  autoRotate?: boolean
  viewRequest?: { preset: CameraPreset; nonce: number } | null
  resetNonce?: number
}) {
  const locale = useLocale()
  // Chrome-less: the surrounding ViewerFrame owns border and radius.
  return (
    <div className="bg-muted/30 relative h-full overflow-hidden">
      <Canvas
        camera={{ position: [1.5, 1.2, 1.8], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#fafafa']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} />
        <Bounds fit clip observe margin={1.2}>
          <Center>
            <PartMesh positions={positions} />
          </Center>
          <CameraRig viewRequest={viewRequest} resetNonce={resetNonce} />
        </Bounds>
        {showGrid && (
          <Grid
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -bboxMm.y / 2 - 0.5, 0]}
            args={[2000, 2000]}
            cellSize={10}
            sectionSize={50}
            cellColor="#e4e4e7"
            sectionColor="#d4d4d8"
            cellThickness={0.6}
            sectionThickness={1}
            fadeDistance={1200}
            fadeStrength={1}
            side={THREE.DoubleSide}
          />
        )}
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
        />
      </Canvas>
      {/* In-canvas dims badge — desktop only; on mobile the metrics strip
          directly below carries the same value. */}
      <div className="bg-background/80 text-foreground pointer-events-none absolute bottom-2 left-2 rounded-md border px-2 py-1 text-xs font-medium tabular-nums backdrop-blur max-sm:hidden">
        {formatDims(bboxMm, locale)}
      </div>
    </div>
  )
}
