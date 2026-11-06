import { expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from './store.ts'

const workspace = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ody-store-'))
const fresh = () => {
  const dir = workspace()
  return { dir, store: openStore(path.join(dir, 'ody.db')) }
}
const shape = (e: {
  start: number
  end: number
  kind: string
  app: string | null
}) => [e.kind, e.app, e.start, e.end] as const

const sessionFile = (startedAt: number) => ({
  started_at: startedAt,
  ended_at: startedAt + 60,
  planned_duration: 60,
  paused_seconds: 0,
  status: 'ended',
  segments: [
    {
      started_at: startedAt,
      ended_at: startedAt + 40,
      kind: 'active',
      app_name: 'Obsidian',
      bundle_id: 'md.obsidian',
      domain: null,
    },
    {
      started_at: startedAt + 40,
      ended_at: startedAt + 60,
      kind: 'no_input',
      app_name: 'Obsidian',
      bundle_id: 'md.obsidian',
      domain: null,
    },
  ],
})

test('schema is version 1 with wal journaling', () => {
  const { store } = fresh()
  expect(store.meta('schema_version')).toBe('1')
  store.close()
})

test('heartbeat extends one event while kind, app, bundle and domain match', () => {
  const { store } = fresh()
  for (const at of [100, 101, 102, 103]) {
    store.heartbeat(
      { kind: 'active', app: 'Obsidian', bundle_id: 'md.obsidian' },
      at,
      2
    )
  }
  const events = store.eventsBetween(0, 1000)
  expect(events.map(shape)).toStrictEqual([['active', 'Obsidian', 100, 103]])
  expect(store.lastAlive()).toBe(103)
  store.close()
})

test('a gap wider than the pulse splits the event', () => {
  const { store } = fresh()
  const sample = { kind: 'active' as const, app: 'Obsidian' }
  store.heartbeat(sample, 100, 2)
  store.heartbeat(sample, 101, 2)
  store.heartbeat(sample, 105, 2)
  store.heartbeat(sample, 106, 2)
  expect(store.eventsBetween(0, 1000).map(shape)).toStrictEqual([
    ['active', 'Obsidian', 100, 101],
    ['active', 'Obsidian', 105, 106],
  ])
  store.close()
})

test('a change of app, domain or kind splits the event', () => {
  const { store } = fresh()
  store.heartbeat({ kind: 'active', app: 'Safari', domain: 'a.com' }, 10, 2)
  store.heartbeat({ kind: 'active', app: 'Safari', domain: 'a.com' }, 11, 2)
  store.heartbeat({ kind: 'active', app: 'Safari', domain: 'b.com' }, 12, 2)
  store.heartbeat({ kind: 'idle', app: 'Safari', domain: 'b.com' }, 13, 2)
  store.heartbeat({ kind: 'active', app: 'Obsidian' }, 14, 2)
  expect(
    store
      .eventsBetween(0, 100)
      .map(e => [e.kind, e.app, e.domain, e.start, e.end])
  ).toStrictEqual([
    ['active', 'Safari', 'a.com', 10, 11],
    ['active', 'Safari', 'b.com', 12, 12],
    ['idle', 'Safari', 'b.com', 13, 13],
    ['active', 'Obsidian', null, 14, 14],
  ])
  store.close()
})

test('boundary inserts one explicit event and eventsBetween clips to the range', () => {
  const { store } = fresh()
  store.boundary('away', 0, 100)
  store.heartbeat({ kind: 'active', app: 'Obsidian' }, 100, 2)
  store.heartbeat({ kind: 'active', app: 'Obsidian' }, 160, 120)
  expect(store.eventsBetween(10, 20).map(shape)).toStrictEqual([
    ['away', null, 10, 20],
  ])
  expect(store.eventsBetween(90, 140).map(shape)).toStrictEqual([
    ['away', null, 90, 100],
    ['active', 'Obsidian', 100, 140],
  ])
  store.close()
})

test('totalsBetween groups active time by app then domain and clips the range', () => {
  const { store } = fresh()
  store.boundary('away', 0, 10)
  const put = (app: string, domain: string | null, a: number, b: number) => {
    store.heartbeat({ kind: 'active', app, bundle_id: app, domain }, a, 0)
    store.heartbeat({ kind: 'active', app, bundle_id: app, domain }, b, b - a)
  }
  put('Safari', 'a.com', 10, 40)
  put('Safari', 'b.com', 40, 50)
  put('Obsidian', null, 50, 70)
  store.heartbeat(
    { kind: 'idle', app: 'Obsidian', bundle_id: 'Obsidian' },
    70,
    0
  )
  store.heartbeat(
    { kind: 'idle', app: 'Obsidian', bundle_id: 'Obsidian' },
    100,
    30
  )
  const all = store.totalsBetween(0, 1000)
  expect(all.map(a => [a.app, a.seconds])).toStrictEqual([
    ['Safari', 40],
    ['Obsidian', 20],
  ])
  expect(all[0].sites).toStrictEqual([
    { domain: 'a.com', seconds: 30 },
    { domain: 'b.com', seconds: 10 },
  ])
  const window = store.totalsBetween(20, 45)
  expect(window.map(a => [a.app, a.seconds])).toStrictEqual([['Safari', 25]])
  store.close()
})

test('sessions are upserted and queried by range', () => {
  const { store } = fresh()
  store.upsertSession({
    id: 's1',
    started_at: 100,
    ended_at: 200,
    planned: 1500,
    paused_seconds: 10,
    overtime_seconds: 0,
    status: 'stopped',
    kind: 'focus',
  })
  store.upsertSession({
    id: 's1',
    started_at: 100,
    ended_at: 260,
    planned: 1500,
    paused_seconds: 10,
    overtime_seconds: 60,
    status: 'completed',
    kind: 'focus',
  })
  store.upsertSession({
    id: 's2',
    started_at: 5000,
    ended_at: 5300,
    planned: 300,
    paused_seconds: 0,
    overtime_seconds: 0,
    status: 'completed',
    kind: 'break',
  })
  expect(store.sessionsBetween(0, 1000)).toStrictEqual([
    {
      id: 's1',
      started_at: 100,
      ended_at: 260,
      planned: 1500,
      paused_seconds: 10,
      overtime_seconds: 60,
      status: 'completed',
      kind: 'focus',
    },
  ])
  expect(store.sessionsBetween(0, 10000).map(s => s.kind)).toStrictEqual([
    'focus',
    'break',
  ])
  store.close()
})

test('json import is idempotent, maps no_input to idle and skips corrupt files', () => {
  const { dir, store } = fresh()
  const sessions = path.join(dir, 'sessions')
  fs.mkdirSync(sessions)
  fs.writeFileSync(
    path.join(sessions, '2026-11-01T09-00-00-000Z.json'),
    JSON.stringify(sessionFile(1000))
  )
  fs.writeFileSync(
    path.join(sessions, '2026-11-02T09-00-00-000Z.json'),
    JSON.stringify(sessionFile(5000))
  )
  fs.writeFileSync(
    path.join(sessions, '2026-11-03T09-00-00-000Z.json'),
    '{ not json'
  )

  const first = store.importJson(sessions)
  expect(first.already).toBe(false)
  expect(first.sessions).toBe(2)
  expect(first.events).toBe(4)
  expect(first.skipped).toStrictEqual(['2026-11-03T09-00-00-000Z.json'])
  expect(store.meta('imported_json')).toBe('1')
  expect(store.eventsBetween(0, 10000).map(e => e.kind)).toStrictEqual([
    'active',
    'idle',
    'active',
    'idle',
  ])
  expect(store.sessionsBetween(0, 10000).map(s => s.id)).toStrictEqual([
    '2026-11-01T09-00-00-000Z',
    '2026-11-02T09-00-00-000Z',
  ])

  const second = store.importJson(sessions)
  expect(second.already).toBe(true)
  expect(second.events).toBe(0)
  expect(store.eventsBetween(0, 10000)).toHaveLength(4)
  expect(fs.readdirSync(sessions)).toHaveLength(3)
  store.close()
})

test('an import of a missing directory still completes', () => {
  const { dir, store } = fresh()
  const report = store.importJson(path.join(dir, 'sessions'))
  expect(report).toStrictEqual({
    already: false,
    sessions: 0,
    events: 0,
    skipped: [],
  })
  expect(store.meta('imported_json')).toBe('1')
  store.close()
})

test('a crash gap after last_alive is stored as away on the next launch', () => {
  const { dir, store } = fresh()
  const file = path.join(dir, 'ody.db')
  store.heartbeat({ kind: 'active', app: 'Obsidian' }, 50, 2)
  store.close()

  const reopened = openStore(file)
  expect(reopened.lastAlive()).toBe(50)
  expect(reopened.closeCrashGap(400, 2)).toStrictEqual({ start: 50, end: 400 })
  expect(reopened.eventsBetween(0, 1000).map(shape)).toStrictEqual([
    ['active', 'Obsidian', 50, 50],
    ['away', null, 50, 400],
  ])
  expect(reopened.closeCrashGap(401, 2)).toBe(null)
  reopened.close()
})

const DAY = 86400
const BASE = 1_762_000_000

const medianReadMs = (read: () => unknown[], runs: number) => {
  read()
  const samples: number[] = []
  for (let run = 0; run < runs; run++) {
    const started = performance.now()
    read()
    samples.push(performance.now() - started)
  }
  samples.sort((x, y) => x - y)
  return samples[Math.floor(samples.length / 2)]
}

test('a 24 h range of a recorded day is read in well under 50 ms', () => {
  const { store } = fresh()
  const apps = ['Obsidian', 'Safari', 'Terminal', 'Slack', 'Figma']
  store.transact(() => {
    let at = BASE
    let n = 0
    while (at < BASE + DAY) {
      const app = apps[n % apps.length]
      const span = 20 + (n % 180)
      for (let t = at; t < Math.min(at + span, BASE + DAY); t++) {
        store.heartbeat(
          { kind: 'active', app, bundle_id: 'com.example.' + app },
          t,
          2
        )
      }
      at += span
      n++
    }
  })
  const events = store.eventsBetween(BASE, BASE + DAY)
  const median = medianReadMs(() => store.eventsBetween(BASE, BASE + DAY), 9)
  console.log(
    `eventsBetween, merged day: ${events.length} events, median ${median.toFixed(1)} ms`
  )
  expect(events.length).toBeGreaterThan(500)
  expect(events.at(-1)?.end).toBe(BASE + DAY - 1)
  expect(median).toBeLessThan(50)
  store.close()
})

test('the 86400 event worst case is read back in full and in order', () => {
  const { store } = fresh()
  store.transact(() => {
    for (let i = 0; i < DAY; i++) {
      store.heartbeat(
        { kind: 'active', app: i % 2 === 0 ? 'Obsidian' : 'Safari' },
        BASE + i,
        2
      )
    }
  })
  const events = store.eventsBetween(BASE, BASE + DAY)
  expect(events).toHaveLength(DAY)
  expect(events[0]).toStrictEqual({
    id: 1,
    start: BASE,
    end: BASE,
    kind: 'active',
    app: 'Obsidian',
    bundle_id: null,
    domain: null,
  })
  expect(events.at(-1)).toStrictEqual({
    id: DAY,
    start: BASE + DAY - 1,
    end: BASE + DAY - 1,
    kind: 'active',
    app: 'Safari',
    bundle_id: null,
    domain: null,
  })
  expect(events.every((e, i) => e.start === BASE + i)).toBe(true)
  store.close()
})
