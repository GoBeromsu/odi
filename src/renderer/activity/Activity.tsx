import { useEffect, useState } from 'react'
import type { SessionRecord } from '../../shared/api.ts'
import { mmss } from '../../shared/time.ts'

const { ody } = window

const startOfDay = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime() / 1000
}

const at = (seconds: number) => new Date(seconds * 1000)

export function Activity() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])

  useEffect(() => {
    const from = startOfDay()
    ody.sessions(from, from + 86400).then(setSessions)
  }, [])

  return (
    <main>
      <ul data-sessions="">
        {sessions.map(s => (
          <li key={s.id}>
            <time dateTime={at(s.started_at).toISOString()}>
              {at(s.started_at).toLocaleTimeString()}
            </time>
            <span>{mmss(s.planned - s.paused_seconds)}</span>
            <span data-kind={s.kind}>{s.status}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
