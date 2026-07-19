// Shared admin helpers (plan 07). EN-only; errors surface as raw machine
// codes — the operator reads the wire contract, not localized copy.

import { ApiRequestError } from '@/lib/api/errors'

export function errorCode(err: unknown): string {
  const body = err instanceof ApiRequestError ? err.body : err
  if (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { code?: unknown }).code === 'string'
  ) {
    return (body as { code: string }).code
  }
  return 'internal'
}

export const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  paid: 'default',
  in_production: 'default',
  shipped: 'secondary',
  delivered: 'secondary',
  cancelled: 'destructive',
  refunded: 'destructive',
}
