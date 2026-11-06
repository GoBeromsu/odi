import type {
  ActivityEvent,
  AppTotal,
  SessionRecord,
} from '../../shared/api.ts'
import { addDays, dayKey, midnight } from './range.ts'

export interface Band {
  start: number
  end: number
}

export const dayFrom = (date: Date) => midnight(date).getTime() / 1000

export const overlaps = (e: Band, from: number, to: number) =>
  e.end > from && e.start < to

export const clip = (e: ActivityEvent, from: number, to: number) => ({
  ...e,
  start: Math.max(e.start, from),
  end: Math.min(e.end, to),
})

export const eventsIn = (
  events: ActivityEvent[],
  from: number,
  to: number
) => events.filter(e => overlaps(e, from, to)).map(e => clip(e, from, to))

export const activeSeconds = (events: ActivityEvent[]) =>
  events.reduce((sum, e) => (e.kind === 'active' ? sum + (e.end - e.start) : sum), 0)

export const switchCount = (events: ActivityEvent[]) =>
  events.filter(e => e.kind === 'active').length

export function focusBands(sessions: SessionRecord[]): Band[] {
  return sessions
    .filter(s => s.kind === 'focus' && s.ended_at !== null)
    .map(s => ({ start: s.started_at, end: s.ended_at as number }))
    .sort((a, b) => a.start - b.start)
}

export const focusSeconds = (sessions: SessionRecord[]) =>
  focusBands(sessions).reduce(
    (sum, band) => sum + Math.max(0, band.end - band.start),
    0
  )

export const insideFocus = (event: Band, bands: Band[]) =>
  bands.some(b => event.start >= b.start && event.end <= b.end)

export function totalsOf(events: ActivityEvent[]): AppTotal[] {
  const apps = new Map<string, AppTotal>()
  for (const e of events) {
    if (e.kind !== 'active') {
      continue
    }
    const key = String(e.bundle_id ?? e.app ?? '')
    const entry = apps.get(key) ?? {
      app: e.app,
      bundle_id: e.bundle_id,
      seconds: 0,
      sites: [],
    }
    const seconds = e.end - e.start
    entry.seconds += seconds
    if (e.domain) {
      const site = entry.sites.find(s => s.domain === e.domain)
      if (site) {
        site.seconds += seconds
      } else {
        entry.sites.push({ domain: e.domain, seconds })
      }
    }
    apps.set(key, entry)
  }
  const bigger = (a: { seconds: number }, b: { seconds: number }) =>
    b.seconds - a.seconds
  return [...apps.values()]
    .map(a => ({ ...a, sites: [...a.sites].sort(bigger) }))
    .sort(bigger)
}

export const appName = (total: AppTotal) =>
  total.app ?? total.bundle_id ?? ''

export interface DaySummary {
  day: Date
  key: string
  events: ActivityEvent[]
  active: number
  focus: number
  totals: AppTotal[]
}

export function byDay(
  days: Date[],
  events: ActivityEvent[],
  sessions: SessionRecord[]
): DaySummary[] {
  const bands = focusBands(sessions)
  return days.map(day => {
    const from = dayFrom(day)
    const to = dayFrom(addDays(day, 1))
    const slice = eventsIn(events, from, to)
    const focus = bands.reduce(
      (sum, b) =>
        sum + Math.max(0, Math.min(b.end, to) - Math.max(b.start, from)),
      0
    )
    return {
      day,
      key: dayKey(day),
      events: slice,
      active: activeSeconds(slice),
      focus,
      totals: totalsOf(slice),
    }
  })
}

export function hourWindow(events: ActivityEvent[], from: number) {
  const active = events.filter(e => e.kind !== 'away')
  if (active.length === 0) {
    return { first: 9, last: 18 }
  }
  const hours = active.flatMap(e => [
    Math.floor((e.start - from) / 3600),
    Math.ceil((e.end - from) / 3600),
  ])
  return {
    first: Math.max(0, Math.min(...hours) - 1),
    last: Math.min(24, Math.max(...hours) + 1),
  }
}
