// Funnel event logging. Shaped like PostHog's capture() so a real PostHog client
// can be dropped in later by replacing the body of track().

export type FunnelEvent =
  | 'upload_started'
  | 'parse_succeeded'
  | 'parse_failed'
  | 'quote_shown'
  | 'config_changed'
  | 'order_clicked'
  | 'order_submitted'
  | 'step_quote_requested'
  | 'makerworld_fetch_started'
  | 'makerworld_fetch_succeeded'
  | 'makerworld_fetch_failed'
  | 'file_upload_started'
  | 'file_upload_succeeded'
  | 'file_upload_failed'

let sessionId: string | null = null

function getSessionId(): string {
  if (sessionId) return sessionId
  sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return sessionId
}

export function track(
  event: FunnelEvent,
  properties: Record<string, unknown> = {},
): void {
  const payload = {
    event,
    properties,
    timestamp: new Date().toISOString(),
    distinct_id: getSessionId(),
  }
  // Drop-in point for PostHog: posthog.capture(event, properties)
  console.info('[funnel]', payload)
}
