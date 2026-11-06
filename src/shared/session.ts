import type { AtEnd } from './settings.ts'

export type Mode = 'focus' | 'break'
export type Phase = 'idle' | 'running' | 'paused' | 'overtime'
export type Status = 'completed' | 'stopped'

export interface Timer {
  phase: Phase
  mode: Mode
  planned: number
  startedAt: number
  pausedSeconds: number
  pausedAt: number | null
  now: number
  notified: boolean
}

export interface Persisted {
  started_at: number
  ended_at: number
  planned: number
  paused_seconds: number
  overtime_seconds: number
  status: Status
  kind: Mode
}

export interface Step {
  timer: Timer
  notify: Mode | null
  persist: Persisted | null
}

export type Action =
  | { type: 'start'; mode: Mode; planned: number; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'stop'; now: number }
  | { type: 'tick'; now: number }

const whole = (n: number) => Math.floor(n)

export const idleTimer = (mode: Mode = 'focus', planned = 1500): Timer => ({
  phase: 'idle',
  mode,
  planned,
  startedAt: 0,
  pausedSeconds: 0,
  pausedAt: null,
  now: 0,
  notified: false,
})

const due = (t: Timer) =>
  t.startedAt +
  t.planned +
  t.pausedSeconds +
  (t.pausedAt === null ? 0 : t.now - t.pausedAt)

export const remaining = (t: Timer) =>
  t.phase === 'idle' ? t.planned : Math.ceil(due(t) - t.now)

export const overtimeSeconds = (t: Timer) => Math.max(0, -remaining(t))

export const elapsedSeconds = (t: Timer) =>
  t.phase === 'idle' ? 0 : whole(t.planned - remaining(t))

export const isRunning = (t: Timer) =>
  t.phase === 'running' || t.phase === 'overtime'

const still = (t: Timer): Step => ({ timer: t, notify: null, persist: null })

const pausedTotal = (t: Timer) =>
  t.pausedSeconds + (t.pausedAt === null ? 0 : t.now - t.pausedAt)

const closed = (t: Timer, endedAt: number, status: Status): Persisted => ({
  started_at: t.startedAt,
  ended_at: endedAt,
  planned: t.planned,
  paused_seconds: pausedTotal(t),
  overtime_seconds: overtimeSeconds(t),
  status,
  kind: t.mode,
})

function tick(t: Timer, now: number, atEnd: AtEnd): Step {
  if (t.phase === 'idle') {
    return still(t)
  }
  const next = { ...t, now: Math.max(t.now, now) }
  if (next.phase !== 'running' || remaining(next) > 0) {
    return still(next)
  }
  if (atEnd === 'stop') {
    const ended = due(next)
    return {
      timer: idleTimer(next.mode, next.planned),
      notify: next.notified ? null : next.mode,
      persist: closed({ ...next, now: ended }, ended, 'completed'),
    }
  }
  return {
    timer: { ...next, phase: 'overtime', notified: true },
    notify: next.notified ? null : next.mode,
    persist: null,
  }
}

export function reduce(t: Timer, action: Action, atEnd: AtEnd): Step {
  switch (action.type) {
    case 'start': {
      const at = whole(action.now)
      return still({
        phase: 'running',
        mode: action.mode,
        planned: action.planned,
        startedAt: at,
        pausedSeconds: 0,
        pausedAt: null,
        now: at,
        notified: false,
      })
    }
    case 'tick':
      return tick(t, whole(action.now), atEnd)
    case 'pause': {
      const now = Math.max(t.now, whole(action.now))
      if (!isRunning(t)) {
        return still({ ...t, now: t.phase === 'idle' ? t.now : now })
      }
      return still({ ...t, phase: 'paused', pausedAt: now, now })
    }
    case 'resume': {
      const now = Math.max(t.now, whole(action.now))
      if (t.phase !== 'paused' || t.pausedAt === null) {
        return still({ ...t, now: t.phase === 'idle' ? t.now : now })
      }
      const resumed = {
        ...t,
        now,
        pausedSeconds: t.pausedSeconds + (now - t.pausedAt),
        pausedAt: null,
      }
      return still({
        ...resumed,
        phase: remaining(resumed) > 0 ? 'running' : 'overtime',
      })
    }
    case 'stop': {
      if (t.phase === 'idle') {
        return still(t)
      }
      const now = Math.max(t.now, whole(action.now))
      const last = { ...t, now }
      const reached = remaining(last) <= 0
      return {
        timer: idleTimer('focus', t.planned),
        notify: null,
        persist: closed(last, now, reached ? 'completed' : 'stopped'),
      }
    }
  }
}
