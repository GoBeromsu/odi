import { useEffect, useState } from 'react'
import type { SessionSummary } from '../../shared/api.ts'
import { mmss } from '../../shared/time.ts'

const { ody } = window

const startedAt = (seconds: number) => new Date(seconds * 1000)

export function Activity() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    ody.sessions().then(setSessions)
  }, [])

  return (
    <main>
      <h1>ody</h1>
      <ul data-sessions="">
        {sessions.map(s => (
          <li key={s.id}>
            <time dateTime={startedAt(s.started_at).toISOString()}>
              {startedAt(s.started_at).toLocaleString()}
            </time>
            <span>{mmss(s.recorded_seconds)}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
