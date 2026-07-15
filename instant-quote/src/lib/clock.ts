// Warsaw wall clock for display (footer, quote page). Ship-date math lives
// in the Go backend (GET /api/v1/ship-dates); this is presentation only.

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatWarsawClock(now: Date = new Date()): string {
  return clockFormatter.format(now)
}
