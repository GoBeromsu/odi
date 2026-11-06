import { expect, test } from 'vitest'
import type { View } from '../shared/api.ts'
import type { Mode } from '../shared/session.ts'
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings.ts'
import { openStore } from './store.ts'
import { createTimer, sessionId } from './timer.ts'

const harness = (changes: Partial<Settings> = {}) => {
  const store = openStore(':memory:')
  const settings: Settings = { ...DEFAULT_SETTINGS, ...changes }
  const notes: Mode[] = []
  const views: View[] = []
  let clock = 1000
  const timer = createTimer({
    settings: () => settings,
    now: () => clock,
    plannedFor: mode =>
      (mode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60,
    persist: row => store.upsertSession({ ...row }),
    notify: mode => notes.push(mode),
    publish: view => views.push(view),
  })
  return {
    store,
    timer,
    notes,
    views,
    settings,
    at: (t: number) => {
      clock = t
      timer.tick()
    },
    set: (t: number) => {
      clock = t
    },
    rows: () => store.sessionsBetween(0, 1e12),
  }
}

test('idle view uses the default focus minutes', () => {
  const h = harness({ focusMinutes: 30 })
  expect(h.timer.view()).toEqual({
    phase: 'idle',
    mode: 'focus',
    planned: 1800,
    remaining: 1800,
  })
  h.store.close()
})

test('overtime view reports positive overtime seconds and one notification', () => {
  const h = harness()
  h.timer.start('focus', 5)
  h.at(1006)
  h.at(1007)
  expect(h.timer.view()).toEqual({
    phase: 'overtime',
    mode: 'focus',
    planned: 5,
    remaining: -2,
    overtime: 2,
  })
  expect(h.notes).toEqual(['focus'])
  h.store.close()
})

test('stop after the boundary writes a completed row to the store', () => {
  const h = harness()
  h.timer.start('focus', 5)
  h.at(1006)
  expect(h.timer.view().remaining).toBe(-1)
  h.set(1008)
  h.timer.stop()
  expect(h.rows()).toEqual([
    {
      id: sessionId(1000),
      started_at: 1000,
      ended_at: 1008,
      planned: 5,
      paused_seconds: 0,
      overtime_seconds: 3,
      status: 'completed',
      kind: 'focus',
    },
  ])
  expect(h.timer.view().phase).toBe('idle')
  h.store.close()
})

test('stop before the boundary writes a stopped row', () => {
  const h = harness()
  h.timer.start('focus', 100)
  h.set(1002)
  h.timer.stop()
  const rows = h.rows()
  expect(rows).toHaveLength(1)
  expect(rows[0].status).toBe('stopped')
  expect(rows[0].ended_at).toBe(1002)
  expect(h.notes).toEqual([])
  h.store.close()
})

test('atEnd stop ends the session at planned time without overtime', () => {
  const h = harness({ atEnd: 'stop' })
  h.timer.start('focus', 5)
  h.at(1006)
  expect(h.timer.view().phase).toBe('idle')
  expect(h.notes).toEqual(['focus'])
  expect(h.rows()).toEqual([
    {
      id: sessionId(1000),
      started_at: 1000,
      ended_at: 1005,
      planned: 5,
      paused_seconds: 0,
      overtime_seconds: 0,
      status: 'completed',
      kind: 'focus',
    },
  ])
  h.store.close()
})

test('break sessions persist with kind break', () => {
  const h = harness({ breakMinutes: 1, atEnd: 'stop' })
  h.timer.start('break')
  expect(h.timer.view().planned).toBe(60)
  h.at(1061)
  expect(h.rows()[0].kind).toBe('break')
  expect(h.notes).toEqual(['break'])
  h.store.close()
})

test('a second start is ignored while a session runs', () => {
  const h = harness()
  h.timer.start('focus', 60)
  h.timer.start('break', 30)
  expect(h.timer.view().mode).toBe('focus')
  expect(h.timer.view().planned).toBe(60)
  h.store.close()
})

test('pause and resume publish views and keep the remaining time', () => {
  const h = harness()
  h.timer.start('focus', 60)
  h.set(1010)
  h.timer.pause()
  expect(h.timer.view()).toMatchObject({ phase: 'paused', remaining: 50 })
  h.set(1040)
  h.timer.resume()
  expect(h.timer.view()).toMatchObject({ phase: 'running', remaining: 50 })
  expect(h.views.at(-1)).toMatchObject({ phase: 'running' })
  h.store.close()
})

test('ticks while idle neither publish nor persist', () => {
  const h = harness()
  h.at(2000)
  expect(h.views).toEqual([])
  expect(h.rows()).toEqual([])
  h.store.close()
})
