import { describe, expect, it } from 'vitest'
import {
  addDays,
  atPresent,
  dayKey,
  daysBetween,
  endOf,
  isFuture,
  quarterOf,
  sameDay,
  shift,
  spanOf,
  startOf,
} from './range.ts'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('range', () => {
  it('starts weeks on Monday', () => {
    expect(dayKey(startOf(at(2026, 11, 6), 'week'))).toBe('2026-11-02')
    expect(dayKey(startOf(at(2026, 11, 2), 'week'))).toBe('2026-11-02')
    expect(dayKey(startOf(at(2026, 11, 8), 'week'))).toBe('2026-11-02')
    expect(dayKey(endOf(at(2026, 11, 6), 'week'))).toBe('2026-11-08')
  })

  it('bounds months, quarters and years', () => {
    expect(dayKey(startOf(at(2026, 11, 6), 'month'))).toBe('2026-11-01')
    expect(dayKey(endOf(at(2026, 11, 6), 'month'))).toBe('2026-11-30')
    expect(dayKey(startOf(at(2026, 11, 6), 'quarter'))).toBe('2026-10-01')
    expect(dayKey(endOf(at(2026, 11, 6), 'quarter'))).toBe('2026-12-31')
    expect(dayKey(startOf(at(2026, 11, 6), 'year'))).toBe('2026-01-01')
    expect(dayKey(endOf(at(2026, 11, 6), 'year'))).toBe('2026-12-31')
    expect(quarterOf(at(2026, 11, 6))).toBe(4)
  })

  it('bounds a leap February', () => {
    expect(dayKey(endOf(at(2028, 2, 10), 'month'))).toBe('2028-02-29')
  })

  it('shifts by one unit of the range', () => {
    expect(dayKey(shift(at(2026, 11, 6), 'day', -1))).toBe('2026-11-05')
    expect(dayKey(shift(at(2026, 11, 6), 'week', -1))).toBe('2026-10-30')
    expect(dayKey(shift(at(2026, 11, 6), 'month', 1))).toBe('2026-12-06')
    expect(dayKey(shift(at(2026, 11, 6), 'quarter', -1))).toBe('2026-08-01')
    expect(dayKey(shift(at(2026, 11, 6), 'year', 1))).toBe('2027-11-01')
  })

  it('spans a whole day in seconds', () => {
    const span = spanOf(at(2026, 11, 6), 'day')
    expect(span.to - span.from).toBe(86400)
    expect(new Date(span.from * 1000).getHours()).toBe(0)
  })

  it('spans a whole month', () => {
    const span = spanOf(at(2026, 11, 6), 'month')
    expect(dayKey(new Date(span.from * 1000))).toBe('2026-11-01')
    expect(dayKey(new Date(span.to * 1000))).toBe('2026-12-01')
  })

  it('lists every day of a week', () => {
    const days = daysBetween(at(2026, 11, 2), at(2026, 11, 8))
    expect(days).toHaveLength(7)
    expect(dayKey(days[6])).toBe('2026-11-08')
  })

  it('knows the present and the future', () => {
    const today = at(2026, 11, 6)
    expect(isFuture(at(2026, 11, 7), 'day', today)).toBe(true)
    expect(isFuture(at(2026, 11, 6), 'day', today)).toBe(false)
    expect(atPresent(at(2026, 11, 6), 'day', today)).toBe(true)
    expect(atPresent(at(2026, 11, 5), 'day', today)).toBe(false)
    expect(atPresent(at(2026, 11, 2), 'week', today)).toBe(true)
    expect(sameDay(at(2026, 11, 6), addDays(at(2026, 11, 5), 1))).toBe(true)
  })
})
