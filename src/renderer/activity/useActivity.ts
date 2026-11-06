import { useEffect, useState } from 'react'
import type {
  ActivityEvent,
  AppTotal,
  SessionRecord,
} from '../../shared/api.ts'
import { spanOf, type Range } from './range.ts'

const { ody } = window

const LIVE_INTERVAL = 5000

export interface ActivityData {
  events: ActivityEvent[]
  totals: AppTotal[]
  sessions: SessionRecord[]
  from: number
  to: number
  ready: boolean
}

const EMPTY: ActivityData = {
  events: [],
  totals: [],
  sessions: [],
  from: 0,
  to: 0,
  ready: false,
}

export function useActivity(date: Date, range: Range): ActivityData {
  const [data, setData] = useState<ActivityData>(EMPTY)
  const stamp = date.getTime()

  useEffect(() => {
    let alive = true
    const { from, to } = spanOf(new Date(stamp), range)
    const load = async () => {
      const [events, totals, sessions] = await Promise.all([
        ody.events(from, to),
        ody.totals(from, to),
        ody.sessions(from, to),
      ])
      if (alive) {
        setData({ events, totals, sessions, from, to, ready: true })
      }
    }
    void load()
    const now = Date.now() / 1000
    const live = to > now && from <= now + 86400
    const id = live ? setInterval(() => void load(), LIVE_INTERVAL) : undefined
    return () => {
      alive = false
      if (id !== undefined) {
        clearInterval(id)
      }
    }
  }, [stamp, range])

  return data
}
