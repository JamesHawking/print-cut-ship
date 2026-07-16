// Locale-neutral facts for the material landing pages. Numbers live ONCE —
// the pl/en copy modules only carry prose. Values are typical published FDM
// figures for the printed (not injection-molded) material, chosen to match
// what the shop actually achieves; treat edits as content changes.

import type { PublishedMaterialId } from './slugs'

export type Rating = 'excellent' | 'good' | 'moderate' | 'low'

export interface MaterialData {
  /** Tensile strength, MPa (XY, typical printed). */
  tensileMPa: number
  /** Heat deflection temperature @ 0.45 MPa, °C. */
  hdtC: number
  uv: Rating
  layerAdhesion: Rating
  minWallMm: number
  /** General achievable tolerance, ± mm per 100 mm. */
  toleranceMm: number
  compareWith: [PublishedMaterialId, PublishedMaterialId]
}

export const MATERIAL_DATA: Record<PublishedMaterialId, MaterialData> = {
  petg: {
    tensileMPa: 50,
    hdtC: 70,
    uv: 'moderate',
    layerAdhesion: 'excellent',
    minWallMm: 1.2,
    toleranceMm: 0.3,
    compareWith: ['asa', 'pa12_cf'],
  },
  asa: {
    tensileMPa: 40,
    hdtC: 98,
    uv: 'excellent',
    layerAdhesion: 'good',
    minWallMm: 1.2,
    toleranceMm: 0.3,
    compareWith: ['petg', 'pa12_cf'],
  },
  pa12_cf: {
    tensileMPa: 100,
    hdtC: 170,
    uv: 'good',
    layerAdhesion: 'good',
    minWallMm: 1.0,
    toleranceMm: 0.25,
    compareWith: ['petg', 'asa'],
  },
}
