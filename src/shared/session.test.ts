import { expect, test } from 'vitest'
import {
  elapsedSeconds,
  idleTimer,
  isRunning,
  overtimeSeconds,
  reduce,
  remaining,
  type Action,
  type Mode,
  type Persisted,
  type Timer,
} from './session.ts'
import type { AtEnd } from './settings.ts'

interface Trace {
  timer: Timer
  notes: Mode[]
  rows: Persisted[]
}

const drive = (
  actions: Action[],
  atEnd: AtEnd = 'overtime',
  from: Timer = idleTimer('focus', 1500)
): Trace => {
  const trace: Trace = { timer: from, notes: [], rows: [] }
  for (const action of actions) {
    const step = reduce(trace.timer, action, atEnd)
    trace.timer = step.timer
    if (step.notify) {
      trace.notes.push(step.notify)
    }
    if (step.persist) {
      trace.rows.push(step.persist)
    }
  }
  return trace
}

const start = (now: number, planned: number, mode: Mode = 'focus'): Action => ({
  type: 'start',
  mode,
  planned,
  now,
})

test('start enters running with whole-second anchors', () => {
  const { timer } = drive([start(1000.9, 100)])
  expect(timer.phase).toBe('running')
  expect(timer.mode).toBe('focus')
  expect(timer.startedAt).toBe(1000)
  expect(timer.now).toBe(1000)
  expect(remaining(timer)).toBe(100)
  expect(isRunning(timer)).toBe(true)
})

test('remaining counts down in whole ceiling seconds and never rewinds', () => {
  const { timer } = drive([
    start(0, 10),
    { type: 'tick', now: 3.2 },
    { type: 'tick', now: 1 },
  ])
  expect(remaining(timer)).toBe(7)
  expect(elapsedSeconds(timer)).toBe(3)
})

test('idle timers ignore pause, resume and stop', () => {
  const { timer, rows, notes } = drive([
    { type: 'pause', now: 10 },
    { type: 'resume', now: 11 },
    { type: 'stop', now: 12 },
  ])
  expect(timer.phase).toBe('idle')
  expect(rows).toEqual([])
  expect(notes).toEqual([])
  expect(remaining(timer)).toBe(1500)
})

test('planned time reached with atEnd overtime keeps counting and notifies once', () => {
  const trace = drive([
    start(0, 5),
    { type: 'tick', now: 6 },
    { type: 'tick', now: 7 },
    { type: 'tick', now: 8 },
  ])
  expect(trace.timer.phase).toBe('overtime')
  expect(remaining(trace.timer)).toBe(-3)
  expect(overtimeSeconds(trace.timer)).toBe(3)
  expect(trace.notes).toEqual(['focus'])
  expect(trace.rows).toEqual([])
})

test('planned time reached with atEnd stop completes the session once', () => {
  const trace = drive(
    [start(0, 5), { type: 'tick', now: 6 }, { type: 'tick', now: 9 }],
    'stop'
  )
  expect(trace.timer.phase).toBe('idle')
  expect(trace.notes).toEqual(['focus'])
  expect(trace.rows).toEqual([
    {
      started_at: 0,
      ended_at: 5,
      planned: 5,
      paused_seconds: 0,
      overtime_seconds: 0,
      status: 'completed',
      kind: 'focus',
    },
  ])
})

test('break sessions notify and persist as break', () => {
  const trace = drive([start(0, 4, 'break'), { type: 'tick', now: 5 }], 'stop')
  expect(trace.notes).toEqual(['break'])
  expect(trace.rows[0].kind).toBe('break')
})

test('pause freezes remaining and resume shifts the boundary', () => {
  const paused = drive([
    start(0, 60),
    { type: 'tick', now: 10 },
    { type: 'pause', now: 10 },
    { type: 'tick', now: 40 },
  ])
  expect(paused.timer.phase).toBe('paused')
  expect(remaining(paused.timer)).toBe(50)
  expect(paused.notes).toEqual([])

  const resumed = drive(
    [
      { type: 'resume', now: 40 },
      { type: 'tick', now: 45 },
    ],
    'overtime',
    paused.timer
  )
  expect(resumed.timer.phase).toBe('running')
  expect(resumed.timer.pausedSeconds).toBe(30)
  expect(remaining(resumed.timer)).toBe(45)
})

test('pause during overtime holds the overtime and resume returns to overtime', () => {
  const over = drive([start(0, 5), { type: 'tick', now: 12 }])
  expect(over.timer.phase).toBe('overtime')

  const held = drive(
    [
      { type: 'pause', now: 12 },
      { type: 'tick', now: 30 },
    ],
    'overtime',
    over.timer
  )
  expect(held.timer.phase).toBe('paused')
  expect(remaining(held.timer)).toBe(-7)

  const back = drive([{ type: 'resume', now: 30 }], 'overtime', held.timer)
  expect(back.timer.phase).toBe('overtime')
  expect(remaining(back.timer)).toBe(-7)
  expect(back.notes).toEqual([])
})

test('sleeping across the boundary notifies once and records the overtime', () => {
  const trace = drive([
    start(0, 1500),
    { type: 'tick', now: 1 },
    { type: 'tick', now: 10000 },
    { type: 'tick', now: 10001 },
  ])
  expect(trace.timer.phase).toBe('overtime')
  expect(overtimeSeconds(trace.timer)).toBe(8501)
  expect(trace.notes).toEqual(['focus'])
})

test('stop before the boundary persists a stopped session', () => {
  const trace = drive([start(0, 100), { type: 'stop', now: 2 }])
  expect(trace.timer.phase).toBe('idle')
  expect(trace.rows).toEqual([
    {
      started_at: 0,
      ended_at: 2,
      planned: 100,
      paused_seconds: 0,
      overtime_seconds: 0,
      status: 'stopped',
      kind: 'focus',
    },
  ])
})

test('stop after the boundary persists a completed session with overtime', () => {
  const trace = drive([
    start(0, 5),
    { type: 'tick', now: 9 },
    { type: 'stop', now: 9 },
  ])
  expect(trace.rows[0]).toEqual({
    started_at: 0,
    ended_at: 9,
    planned: 5,
    paused_seconds: 0,
    overtime_seconds: 4,
    status: 'completed',
    kind: 'focus',
  })
})

test('stop while paused counts the open pause', () => {
  const trace = drive([
    start(0, 100),
    { type: 'pause', now: 10 },
    { type: 'stop', now: 25 },
  ])
  expect(trace.rows[0]).toEqual({
    started_at: 0,
    ended_at: 25,
    planned: 100,
    paused_seconds: 15,
    overtime_seconds: 0,
    status: 'stopped',
    kind: 'focus',
  })
})

test('start is ignored by the reducer only through the host, never silently mutated', () => {
  const first = drive([start(0, 60)])
  const second = reduce(first.timer, start(100, 30, 'break'), 'overtime')
  expect(second.timer).toMatchObject({
    phase: 'running',
    mode: 'break',
    planned: 30,
    startedAt: 100,
  })
  expect(first.timer.mode).toBe('focus')
})
