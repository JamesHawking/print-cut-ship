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

// Relative ship-by urgency, computed on the shop's Warsaw business calendar
// (mirrors formatPlacedDate's timezone pin). The raw ISO date stays available
// via tooltip at call sites.
export function formatShipBy(
  shipBy: string | null | undefined,
  overdue: boolean | undefined,
): string {
  if (!shipBy) return '—'
  if (overdue) {
    const days = daysUntilWarsaw(shipBy)
    return days < 0 ? `${-days}d overdue` : 'Overdue'
  }
  const days = daysUntilWarsaw(shipBy)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days}d`
}

function daysUntilWarsaw(isoDate: string): number {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date())
  const ms = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  return Math.round((ms - now) / 86_400_000)
}
