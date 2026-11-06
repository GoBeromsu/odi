import { afterEach, expect, test, vi } from 'vitest'
import type { Health } from '../shared/api.ts'
import {
  coerceSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from '../shared/settings.ts'
import { openStore } from './store.ts'
import {
  browserFor,
  type Browser,
  type DomainRead,
  type FrontApp,
} from './track.ts'
import { createWatcher } from './watcher.ts'

const FINDER: FrontApp = { app: 'Finder', bundle_id: 'com.apple.finder' }
const SAFARI: FrontApp = { app: 'Safari', bundle_id: 'com.apple.Safari' }
const TERMINAL: FrontApp = { app: 'Terminal', bundle_id: 'com.apple.Terminal' }

const setup = (changes: Partial<Settings> = {}) => {
  const store = openStore(':memory:')
  const asked: Browser[] = []
  const healths: Health[] = []
  const state = {
    settings: coerceSettings({ ...DEFAULT_SETTINGS, ...changes }),
    clock: 1000,
    idle: 0,
    front: FINDER as FrontApp | null,
    read: { domain: 'example.com', denied: false, failed: false } as DomainRead,
  }
  const watcher = createWatcher({
    store,
    settings: () => state.settings,
    patch: next => {
      state.settings = coerceSettings({ ...state.settings, ...next })
    },
    readFrontApp: async () => state.front,
    readDomain: async b => {
      asked.push(b)
      return state.read
    },
    browserFor,
    idleSeconds: () => state.idle,
    now: () => state.clock,
    onHealth: h => healths.push(h),
  })
  const span = async (from: number, to: number) => {
    for (let t = from; t <= to; t++) {
      state.clock = t
      await watcher.tick()
    }
  }
  const events = () =>
    store
      .eventsBetween(0, 1e12)
      .map(e => [e.kind, e.start, e.end, e.app, e.domain])
  return { store, watcher, state, asked, healths, span, events }
}

const open: { close: () => void }[] = []
const keep = <T extends { store: { close: () => void } }>(h: T) => {
  open.push(h.store)
  return h
}

afterEach(() => {
  for (const store of open.splice(0)) {
    store.close()
  }
  vi.useRealTimers()
})

test('a steady front app merges into one event and splits on app change', async () => {
  const h = keep(setup())
  await h.span(1000, 1005)
  h.state.front = TERMINAL
  await h.span(1006, 1009)
  expect(h.events()).toEqual([
    ['active', 1000, 1005, 'Finder', null],
    ['active', 1006, 1009, 'Terminal', null],
  ])
  expect(h.watcher.health()).toEqual({ state: 'recording' })
})

test('crossing the idle threshold splits the event into an idle event', async () => {
  const h = keep(setup({ idleSeconds: 180 }))
  await h.span(1000, 1002)
  h.state.idle = 180
  await h.span(1003, 1005)
  expect(h.events()).toEqual([
    ['active', 1000, 1002, 'Finder', null],
    ['idle', 1003, 1005, 'Finder', null],
  ])
})

test('idle-exempt apps keep recording as active past the threshold', async () => {
  const h = keep(setup({ idleSeconds: 180, idleExempt: ['Finder'] }))
  h.state.idle = 600
  await h.span(1000, 1003)
  expect(h.events()).toEqual([['active', 1000, 1003, 'Finder', null]])
})

test('excluded apps store nothing at all', async () => {
  const h = keep(setup({ excludedApps: ['com.apple.finder'] }))
  await h.span(1000, 1004)
  expect(h.events()).toEqual([])
})

test('a lock without ticks stores one away event and active resumes after unlock', async () => {
  const h = keep(setup())
  h.watcher.suspend(10)
  expect(h.watcher.health()).toEqual({ state: 'paused' })
  h.state.clock = 50
  await h.watcher.tick()
  h.watcher.resume(100)
  expect(h.watcher.health()).toEqual({ state: 'recording' })
  await h.span(100, 101)
  expect(h.events()).toEqual([
    ['away', 10, 100, null, null],
    ['active', 100, 101, 'Finder', null],
  ])
})

test('a lock screen split closes the active event and reopens after unlock', async () => {
  const h = keep(setup())
  await h.span(1000, 1003)
  h.watcher.lock(1004)
  await h.span(1005, 1010)
  h.watcher.unlock(1011)
  await h.span(1011, 1012)
  expect(h.events()).toEqual([
    ['active', 1000, 1003, 'Finder', null],
    ['away', 1004, 1011, null, null],
    ['active', 1011, 1012, 'Finder', null],
  ])
})

test('a crash gap after last_alive is closed as away on launch', async () => {
  const h = keep(setup())
  h.store.heartbeat({ kind: 'active', app: 'Finder' }, 50, 2)
  h.state.clock = 400
  expect(h.watcher.closeCrashGap()).toEqual({ start: 50, end: 400 })
  expect(h.events()).toEqual([
    ['active', 50, 50, 'Finder', null],
    ['away', 50, 400, null, null],
  ])
})

test('without browser consent no domain read happens and the domain stays null', async () => {
  const h = keep(setup())
  h.state.front = SAFARI
  await h.span(1000, 1004)
  expect(h.asked).toEqual([])
  expect(h.events()).toEqual([['active', 1000, 1004, 'Safari', null]])
})

test('consent without granted auth still spawns nothing', async () => {
  const h = keep(setup({ browserConsent: true, browserAuth: 'unknown' }))
  h.state.front = SAFARI
  await h.span(1000, 1004)
  expect(h.asked).toEqual([])
})

test('granted auth records the browser domain', async () => {
  const h = keep(setup({ browserConsent: true, browserAuth: 'granted' }))
  h.state.front = SAFARI
  await h.span(1000, 1002)
  expect(h.asked).toHaveLength(3)
  expect(h.events()).toEqual([['active', 1000, 1002, 'Safari', 'example.com']])
})

test('an automation denial reports health, stops asking and keeps the app event', async () => {
  const h = keep(setup({ browserConsent: true, browserAuth: 'granted' }))
  h.state.front = SAFARI
  h.state.read = { domain: null, denied: true, failed: true }
  await h.span(1000, 1003)
  expect(h.asked).toHaveLength(1)
  expect(h.state.settings.browserAuth).toBe('denied')
  expect(h.watcher.health()).toEqual({
    state: 'error',
    reason: 'automation-denied',
  })
  expect(h.healths).toContainEqual({
    state: 'error',
    reason: 'automation-denied',
  })
  expect(h.events()).toEqual([['active', 1000, 1003, 'Safari', null]])
})

test('five consecutive null fronts report a failed tracker', async () => {
  const h = keep(setup())
  h.state.front = null
  await h.span(1000, 1003)
  expect(h.watcher.health()).toEqual({ state: 'recording' })
  await h.span(1004, 1004)
  expect(h.watcher.health()).toEqual({
    state: 'error',
    reason: 'tracker-failed',
  })
  h.state.front = FINDER
  await h.span(1005, 1006)
  expect(h.watcher.health()).toEqual({ state: 'recording' })
})

test('start samples every second on its own interval', async () => {
  vi.useFakeTimers()
  const h = keep(setup())
  h.watcher.start()
  await vi.advanceTimersByTimeAsync(10)
  for (let t = 1001; t <= 1004; t++) {
    h.state.clock = t
    await vi.advanceTimersByTimeAsync(1000)
  }
  h.watcher.stop()
  expect(h.events()).toEqual([['active', 1000, 1004, 'Finder', null]])
})

test('a refused authorization from the request flow surfaces as automation-denied', async () => {
  const h = keep(setup({ browserConsent: true, browserAuth: 'granted' }))
  h.state.front = SAFARI
  await h.span(1000, 1001)
  const askedWhileGranted = h.asked.length
  expect(askedWhileGranted).toBeGreaterThan(0)
  expect(h.watcher.health()).toStrictEqual({ state: 'recording' })

  h.state.settings = coerceSettings({
    ...h.state.settings,
    browserAuth: 'denied',
  })
  expect(h.watcher.health()).toStrictEqual({
    state: 'error',
    reason: 'automation-denied',
  })
  await h.span(1002, 1004)
  expect(h.asked).toHaveLength(askedWhileGranted)
  expect(h.healths.at(-1)).toStrictEqual({
    state: 'error',
    reason: 'automation-denied',
  })

  h.state.settings = coerceSettings({
    ...h.state.settings,
    browserAuth: 'granted',
  })
  expect(h.watcher.health()).toStrictEqual({ state: 'recording' })
})

test('consent that was never requested stays healthy', async () => {
  const h = keep(setup({ browserConsent: false, browserAuth: 'denied' }))
  expect(h.watcher.health()).toStrictEqual({ state: 'recording' })
})
