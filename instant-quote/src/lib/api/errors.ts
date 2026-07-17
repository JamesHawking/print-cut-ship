// Maps the backend's machine-code error envelope (ApiError{code, params})
// to localized copy — the dictionary owns all human text; the wire carries
// only codes (plans/engineering/08-i18n.md localization contract).

import type { Dictionary } from '@/lib/i18n'
import type { components } from './schema'

type ApiErrorBody = components['schemas']['ApiError']
type ApiErrorCode = components['schemas']['ApiErrorCode']

/** Thrown by callers when a typed request returns an error body. */
export class ApiRequestError extends Error {
  constructor(readonly body: unknown) {
    super('API request failed')
    this.name = 'ApiRequestError'
  }
}

function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { code?: unknown }).code === 'string'
  )
}

/**
 * Localized message for an API failure; `fallback` covers network errors,
 * unparseable bodies, and codes this build doesn't know yet.
 */
export function apiErrorMessage(
  err: unknown,
  s: Dictionary,
  fallback: string,
): string {
  const body = err instanceof ApiRequestError ? err.body : err
  if (!isApiErrorBody(body)) return fallback
  const entry = s.apiError[body.code as ApiErrorCode] as
    string | ((p: Record<string, unknown>) => string) | undefined
  // TODO(plan 11): Sentry breadcrumb when an unknown code falls through.
  if (!entry) return fallback
  return typeof entry === 'function' ? entry(body.params ?? {}) : entry
}
