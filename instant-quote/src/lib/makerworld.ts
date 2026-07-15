// MakerWorld URL import: parse model links, pick a print profile, and download
// the 3MF via the community-documented Bambu endpoints (no official API).

import { MAX_FILE_BYTES } from './upload'
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

export interface MakerworldDesign {
  id?: number
  title?: string
  modelId?: string
  defaultInstanceId?: number
  instances?: Array<{ id: number; profileId?: number }>
}

// Instances carry two ids: `id` (the instance — what defaultInstanceId and
// URL fragments reference) and `profileId` (what the iot-service download
// endpoint wants). Resolve either to the downloadable profileId.
export function pickProfileId(
  design: Pick<MakerworldDesign, 'defaultInstanceId' | 'instances'>,
  requested?: number,
): number | null {
  const instances = design.instances ?? []
  if (requested) {
    const byInstance = instances.find((i) => i.id === requested)
    // No matching instance: the fragment may already be a raw profileId.
    return byInstance?.profileId ?? requested
  }
  const def = instances.find((i) => i.id === design.defaultInstanceId)
  return def?.profileId ?? instances[0]?.profileId ?? null
}

const API_BASE = 'https://api.bambulab.com/v1'

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function downloadMakerworldModel(
  ref: MakerworldRef,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<
  { bytes: ArrayBuffer; fileName: string } | { error: MakerworldErrorCode }
> {
  const designRes = await fetchImpl(
    `${API_BASE}/design-service/design/${ref.designId}`,
  )
  if (!designRes.ok) return { error: 'design_not_found' }
  const design = await readJson<MakerworldDesign>(designRes)
  // Nonexistent designs come back 200 with an empty object (id: 0).
  if (!design?.id) return { error: 'design_not_found' }

  const profileId = pickProfileId(design, ref.profileId)
  if (!profileId || !design.modelId) return { error: 'no_instance' }

  const profileRes = await fetchImpl(
    `${API_BASE}/iot-service/api/user/profile/${profileId}?model_id=${design.modelId}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  if (profileRes.status === 401) return { error: 'auth_expired' }
  if (!profileRes.ok) return { error: 'download_failed' }
  const profile = await readJson<{ url?: string; name?: string }>(profileRes)
  if (!profile?.url) return { error: 'download_failed' }

  // The presigned URL must go out verbatim — the S3 signature covers the
  // exact query bytes — and without following redirects.
  const fileRes = await fetchImpl(profile.url, { redirect: 'manual' })
  if (!fileRes.ok) return { error: 'download_failed' }
  const declared = Number(fileRes.headers.get('content-length') ?? 0)
  if (declared > MAX_FILE_BYTES) return { error: 'too_large' }
  const bytes = await fileRes.arrayBuffer()
  if (bytes.byteLength > MAX_FILE_BYTES) return { error: 'too_large' }

  const base =
    profile.name?.trim() || design.title?.trim() || `makerworld-${ref.designId}`
  const fileName = base.toLowerCase().endsWith('.3mf') ? base : `${base}.3mf`
  return { bytes, fileName }
}
