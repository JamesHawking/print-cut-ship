import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

/*
 * FactoryScene — the heavy, code-split half of <FactoryHero />.
 *
 * A single normalized clock drives the whole loop: `cyc` counts cycles
 * (monotonic float), `t = frac(cyc)` is the 0..1 phase used by the printer +
 * robot, and each box runs a 2-cycle lifecycle so two boxes stay staggered on
 * the belt (one packing at the station while the previous one ships out).
 *
 * All animation is ref-mutation inside ONE useFrame — no React state per frame.
 * Geometry is generated in code; the only "asset" is the runtime mesh graph.
 */

const CYCLE_SECONDS = 12 // total loop length; spec allows 10–14. `speed` scales it.
const STATIC_C = 0.58 // phase shown for the reduced-motion still frame (mid-place)

// ── Robot geometry (base-local, metres) ─────────────────────────────────────
const BASE = new THREE.Vector3(-0.5, 0, 0.6) // arm pivot on the floor
const SHOULDER_Y = 1.6 // shoulder height above the base
const L1 = 1.7 // upper-arm length
const L2 = 1.5 // forearm length
const L3 = 0.55 // wrist → tool tip (gripper points straight down)
const SHOULDER = new THREE.Vector3(BASE.x, BASE.y + SHOULDER_Y, BASE.z)

// Work points, chosen so the derived pick/place yaw is ~120–130° apart.
const BED_TOP = new THREE.Vector3(-3.3, 0.8, -0.2) // printer bed surface centre
const STATION_X = 0.4 // where a box parks under the arm
const CONVEYOR_Z = 3.0

const UP = new THREE.Vector3(0, 1, 0)

// ── Easing ──────────────────────────────────────────────────────────────────
type Ease = (x: number) => number
const easeInOut: Ease = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
const easeOut: Ease = (x) => 1 - Math.pow(1 - x, 3)
const easeIn: Ease = (x) => x * x
const backOut: Ease = (x) => {
  // slight overshoot + settle for "IK-looking" joint arrivals
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// ── Keyframe sampler ─────────────────────────────────────────────────────────
type Key = { t: number; v: number; e?: Ease }
function sample(keys: Key[], t: number): number {
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1]
      const b = keys[i]
      const k = (t - a.t) / (b.t - a.t)
      return a.v + (b.v - a.v) * (b.e ?? easeInOut)(k)
    }
  }
  return last.v
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const rad = THREE.MathUtils.degToRad

/*
 * ══════════════════════ ROBOT JOINT / TARGET TIMELINE ══════════════════════
 * The arm is driven by a cylindrical end-effector target (yaw θ0, radius r,
 * height y). Shoulder + elbow are solved with analytic 2-link IK each frame,
 * so tweaking these keyframes moves the whole arm believably. All times are
 * cycle fractions — multiply by CYCLE_SECONDS (12) for seconds.
 *
 *   0.00–0.30  idle HOME (arm tucked up-front); printer is printing the part
 *   0.30–0.40  swing HOME → over the bed, kept high (no path through the frame)
 *   0.40–0.44  descend onto the finished part
 *   0.44–0.48  gripper CLOSES
 *   0.48–0.53  LIFT the part clear of the bed
 *   0.53–0.62  SWING to the box, arcing up to clear the frame, ~127° of yaw
 *   0.62–0.66  LOWER into the open box
 *   0.66–0.70  gripper OPENS (part released)
 *   0.70–0.80  RETRACT to HOME, settling with a slight overshoot
 *   0.80–1.00  idle HOME (printer has already started the next part at 0.85)
 */
