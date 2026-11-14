/**
 * The player-facing clock and the school-hours rule.
 *
 * School days are Monday–Friday, 08:00–16:00 local time. During that window
 * players may use the LAN host; outside it, point them at the Freebuff site.
 * This is advice plus a visible clock, not an authentication gate.
 */
export const SCHOOL_START_HOUR = 8
export const SCHOOL_END_HOUR = 16
export const FREEBUFF_SITE = 'https://clache.freebuff.page'

export interface PlayWindow {
  clock: string
  school: boolean
  label: string
}

/** Local 12-hour clock, e.g. `7:42 PM`. */
export function formatLocalClock(date: Date = new Date()): string {
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 || 12
  return `${hour}:${m} ${suffix}`
}

/** School hours are weekdays 08:00–15:59 local time. */
export function isSchoolHours(date: Date = new Date()): boolean {
  const day = date.getDay()
  const hour = date.getHours()
  return day >= 1 && day <= 5 && hour >= SCHOOL_START_HOUR && hour < SCHOOL_END_HOUR
}

export function playWindow(date: Date = new Date()): PlayWindow {
  const school = isSchoolHours(date)
  return {
    clock: formatLocalClock(date),
    school,
    label: school ? 'School hours' : 'School closed',
  }
}
