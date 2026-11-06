import {
  idleTimer,
  isRunning,
  overtimeSeconds,
  reduce,
  remaining,
  type Action,
  type Mode,
  type Persisted,
  type Timer,
} from '../shared/session.ts'
import type { View } from '../shared/api.ts'
import type { Settings } from '../shared/settings.ts'

export interface PersistedSession extends Persisted {
  id: string
}

export interface TimerHost {
  settings: () => Settings
  now: () => number
  plannedFor: (mode: Mode) => number
  persist: (session: PersistedSession) => void
  notify: (mode: Mode) => void
  publish: (view: View) => void
}

export const sessionId = (startedAt: number) =>
  new Date(startedAt * 1000).toISOString().replace(/[:.]/g, '-')

export function createTimer(host: TimerHost) {
  let timer = idleTimer('focus', host.plannedFor('focus'))

  const view = (): View => {
    if (timer.phase === 'idle') {
      const planned = host.plannedFor('focus')
      return { phase: 'idle', mode: 'focus', planned, remaining: planned }
    }
    const left = remaining(timer)
    return {
      phase: timer.phase,
      mode: timer.mode,
      planned: timer.planned,
      remaining: left,
      ...(timer.phase === 'overtime'
        ? { overtime: overtimeSeconds(timer) }
        : {}),
    }
  }

  const step = (action: Action) => {
    const next = reduce(timer, action, host.settings().atEnd)
    timer = next.timer
    if (next.persist) {
      host.persist({ id: sessionId(next.persist.started_at), ...next.persist })
    }
    if (next.notify) {
      host.notify(next.notify)
    }
  }

  const run = (...actions: Action[]) => {
    for (const action of actions) {
      step(action)
    }
    host.publish(view())
  }

  return {
    view,
    state: () => timer,
    running: () => isRunning(timer),
    idle: () => timer.phase === 'idle',
    start: (mode: Mode, planned?: number) => {
      if (timer.phase !== 'idle') {
        return
      }
      const seconds = planned && planned > 0 ? planned : host.plannedFor(mode)
      run({ type: 'start', mode, planned: seconds, now: host.now() })
    },
    pause: () => {
      run({ type: 'tick', now: host.now() }, { type: 'pause', now: host.now() })
    },
    resume: () => {
      run(
        { type: 'tick', now: host.now() },
        { type: 'resume', now: host.now() }
      )
    },
    stop: () => {
      run({ type: 'tick', now: host.now() }, { type: 'stop', now: host.now() })
    },
    tick: () => {
      if (timer.phase === 'idle') {
        return
      }
      run({ type: 'tick', now: host.now() })
    },
  }
}

export type SessionTimer = ReturnType<typeof createTimer>
export type { Timer }
