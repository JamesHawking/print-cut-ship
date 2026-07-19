/**
 * Camera presets for the quote editor viewport. Scene units are mm; the
 * camera distance always comes from `bounds.refresh().getSize().distance`
 * (which already includes the Bounds `margin` fit math) — never hardcoded.
 */
export type CameraPreset = 'front' | 'right' | 'top' | 'iso'

export const PRESET_DIRECTIONS: Record<
  CameraPreset,
  readonly [number, number, number]
> = {
  front: [0, 0, 1],
  right: [1, 0, 0],
  // Epsilon keeps the view direction off camera.up so lookAt stays stable.
  top: [0, 1, 1e-4],
  iso: [1, 1, 1],
}

export function presetGoal(
  preset: CameraPreset,
  center: [number, number, number],
  distance: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const [dx, dy, dz] = PRESET_DIRECTIONS[preset]
  const length = Math.hypot(dx, dy, dz)
  return {
    position: [
      center[0] + (dx / length) * distance,
      center[1] + (dy / length) * distance,
      center[2] + (dz / length) * distance,
    ],
    target: center,
  }
}
