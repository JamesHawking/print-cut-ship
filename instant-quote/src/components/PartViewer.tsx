import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
import { cn } from '@/lib/utils'

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
 * DFM overlay: a pulsing wireframe one packing envelope larger than the
 * part's bbox (multi-plate checks). Centered at the origin like the part
 * itself, so it must live OUTSIDE <Center> — Center would absorb it into
 * the group it re-centers.
 */
function EnvelopeOverlay({
  bboxMm,
}: {
  bboxMm: { x: number; y: number; z: number }
}) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null)
  const geometry = useMemo(() => {
    const MARGIN = 4
    // World axes after the Z-up → Y-up part rotation: model z is world up.
    return new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        bboxMm.x + MARGIN,
        bboxMm.z + MARGIN,
        bboxMm.y + MARGIN,
      ),
    )
  }, [bboxMm.x, bboxMm.y, bboxMm.z])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity =
        0.45 + 0.4 * Math.sin(clock.elapsedTime * 3.6)
    }
  })

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color="#3b82f6"
        transparent
        opacity={0.8}
      />
    </lineSegments>
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
  overlay = null,
  dimsBadgeCorner = 'left',
}: {
  positions: Float32Array
  bboxMm: { x: number; y: number; z: number }
  showGrid?: boolean
  autoRotate?: boolean
  viewRequest?: { preset: CameraPreset; nonce: number } | null
  resetNonce?: number
  /** DFM code with a geometric overlay — currently only multi_plate. */
  overlay?: 'multi_plate' | null
  dimsBadgeCorner?: 'left' | 'right'
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
            {/* Mesh files are Z-up; the scene is Y-up — lay the part flat. */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <PartMesh positions={positions} />
            </group>
          </Center>
          {overlay === 'multi_plate' && <EnvelopeOverlay bboxMm={bboxMm} />}
          <CameraRig viewRequest={viewRequest} resetNonce={resetNonce} />
        </Bounds>
        {showGrid && (
          // Flat 10 mm build-plate grid just under the part (world up is the
          // model's z after the part rotation).
          <Grid
            position={[0, -bboxMm.z / 2 - 0.5, 0]}
            args={[2000, 2000]}
            cellSize={10}
            cellThickness={1}
            cellColor="#dcdce0"
            sectionSize={100}
            sectionThickness={1}
            sectionColor="#d4d4d8"
            fadeDistance={1500}
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
      <div
        className={cn(
          'bg-background/80 text-foreground pointer-events-none absolute bottom-2 rounded-md border px-2 py-1 text-xs font-medium tabular-nums backdrop-blur max-sm:hidden',
          dimsBadgeCorner === 'right' ? 'right-2' : 'left-2',
        )}
      >
        {formatDims(bboxMm, locale)}
      </div>
    </div>
  )
}
