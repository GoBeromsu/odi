export type Range = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const RANGES: readonly Range[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
]

export const DAY_SECONDS = 86400

export const addDays = (date: Date, count: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

export const midnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const sameDay = (a: Date, b: Date) =>
  midnight(a).getTime() === midnight(b).getTime()

export const weekIndex = (date: Date) => (date.getDay() + 6) % 7

export function startOf(date: Date, range: Range) {
  switch (range) {
    case 'week':
      return midnight(addDays(date, -weekIndex(date)))
    case 'month':
      return new Date(date.getFullYear(), date.getMonth(), 1)
    case 'quarter':
      return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1)
    case 'year':
      return new Date(date.getFullYear(), 0, 1)
    default:
      return midnight(date)
  }
}

export function endOf(date: Date, range: Range) {
  const from = startOf(date, range)
  switch (range) {
    case 'week':
      return addDays(from, 6)
    case 'month':
      return new Date(from.getFullYear(), from.getMonth() + 1, 0)
    case 'quarter':
      return new Date(from.getFullYear(), from.getMonth() + 3, 0)
    case 'year':
      return new Date(from.getFullYear(), 11, 31)
    default:
      return from
  }
}

export function shift(date: Date, range: Range, steps: number) {
  switch (range) {
    case 'week':
      return addDays(date, 7 * steps)
    case 'month':
      return new Date(
        date.getFullYear(),
        date.getMonth() + steps,
        Math.min(date.getDate(), 28)
      )
    case 'quarter':
      return new Date(date.getFullYear(), date.getMonth() + 3 * steps, 1)
    case 'year':
      return new Date(date.getFullYear() + steps, date.getMonth(), 1)
    default:
      return addDays(date, steps)
  }
}

export const spanOf = (date: Date, range: Range) => ({
  from: startOf(date, range).getTime() / 1000,
  to: addDays(endOf(date, range), 1).getTime() / 1000,
})

export function daysBetween(from: Date, to: Date) {
  const out: Date[] = []
  for (let d = midnight(from); d <= to; d = addDays(d, 1)) {
    out.push(d)
  }
  return out
}

export const quarterOf = (date: Date) => Math.floor(date.getMonth() / 3) + 1

const pad = (n: number) => String(n).padStart(2, '0')

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const isFuture = (date: Date, range: Range, today: Date) =>
  startOf(date, range).getTime() > midnight(today).getTime()

export const atPresent = (date: Date, range: Range, today: Date) =>
  endOf(date, range).getTime() >= midnight(today).getTime()