// Base yaw, degrees. Pick≈196°, place≈69° → swept the short (front) way.
const TH0: Key[] = [
  { t: 0.0, v: 17 },
  { t: 0.3, v: 17 },
  { t: 0.4, v: 196, e: easeInOut },
  { t: 0.53, v: 196 },
  { t: 0.62, v: 69, e: backOut },
  { t: 0.7, v: 69 },
  { t: 0.8, v: 17, e: easeInOut },
  { t: 1.0, v: 17 },
]
// End-effector radius from the base axis.
const RAD: Key[] = [
  { t: 0.0, v: 1.5 },
  { t: 0.3, v: 1.5 },
  { t: 0.4, v: 2.91, e: easeInOut },
  { t: 0.44, v: 2.91 },
  { t: 0.53, v: 2.85 },
  { t: 0.62, v: 2.56, e: easeInOut },
  { t: 0.66, v: 2.56 },
  { t: 0.8, v: 1.5, e: easeInOut },
  { t: 1.0, v: 1.5 },
]
// End-effector height (tool tip).
const HGT: Key[] = [
  { t: 0.0, v: 2.6 },
  { t: 0.3, v: 2.6 },
  { t: 0.4, v: 1.5, e: easeInOut },
  { t: 0.44, v: 1.0, e: easeOut },
  { t: 0.48, v: 1.0 },
  { t: 0.53, v: 1.95, e: easeOut },
  { t: 0.575, v: 2.15 }, // arc apex, clears the printer frame during the swing
  { t: 0.62, v: 1.4, e: easeInOut },
  { t: 0.66, v: 1.15, e: easeOut },
  { t: 0.7, v: 1.15 },
  { t: 0.8, v: 2.6, e: easeInOut },
  { t: 1.0, v: 2.6 },
]
// Gripper opening: 1 = open, 0 = closed.
const GRIP: Key[] = [
  { t: 0.0, v: 1 },
  { t: 0.44, v: 1 },
  { t: 0.48, v: 0, e: easeOut },
  { t: 0.66, v: 0 },
  { t: 0.7, v: 1, e: easeOut },
  { t: 1.0, v: 1 },
]
// Gripper roll (6th DoF), degrees — a small twist mid-carry.
const ROLL: Key[] = [
  { t: 0.0, v: 0 },
  { t: 0.53, v: 0 },
  { t: 0.575, v: 80, e: easeInOut },
  { t: 0.62, v: 0, e: easeInOut },
  { t: 1.0, v: 0 },
]

// ── Printer part growth ──────────────────────────────────────────────────────
// Printing runs t = 0.85 → (wrap) → 0.30, so the next part starts while the
// previous box is still being taped. Fully grown from 0.30 until it's picked.
function growth(t: number): number {
  let p: number
  if (t >= 0.85) p = (t - 0.85) / 0.45
  else if (t <= 0.3) p = (t + 0.15) / 0.45
  else p = 1
  return clamp(p, 0, 1)
}

// ── Box lifecycle (function of its own phase τ ∈ [0,1), one lap = 2 cycles) ───
const BOX_XIN = -6.5
const BOX_XOUT = 8.5
function boxX(tau: number): number {
  if (tau >= 0.9)
    return lerp(BOX_XIN, STATION_X, easeInOut(clamp((tau - 0.9) / 0.08, 0, 1)))
  if (tau < 0.45) return STATION_X
  if (tau < 0.6) return lerp(STATION_X, BOX_XOUT, easeIn((tau - 0.45) / 0.15))
  return BOX_XOUT
}
const boxOnScreen = (tau: number) => tau < 0.62 || tau > 0.895
const flapFold = (tau: number) => clamp((tau - 0.33) / 0.04, 0, 1) // 0 open → 1 closed
const tapeGrow = (tau: number) => clamp((tau - 0.37) / 0.05, 0, 1)
const labelShow = (tau: number) => clamp((tau - 0.41) / 0.04, 0, 1)
const boxFilled = (tau: number) => tau >= 0.33 && tau < 0.6

// The four top flaps, hinged at the box's top edges. Each folds from flat
// (closed, angle 0) to splayed up (open): front/back pivot about X, sides about Z.
const FLAPS: {
  pos: [number, number, number]
  child: [number, number, number]
  size: [number, number, number]
  axis: 'x' | 'z'
  open: number
}[] = [
  {
    pos: [0, 0.7, 0.4],
    child: [0, 0, -0.2],
    size: [0.78, 0.02, 0.4],
    axis: 'x',
    open: rad(-110),
  },
  {
    pos: [0, 0.7, -0.4],
    child: [0, 0, 0.2],
    size: [0.78, 0.02, 0.4],
    axis: 'x',
    open: rad(110),
  },
  {
    pos: [0.4, 0.7, 0],
    child: [-0.2, 0, 0],
    size: [0.4, 0.02, 0.78],
    axis: 'z',
    open: rad(110),
  },
  {
    pos: [-0.4, 0.7, 0],
    child: [0.2, 0, 0],
    size: [0.4, 0.02, 0.78],
    axis: 'z',
    open: rad(-110),
  },
]

