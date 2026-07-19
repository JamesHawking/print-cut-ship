import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Center, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
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

export default function PartViewer({
  positions,
  bboxMm,
}: {
  positions: Float32Array
  bboxMm: { x: number; y: number; z: number }
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
        </Bounds>
        <OrbitControls makeDefault enablePan enableZoom enableRotate />
      </Canvas>
      {/* In-canvas dims badge — desktop only; on mobile the metrics strip
          directly below carries the same value. */}
      <div className="bg-background/80 text-foreground pointer-events-none absolute bottom-2 left-2 rounded-md border px-2 py-1 text-xs font-medium tabular-nums backdrop-blur max-sm:hidden">
        {formatDims(bboxMm, locale)}
      </div>
    </div>
  )
}
