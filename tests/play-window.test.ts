import { describe, expect, test } from 'bun:test'
import { formatLocalClock, isSchoolHours, playWindow } from '../src/games/bedwars/client/play-window'

describe('play window', () => {
  test('formats a local 12-hour clock', () => {
    expect(formatLocalClock(new Date(2026, 10, 2, 7, 42))).toBe('7:42 AM')
    expect(formatLocalClock(new Date(2026, 10, 2, 0, 5))).toBe('12:05 AM')
    expect(formatLocalClock(new Date(2026, 10, 2, 19, 9))).toBe('7:09 PM')
  })

  test('school hours are weekdays 08:00–15:59', () => {
    const monday = (h: number, m = 0) => new Date(2026, 10, 2, h, m) // Monday
    expect(isSchoolHours(monday(7, 59))).toBe(false)
    expect(isSchoolHours(monday(8))).toBe(true)
    expect(isSchoolHours(monday(15, 59))).toBe(true)
    expect(isSchoolHours(monday(16))).toBe(false)
    expect(isSchoolHours(new Date(2026, 10, 7, 10))).toBe(false) // Saturday
    expect(playWindow(monday(10)).label).toBe('School hours')
    expect(playWindow(monday(18)).label).toBe('School closed')
  })
})
