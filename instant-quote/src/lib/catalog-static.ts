// Static marketing copy for the landing page (Hero spec strip, Materials
// table). These figures mirror the canonical pricing catalog served by the
// Go backend (backend/internal/pricing/config.go, GET /api/v1/config) but
// are compiled in so the landing renders without a network round-trip.
// Keep in sync when materials or rates change — the quote flow itself
// always displays live values from the API.

export interface StaticMaterial {
  id: string
  label: string
  densityGCm3: number
  plnPerKg: number
}

export const MATERIALS: StaticMaterial[] = [
  { id: 'pla', label: 'PLA', densityGCm3: 1.25, plnPerKg: 50 },
  { id: 'petg', label: 'PETG', densityGCm3: 1.27, plnPerKg: 50 },
  { id: 'pctg', label: 'PCTG', densityGCm3: 1.23, plnPerKg: 150 },
  { id: 'asa', label: 'ASA', densityGCm3: 1.05, plnPerKg: 120 },
  { id: 'petg_fr', label: 'PETG FR (V0)', densityGCm3: 1.03, plnPerKg: 180 },
  { id: 'pa12_cf', label: 'PA12-CF', densityGCm3: 1.08, plnPerKg: 350 },
  { id: 'iglidur', label: 'Iglidur I150PF', densityGCm3: 1.3, plnPerKg: 550 },
]

// Bambu Lab H2S plate.
export const BUILD_VOLUME_MM = { x: 340, y: 320, z: 340 }

// Express … economy advertised business-day range.
export const LEAD_TIME_DAYS = { min: 3, max: 10 }

export const VAT_RATE = 0.23
