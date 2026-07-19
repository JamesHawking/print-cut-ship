import { describe, expect, test } from 'bun:test'
import { PRESET_DIRECTIONS, presetGoal } from './camera-presets'

describe('presetGoal', () => {
  const center: [number, number, number] = [10, 20, 30]

  test('front looks down +Z from the fit distance', () => {
    expect(presetGoal('front', center, 100)).toEqual({
      position: [10, 20, 130],
      target: center,
    })
  })

  test('iso direction is normalized before scaling', () => {
    const { position } = presetGoal('iso', [0, 0, 0], Math.sqrt(3))
    expect(position[0]).toBeCloseTo(1)
    expect(position[1]).toBeCloseTo(1)
    expect(position[2]).toBeCloseTo(1)
  })

  test('top keeps the epsilon off camera.up', () => {
    const { position } = presetGoal('top', [0, 0, 0], 100)
    expect(position[1]).toBeCloseTo(100)
    expect(position[2]).toBeGreaterThan(0)
  })

  test('distance scales the offset from center', () => {
    const { position } = presetGoal('right', center, 50)
    expect(position).toEqual([60, 20, 30])
  })

  test('target passes the center through', () => {
    for (const preset of Object.keys(PRESET_DIRECTIONS) as Array<
      keyof typeof PRESET_DIRECTIONS
    >) {
      expect(presetGoal(preset, center, 100).target).toBe(center)
    }
  })
})
