// Ship-date computation from a Europe/Warsaw wall clock with a 14:00 same-day
// cutoff, skipping weekends. No date library: we extract the Warsaw wall-clock
// via Intl, then do integer calendar math (DST-safe — we only ever step whole
// calendar days after extracting the local date).

import { PRICING, type LeadTimeId } from './pricing-config'

export interface WarsawNow {
  y: number
  m: number // 1-12
  d: number
  hour: number
  minute: number
  weekday: number // 1=Mon .. 7=Sun
}

const WARSAW = 'Europe/Warsaw'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WARSAW,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

export function getWarsawNow(now: Date): WarsawNow {
  const parts = partsFormatter.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 1,
  }
}

interface CalDate {
  y: number
  m: number
  d: number
}

// Weekday (1=Mon..7=Sun) for a calendar date, via UTC (no TZ involved).
function weekdayOf({ y, m, d }: CalDate): number {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow
}

function isWeekend(date: CalDate): boolean {
  const wd = weekdayOf(date)
  return wd === 6 || wd === 7
}

function addCalendarDays(date: CalDate, n: number): CalDate {
  const dt = new Date(Date.UTC(date.y, date.m - 1, date.d + n))
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  }
}

function nextBusinessDay(date: CalDate): CalDate {
  let next = addCalendarDays(date, 1)
  while (isWeekend(next)) next = addCalendarDays(next, 1)
  return next
}

function addBusinessDays(date: CalDate, n: number): CalDate {
  let result = date
  for (let i = 0; i < n; i++) result = nextBusinessDay(result)
  return result
}

export interface ShipDate {
  date: CalDate
  dispatchStartsToday: boolean // false if weekend or past 14:00 cutoff
  label: string // e.g. "Thu, 16 Jul"
}

const labelFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatLabel({ y, m, d }: CalDate): string {
  return labelFormatter.format(new Date(Date.UTC(y, m - 1, d)))
}

export function computeShipDate(
  lead: LeadTimeId,
  now: Date = new Date(),
): ShipDate {
  const w = getWarsawNow(now)
  const today: CalDate = { y: w.y, m: w.m, d: w.d }

  const todayIsBusiness = !isWeekend(today)
  const beforeCutoff = w.hour < PRICING.sameDayCutoffHour
  const dispatchStartsToday = todayIsBusiness && beforeCutoff

  // Day 0 for the lead-time countdown: today if we can still dispatch today,
  // otherwise the next business day.
  const day0 = dispatchStartsToday ? today : nextBusinessDay(today)

  const businessDays = PRICING.leadTimes[lead].businessDays
  const shipDate = addBusinessDays(day0, businessDays)

  return {
    date: shipDate,
    dispatchStartsToday,
    label: formatLabel(shipDate),
  }
}

export function formatWarsawClock(now: Date = new Date()): string {
  const w = getWarsawNow(now)
  const hh = String(w.hour).padStart(2, '0')
  const mm = String(w.minute).padStart(2, '0')
  return `${hh}:${mm}`
}
