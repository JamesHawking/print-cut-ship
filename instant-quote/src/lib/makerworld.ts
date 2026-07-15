// MakerWorld URL import, client half: parse model links and map backend
// error codes to user-facing messages. The download itself (Bambu Cloud
// endpoints, profile resolution) lives in the Go backend
// (backend/internal/makerworld, POST /api/v1/makerworld/fetch).

import { strings } from './strings'

export interface MakerworldRef {
  designId: number
  profileId?: number
}

export type MakerworldErrorCode =
  | 'token_missing'
  | 'design_not_found'
  | 'no_instance'
  | 'auth_expired'
  | 'download_failed'
  | 'too_large'

export const MAKERWORLD_ERROR_MESSAGES: Record<MakerworldErrorCode, string> = {
  token_missing: strings.errors.mwNotConfigured,
  design_not_found: strings.errors.mwNotFound,
  no_instance: strings.errors.mwNoProfile,
  auth_expired: strings.errors.mwAuthExpired,
  download_failed: strings.errors.mwDownloadFailed,
  too_large: strings.errors.mwTooLarge,
}

// /{locale?}/models/{designId}{-slug?}, e.g. /en/models/123456-cool-benchy
const MODEL_PATH =
  /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?models\/(\d+)(?:-[^/]*)?\/?$/i

export function parseMakerworldUrl(input: string): MakerworldRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (host !== 'makerworld.com' && host !== 'www.makerworld.com') return null
  const match = MODEL_PATH.exec(url.pathname)
  if (!match) return null
  const designId = Number(match[1])
  if (!Number.isSafeInteger(designId) || designId <= 0) return null
  const profileMatch = /^#profileId-(\d+)$/.exec(url.hash)
  return profileMatch
    ? { designId, profileId: Number(profileMatch[1]) }
    : { designId }
}