// ── A small printed gear (reused on bed / in gripper / in box) ───────────────
const TEETH = 8
function Gear({ material }: { material: THREE.Material }) {
  return (
    <group>
      <mesh material={material}>
        <cylinderGeometry args={[0.26, 0.26, 0.34, 18]} />
      </mesh>
      {Array.from({ length: TEETH }, (_, i) => {
        const a = (i / TEETH) * Math.PI * 2
        return (
          <mesh
            key={i}
            material={material}
            position={[Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.13, 0.3, 0.11]} />
          </mesh>
        )
      })}
      <mesh material={material}>
        <cylinderGeometry args={[0.09, 0.09, 0.4, 12]} />
      </mesh>
    </group>
  )
}

type SceneProps = {
  accentColor: string
  speed: number
  running: boolean
  staticMode: boolean
}

function Rig({ accentColor, speed, running, staticMode }: SceneProps) {
  // Shared materials — created once, reused everywhere to keep draw state low.
  const mats = useMemo(() => {
    const accent = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.45,
      metalness: 0.1,
    })
    return {
      machine: new THREE.MeshStandardMaterial({
        color: '#e7e6e2',
        roughness: 0.6,
        metalness: 0.08,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: '#9a9a9f',
        roughness: 0.35,
        metalness: 0.55,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: '#3d3f45',
        roughness: 0.5,
        metalness: 0.35,
      }),
      accent,
      accentEmissive: new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 1.4,
        roughness: 0.4,
      }),
      cardboard: new THREE.MeshStandardMaterial({
        color: '#c9b088',
        roughness: 0.9,
      }),
      tape: new THREE.MeshStandardMaterial({
        color: '#efe9db',
        roughness: 0.7,
      }),
      label: new THREE.MeshStandardMaterial({
        color: '#fbfbf8',
        roughness: 0.85,
      }),
    }
  }, [accentColor])

  // Reusable scratch vectors (per instance; useFrame is single-threaded).
  const s = useMemo(
    () => ({
      radial: new THREE.Vector3(),
      tip: new THREE.Vector3(),
      w: new THREE.Vector3(),
      e: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    }),
    [],
  )

  const cyc = useRef(0)

  // Refs into the mesh graph (all mutated in the single useFrame below).
  const headRef = useRef<THREE.Group>(null)
  const nozzleRef = useRef<THREE.MeshStandardMaterial>(null)
  const bedPartRef = useRef<THREE.Group>(null)

  const upperRef = useRef<THREE.Mesh>(null)
  const foreRef = useRef<THREE.Mesh>(null)
  const wristRef = useRef<THREE.Mesh>(null)
  const jShoulder = useRef<THREE.Mesh>(null)
  const jElbow = useRef<THREE.Mesh>(null)
  const jWrist = useRef<THREE.Mesh>(null)
  const gripperRef = useRef<THREE.Group>(null)
  const fingerL = useRef<THREE.Mesh>(null)
  const fingerR = useRef<THREE.Mesh>(null)
  const carriedRef = useRef<THREE.Group>(null)

  const stripeRefs = useRef<THREE.Mesh[]>([])
  const STRIPES = 7
  const STRIPE_GAP = 15 / STRIPES

  // Two boxes, phase-offset by exactly one cycle (τ = frac((cyc + k) / 2)).
  const boxRefs = useRef<
    Array<{
      group: THREE.Group | null
      flaps: THREE.Group[]
      tape: THREE.Mesh | null
      label: THREE.Mesh | null
      part: THREE.Group | null
    }>
  >([
    { group: null, flaps: [], tape: null, label: null, part: null },
    { group: null, flaps: [], tape: null, label: null, part: null },
  ])

  useFrame((state, delta) => {
    if (staticMode) cyc.current = STATIC_C
    else if (running)
      cyc.current += (Math.min(delta, 0.05) * speed) / CYCLE_SECONDS

    const cc = cyc.current
    const t = cc - Math.floor(cc)

    // ── Printer: growing part + rastering head + glowing nozzle ──────────────
    const g = growth(t)
    const printing = t >= 0.85 || t <= 0.3
    if (bedPartRef.current) {
      const alive = t >= 0.85 || t <= 0.46 // hidden once the arm has picked it
      bedPartRef.current.visible = alive
      bedPartRef.current.scale.y = Math.max(g, 0.001)
    }
    if (headRef.current) {
      const raster = printing ? g : 1
      headRef.current.position.x = BED_TOP.x + Math.sin(cc * 140) * 0.5
      headRef.current.position.z = BED_TOP.z + Math.cos(cc * 47) * 0.35
      headRef.current.position.y =
        BED_TOP.y + 0.18 + raster * 0.45 + (printing ? 0 : 0.9)
    }
    if (nozzleRef.current)
      nozzleRef.current.emissiveIntensity = printing
        ? 1.2 + Math.sin(cc * 120) * 0.5
        : 0.15

    // ── Robot: sample target, solve 2-link IK, orient the links ──────────────
    const th = rad(sample(TH0, t))
    const r = sample(RAD, t)
    const y = sample(HGT, t)
    const grip = sample(GRIP, t)
    const roll = rad(sample(ROLL, t))

    s.radial.set(Math.cos(th), 0, Math.sin(th))
    s.tip.copy(BASE).addScaledVector(s.radial, r)
    s.tip.y = y
    s.w.copy(s.tip)
    s.w.y += L3 // wrist sits L3 above the tip (tool points down)

    // planar IK in the (radial, up) plane from the shoulder to the wrist
    const horiz = r
    const vert = s.w.y - SHOULDER.y
    let d = Math.hypot(horiz, vert)
    d = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3)
    const phi = Math.atan2(vert, horiz)
    const q1 =
      phi + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)) // elbow-up
    s.e.copy(SHOULDER).addScaledVector(s.radial, L1 * Math.cos(q1))
    s.e.y = SHOULDER.y + L1 * Math.sin(q1)

    orient(upperRef.current, SHOULDER, s.e, s.dir)
    orient(foreRef.current, s.e, s.w, s.dir)
    orient(wristRef.current, s.w, s.tip, s.dir)
    jShoulder.current?.position.copy(SHOULDER)
    jElbow.current?.position.copy(s.e)
    jWrist.current?.position.copy(s.w)

    if (gripperRef.current) {
      gripperRef.current.position.copy(s.w)
      s.dir.copy(s.tip).sub(s.w).normalize()
      gripperRef.current.quaternion.setFromUnitVectors(UP, s.dir)
      gripperRef.current.rotateY(roll)
    }
    const off = 0.05 + grip * 0.14
    if (fingerL.current) fingerL.current.position.x = -off
    if (fingerR.current) fingerR.current.position.x = off
    if (carriedRef.current) {
      carriedRef.current.visible = t >= 0.46 && t <= 0.66
      carriedRef.current.position.copy(s.tip)
      carriedRef.current.rotation.y = cc * 2
    }

    // ── Conveyor: scrolling stripes ──────────────────────────────────────────
    for (let i = 0; i < stripeRefs.current.length; i++) {
      const m = stripeRefs.current[i]
      if (m) m.position.x = BOX_XIN + ((i * STRIPE_GAP + cc * 4.5) % 15)
    }

    // ── Boxes: staggered 2-cycle lifecycle ───────────────────────────────────
    for (let k = 0; k < 2; k++) {
      const b = boxRefs.current[k]
      if (!b.group) continue
      const tau = (cc + k) / 2 - Math.floor((cc + k) / 2)
      b.group.visible = boxOnScreen(tau)
      b.group.position.x = boxX(tau)
      const fold = flapFold(tau)
      for (let f = 0; f < b.flaps.length; f++) {
        const flap = b.flaps[f]
        if (!flap) continue
        const a = (flap.userData.open as number) * (1 - easeOut(fold))
        if (flap.userData.axis === 'x') flap.rotation.x = a
        else flap.rotation.z = a
      }
      if (b.tape) {
        const tg = tapeGrow(tau)
        b.tape.scale.x = Math.max(tg, 1e-3)
        b.tape.visible = tg > 0.01
      }
      if (b.label) {
        const ls = labelShow(tau)
        b.label.scale.setScalar(Math.max(ls, 1e-3))
        b.label.visible = ls > 0.01
      }
      if (b.part) b.part.visible = boxFilled(tau)
    }

    // ── Camera: slow orbital sway around a fixed target (text stays stable) ───
    const az = 0.383 + Math.sin(cc * 0.5) * rad(3)
    const target = TMP_TARGET
    state.camera.position.set(
      target.x + 8.84 * Math.sin(az),
      3.8,
      target.z + 8.84 * Math.cos(az),
    )
    state.camera.lookAt(target)
  })

  return (
    <group>
      {/* floor + soft contact shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        material={mats.machine}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[60, 60]} />
      </mesh>
      <ContactShadows
        position={[0, 0.01, 0.8]}
        scale={22}
        blur={2.6}
        far={4.5}
        opacity={0.42}
        resolution={256}
        color="#000000"
      />

      {/* ── Printer ── */}
      <group>
        <mesh material={mats.machine} position={[BED_TOP.x, 0.28, BED_TOP.z]}>
          <boxGeometry args={[1.9, 0.56, 1.6]} />
        </mesh>
        <mesh
          material={mats.metal}
          position={[BED_TOP.x, BED_TOP.y - 0.04, BED_TOP.z]}
        >
          <boxGeometry args={[1.5, 0.08, 1.2]} />
        </mesh>
        {/* open frame uprights + gantry */}
        {[-0.85, 0.85].map((x) => (
          <mesh
            key={x}
            material={mats.machine}
            position={[BED_TOP.x + x, 1.35, BED_TOP.z - 0.55]}
          >
            <boxGeometry args={[0.09, 2.2, 0.09]} />
          </mesh>
        ))}
        <mesh
          material={mats.machine}
          position={[BED_TOP.x, 2.4, BED_TOP.z - 0.55]}
        >
          <boxGeometry args={[1.9, 0.09, 0.09]} />
        </mesh>
        {/* print head + glowing nozzle */}
        <group ref={headRef}>
          <mesh material={mats.dark}>
            <boxGeometry args={[0.34, 0.24, 0.3]} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <coneGeometry args={[0.05, 0.12, 12]} />
            <meshStandardMaterial
              ref={nozzleRef}
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={1}
              roughness={0.4}
            />
          </mesh>
        </group>
        {/* growing part (anchored at the bed top, scales up in Y) */}
        <group ref={bedPartRef} position={[BED_TOP.x, BED_TOP.y, BED_TOP.z]}>
          <group position={[0, 0.2, 0]}>
            <Gear material={mats.accent} />
          </group>
        </group>
      </group>

      {/* ── Robot arm ── */}
      <mesh material={mats.dark} position={[BASE.x, 0.12, BASE.z]}>
        <cylinderGeometry args={[0.42, 0.5, 0.24, 24]} />
      </mesh>
      <mesh material={mats.machine} position={[BASE.x, SHOULDER_Y / 2, BASE.z]}>
        <cylinderGeometry args={[0.16, 0.18, SHOULDER_Y, 20]} />
      </mesh>
      <mesh ref={jShoulder} material={mats.dark}>
        <sphereGeometry args={[0.19, 20, 16]} />
      </mesh>
      <mesh ref={upperRef} material={mats.machine}>
        <cylinderGeometry args={[0.12, 0.12, 1, 14]} />
      </mesh>
      <mesh ref={jElbow} material={mats.dark}>
        <sphereGeometry args={[0.16, 20, 16]} />
      </mesh>
      <mesh ref={foreRef} material={mats.machine}>
        <cylinderGeometry args={[0.1, 0.1, 1, 14]} />
      </mesh>
      <mesh ref={jWrist} material={mats.dark}>
        <sphereGeometry args={[0.13, 18, 14]} />
      </mesh>
      <mesh ref={wristRef} material={mats.metal}>
        <cylinderGeometry args={[0.08, 0.08, 1, 12]} />
      </mesh>
      <group ref={gripperRef}>
        <mesh material={mats.dark} position={[0, L3 * 0.35, 0]}>
          <boxGeometry args={[0.22, 0.16, 0.18]} />
        </mesh>
        <mesh
          ref={fingerL}
          material={mats.accent}
          position={[-0.12, L3 * 0.78, 0]}
        >
          <boxGeometry args={[0.05, 0.26, 0.14]} />
        </mesh>
        <mesh
          ref={fingerR}
          material={mats.accent}
          position={[0.12, L3 * 0.78, 0]}
        >
          <boxGeometry args={[0.05, 0.26, 0.14]} />
        </mesh>
      </group>
      <group ref={carriedRef} visible={false}>
        <Gear material={mats.accent} />
      </group>

      {/* ── Conveyor ── */}
      <group>
        <mesh material={mats.dark} position={[1, 0.44, CONVEYOR_Z]}>
          <boxGeometry args={[15, 0.12, 1.5]} />
        </mesh>
        {[-0.72, 0.72].map((z) => (
          <mesh
            key={z}
            material={mats.accent}
            position={[1, 0.5, CONVEYOR_Z + z]}
          >
            <boxGeometry args={[15, 0.08, 0.06]} />
          </mesh>
        ))}
        {[-6.4, 8.4].map((x) => (
          <mesh
            key={x}
            material={mats.metal}
            position={[x, 0.44, CONVEYOR_Z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.14, 0.14, 1.5, 16]} />
          </mesh>
        ))}
        {Array.from({ length: STRIPES }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              if (el) stripeRefs.current[i] = el
            }}
            material={mats.accent}
            position={[0, 0.51, CONVEYOR_Z]}
          >
            <boxGeometry args={[0.12, 0.02, 1.3]} />
          </mesh>
        ))}
      </group>

      {/* ── Boxes (two, staggered) ── */}
      {[0, 1].map((k) => (
        <group
          key={k}
          ref={(el) => {
            boxRefs.current[k].group = el
          }}
          position={[STATION_X, 0.5, CONVEYOR_Z]}
        >
          {/* body */}
          <mesh material={mats.cardboard} position={[0, 0.35, 0]}>
            <boxGeometry args={[0.8, 0.7, 0.8]} />
          </mesh>
          {/* four hinged flaps: flat (closed) → splayed up (open) */}
          {FLAPS.map((fl, f) => (
            <group
              key={f}
              position={fl.pos}
              ref={(el) => {
                if (el) {
                  el.userData.axis = fl.axis
                  el.userData.open = fl.open
                  boxRefs.current[k].flaps[f] = el
                }
              }}
            >
              <mesh material={mats.cardboard} position={fl.child}>
                <boxGeometry args={fl.size} />
              </mesh>
            </group>
          ))}
          {/* tape across the closed seam (grows in X) */}
          <mesh
            ref={(el) => {
              boxRefs.current[k].tape = el
            }}
            material={mats.tape}
            position={[0, 0.72, 0]}
            visible={false}
          >
            <boxGeometry args={[0.84, 0.02, 0.16]} />
          </mesh>
          {/* shipping label decal on the front face */}
          <mesh
            ref={(el) => {
              boxRefs.current[k].label = el
            }}
            material={mats.label}
            position={[0.12, 0.36, 0.401]}
            visible={false}
          >
            <planeGeometry args={[0.34, 0.22]} />
          </mesh>
          {/* the packed part */}
          <group
            ref={(el) => {
              boxRefs.current[k].part = el
            }}
            position={[0, 0.2, 0]}
            scale={0.85}
            visible={false}
          >
            <Gear material={mats.accent} />
          </group>
        </group>
      ))}
    </group>
  )
}

const TMP_TARGET = new THREE.Vector3(0.2, 1.1, 0.8)

// Orient a unit-height (+Y) cylinder mesh to span from A to B.
function orient(
  mesh: THREE.Mesh | null,
  a: THREE.Vector3,
  b: THREE.Vector3,
  dir: THREE.Vector3,
) {
  if (!mesh) return
  dir.copy(b).sub(a)
  const len = dir.length() || 1e-4
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.scale.set(1, len, 1)
  dir.multiplyScalar(1 / len)
  mesh.quaternion.setFromUnitVectors(UP, dir)
}

export default function FactoryScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 2]} // cap devicePixelRatio at 2
      frameloop={props.running ? 'always' : 'demand'} // pause off-screen / reduced-motion
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [3.5, 3.8, 9], fov: 34 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#f4f3f0']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 9, 5]} intensity={1.5} />
      <directionalLight position={[-5, 4, -4]} intensity={0.35} />
      <Rig {...props} />
    </Canvas>
  )
}
