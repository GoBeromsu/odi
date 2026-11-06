import assert from 'node:assert'
import fs from 'node:fs'
import { test } from 'node:test'
import * as S from './session.ts'
import type { Sampled, Session } from './session.ts'

interface Doc {
  status?: string
  started_at: number
  ended_at: number | null
  paused_seconds: number
  segments: S.Segment[]
}

function validate(d: Doc) {
  let prev = d.started_at,
    gaps = 0,
    sum = 0
  for (const g of d.segments) {
    assert(g.ended_at > g.started_at, 'empty segment')
    assert(g.started_at >= prev, 'overlap or disorder')
    gaps += g.started_at - prev
    prev = g.ended_at
    sum += g.ended_at - g.started_at
    assert(!g.domain || !/[/:]/.test(g.domain), 'domain must be a bare host')
  }
  assert.strictEqual(gaps, d.paused_seconds, 'gaps != paused_seconds')
  if (d.ended_at !== null) {
    assert.strictEqual(prev, d.ended_at, 'last segment must close at ended_at')
    assert.strictEqual(
      sum,
      d.ended_at - d.started_at - d.paused_seconds,
      'total != session - paused'
    )
  }
  return sum
}

if (process.argv[2]) {
  const text = fs.readFileSync(process.argv[2], 'utf8')
  assert(!/https?:\/\//.test(text), 'full URL found in file')
  const d = JSON.parse(text)
  console.log(
    'ok',
    d.status,
    'segments',
    d.segments.length,
    'total',
    validate(d),
    's'
  )
  process.exit(0)
}

const A: Sampled = { app: 'Obsidian', bundle_id: 'md.obsidian', domain: null }
const B: Sampled = {
  app: 'Aside',
  bundle_id: 'at.studio.AsideBrowser',
  domain: 'a.com',
}
const C: Sampled = {
  app: 'Aside',
  bundle_id: 'at.studio.AsideBrowser',
  domain: 'b.com',
}
const mk = (planned = 100, idle = 30, t = 1000) => S.create(t, planned, idle)
const run = (s: Session, from: number, to: number, idle = 0) => {
  for (let t = from; t <= to; t++) {
    S.tick(s, t, idle)
  }
}
const gen = (s: Session) => s.gen
test('config reads positive whole seconds and falls back otherwise', () => {
  assert.deepStrictEqual(S.config({}), { planned: 1500, idle: 180 })
  assert.deepStrictEqual(
    S.config({ ODY_SESSION_SECONDS: '20.9', ODY_IDLE_SECONDS: '5' }),
    { planned: 20, idle: 5 }
  )
  for (const bad of ['', '0', '-3', 'abc', '0.5', 'Infinity']) {
    assert.strictEqual(
      S.config({ ODY_SESSION_SECONDS: bad }).planned,
      1500,
      bad
    )
  }
})

test('fractional inputs, natural finish, pause gaps, monotonic now', () => {
  const s = mk(100, 30, 1000.9)
  assert.strictEqual(s.start, 1000)
  S.sample(s, 1000.2, gen(s), A)
  run(s, 1001, 1040)
  S.pause(s, 1040.9)
  S.tick(s, 1030, 0)
  assert.strictEqual(s.lastNow, 1040)
  S.unpause(s, 1070.1)
  assert.strictEqual(s.pausedSeconds, 30)
  run(s, 1071, 1300)
  assert(s.ended)
  assert.strictEqual(s.endedAt, 1000 + 100 + 30)
  const d = S.doc(s)
  assert.strictEqual(validate(d), 100)
  assert.strictEqual(d.paused_seconds, 30)
  assert(S.takeAlert(s) && !S.takeAlert(s))
})

test('handlers do nothing after the end', () => {
  const s = mk(10)
  run(s, 1001, 1010)
  assert(s.ended)
  const g = s.gen
  S.pause(s, 1020)
  S.unpause(s, 1021)
  assert(!S.sample(s, 1022, g, B))
  assert.strictEqual(S.doc(s).segments.length, 1)
})

test('completion driven through wake: sleep across due, alert waits for wake', () => {
  const s = mk(60)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1020)
  S.suspend(s, 1020.5)
  S.tick(s, 1500)
  assert(s.ended && s.endedAt === 1060 && !S.takeAlert(s))
  S.wake(s, 1501)
  assert(S.takeAlert(s))
  const d = S.doc(s)
  assert.strictEqual(validate(d), 60)
  assert.deepStrictEqual(
    d.segments.map(g => g.kind),
    ['active', 'away']
  )
  assert.strictEqual(d.segments[1].started_at, 1020)
  assert.strictEqual(S.totals(d.segments).away, 40)
})

test('completion while locked waits for unlock; asleep+locked needs both to clear', () => {
  const s = mk(60)
  run(s, 1001, 1010)
  S.lock(s, 1010)
  S.suspend(s, 1015)
  S.wake(s, 1100)
  assert(s.ended && !S.takeAlert(s))
  S.unlock(s, 1101)
  assert(S.takeAlert(s))
  assert.strictEqual(validate(S.doc(s)), 60)
})

test('awake + completion during 입력 없음 alerts at due', () => {
  const s = mk(100, 30)
  S.sample(s, 1000, gen(s), A)
  for (let t = 1001; t <= 1100; t++) {
    S.tick(s, t, Math.max(0, t - 1040))
  }
  assert(s.ended && S.takeAlert(s))
  const d = S.doc(s)
  validate(d)
  assert.deepStrictEqual(
    d.segments.map(g => g.kind),
    ['active', 'no_input']
  )
})

test('retroactive 입력 없음 across segments: keeps the app at last input; B clamps it', () => {
  const s = mk(1000, 30)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1019)
  S.sample(s, 1020, gen(s), B)
  run(s, 1020, 1030)
  S.sample(s, 1031, gen(s), C)
  run(s, 1031, 1049)
  for (let t = 1050; t <= 1100; t++) {
    S.tick(s, t, t - 1010)
  }
  let segs = S.doc(s).segments
  validate(S.doc(s))
  assert.deepStrictEqual(
    segs.map(g => [g.kind, g.started_at, g.ended_at]),
    [
      ['active', 1000, 1010],
      ['no_input', 1010, 1100],
    ]
  )
  const ni = segs.filter(g => g.kind === 'no_input')
  assert.strictEqual(ni.length, 1)
  assert.strictEqual(ni[0].started_at, 1010)
  assert.strictEqual(ni[0].ended_at, 1100)
  assert.strictEqual(ni[0].app_name, 'Obsidian')
  for (let t = 1101; t <= 1110; t++) {
    S.tick(s, t, t < 1105 ? t - 1010 : t - 1105)
  }
  segs = S.doc(s).segments
  validate(S.doc(s))
  assert.strictEqual(segs[segs.length - 1].kind, 'active')
  assert.strictEqual(segs[segs.length - 1].started_at, 1105)
  S.pause(s, 1111)
  S.unpause(s, 1200)
  for (let t = 1201; t <= 1260; t++) {
    S.tick(s, t, 9999)
  }
  segs = S.doc(s).segments
  validate(S.doc(s))
  assert.strictEqual(
    segs.filter(g => g.kind === 'no_input').pop()?.started_at,
    1200
  )
})

test('Pause during 입력 없음 closes it; resume starts active again', () => {
  const s = mk(1000, 30)
  S.sample(s, 1000, gen(s), A)
  for (let t = 1001; t <= 1050; t++) {
    S.tick(s, t, Math.max(0, t - 1010))
  }
  S.pause(s, 1051)
  S.unpause(s, 1100)
  for (let t = 1101; t <= 1105; t++) {
    S.tick(s, t, 0)
  }
  const d = S.doc(s)
  validate(d)
  assert.deepStrictEqual(
    d.segments.map(g => g.kind),
    ['active', 'no_input', 'active']
  )
  assert.strictEqual(d.paused_seconds, 49)
})

test('away ends at t: B = t, resumes active from the last sample; idle does not reach back into away', () => {
  const s = mk(1000, 30)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1010)
  S.lock(s, 1010)
  run(s, 1011, 1060)
  S.unlock(s, 1060)
  for (let t = 1061; t <= 1065; t++) {
    S.tick(s, t, 9999)
  }
  const d = S.doc(s)
  validate(d)
  assert.deepStrictEqual(
    d.segments.map(g => [g.kind, g.started_at, g.ended_at]),
    [
      ['active', 1000, 1010],
      ['away', 1010, 1060],
      ['active', 1060, 1065],
    ]
  )
})

test('stale sample is dropped after any transition', () => {
  const s = mk(1000)
  S.sample(s, 1000, gen(s), A)
  const g = gen(s)
  S.pause(s, 1005)
  S.unpause(s, 1006)
  assert(!S.sample(s, 1007, g, B))
  assert.strictEqual(s.last?.app, 'Obsidian')
  const g2 = gen(s)
  S.lock(s, 1008)
  assert(!S.sample(s, 1009, g2, B))
  assert(!S.canSample(s))
})

test('totals: sites nest under the browser; no_input and away excluded', () => {
  const segs: S.Segment[] = [
    {
      started_at: 0,
      ended_at: 10,
      kind: 'active',
      app_name: 'Aside',
      bundle_id: 'x',
      domain: 'a.com',
    },
    {
      started_at: 10,
      ended_at: 15,
      kind: 'active',
      app_name: 'Aside',
      bundle_id: 'x',
      domain: null,
    },
    {
      started_at: 15,
      ended_at: 20,
      kind: 'active',
      app_name: 'Aside',
      bundle_id: 'x',
      domain: 'a.com',
    },
    {
      started_at: 20,
      ended_at: 25,
      kind: 'active',
      app_name: 'Obsidian',
      bundle_id: 'o',
      domain: null,
    },
    {
      started_at: 25,
      ended_at: 40,
      kind: 'no_input',
      app_name: 'Obsidian',
      bundle_id: 'o',
      domain: null,
    },
    {
      started_at: 40,
      ended_at: 47,
      kind: 'away',
      app_name: null,
      bundle_id: null,
      domain: null,
    },
  ]
  const t = S.totals(segs)
  assert.deepStrictEqual(
    t.apps.map(a => [a.app, a.seconds]),
    [
      ['Aside', 20],
      ['Obsidian', 5],
    ]
  )
  assert.deepStrictEqual(t.apps[0].sites, [{ domain: 'a.com', seconds: 15 }])
  assert.strictEqual(t.no_input, 15)
  assert.strictEqual(t.away, 7)
})

test('stop while running closes at the last whole second', () => {
  const s = mk(100)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1010)
  const g = s.gen
  S.stop(s, 1012.5)
  assert.strictEqual(s.stopped, true)
  assert.strictEqual(s.ended, true)
  assert.strictEqual(s.endedAt, 1012)
  assert.strictEqual(s.pausedAt, null)
  assert.strictEqual(s.alert, null)
  assert.strictEqual(s.gen, g + 1)
  assert.strictEqual(S.takeAlert(s), false)
  assert.strictEqual(validate(S.doc(s)), 12)
})

test('stop while paused closes at the pause and ignores the trailing pause', () => {
  const s = mk(100)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1010)
  S.pause(s, 1010)
  S.tick(s, 1040, 0)
  S.stop(s, 1050)
  assert.strictEqual(s.endedAt, 1010)
  assert.strictEqual(s.pausedAt, null)
  assert.strictEqual(s.pausedSeconds, 0)
  assert.strictEqual(validate(S.doc(s)), 10)
})

test('stop after an earlier pause keeps that gap only', () => {
  const s = mk(100)
  run(s, 1001, 1010)
  S.pause(s, 1010)
  S.unpause(s, 1020)
  run(s, 1021, 1025)
  S.pause(s, 1025)
  S.stop(s, 1030)
  assert.strictEqual(s.endedAt, 1025)
  assert.strictEqual(s.pausedSeconds, 10)
  assert.strictEqual(validate(S.doc(s)), 15)
})

test('stop with no recorded second leaves no segments', () => {
  const s = mk(100)
  S.stop(s, 1000.5)
  assert.strictEqual(s.stopped, true)
  assert.strictEqual(s.endedAt, 1000)
  assert.deepStrictEqual(S.doc(s).segments, [])
  assert.strictEqual(validate(S.doc(s)), 0)
})

test('stop after a natural end changes nothing', () => {
  const s = mk(100)
  run(s, 1001, 1100)
  assert.strictEqual(s.endedAt, 1100)
  const g = s.gen
  S.stop(s, 1200)
  assert.strictEqual(s.stopped, false)
  assert.strictEqual(s.endedAt, 1100)
  assert.strictEqual(s.alert, 'pending')
  assert.strictEqual(s.gen, g)
  assert.strictEqual(validate(S.doc(s)), 100)
})

test('stop past due stays a natural end with a pending alert', () => {
  const s = mk(100)
  run(s, 1001, 1050)
  S.stop(s, 1200)
  assert.strictEqual(s.ended, true)
  assert.strictEqual(s.stopped, false)
  assert.strictEqual(s.endedAt, 1100)
  assert.strictEqual(s.alert, 'pending')
  assert.strictEqual(validate(S.doc(s)), 100)
})

test('stop right after a resume drops the unclosed trailing pause', () => {
  const s = mk(100)
  run(s, 1001, 1003)
  S.pause(s, 1003)
  S.unpause(s, 1004)
  S.stop(s, 1004.5)
  assert.strictEqual(s.endedAt, 1003)
  assert.strictEqual(s.pausedSeconds, 0)
  assert.strictEqual(validate(S.doc(s)), 3)
})

test('sub-second pause cycles before stop keep gaps equal to pauses', () => {
  const s = mk(1500)
  S.pause(s, 1000.1)
  S.unpause(s, 1000.4)
  S.pause(s, 1000.7)
  S.unpause(s, 1001.0)
  S.sample(s, 1001.3, gen(s), A)
  S.tick(s, 1002.1)
  S.pause(s, 1003.1)
  S.unpause(s, 1003.5)
  S.pause(s, 1003.8)
  S.unpause(s, 1004.2)
  S.pause(s, 1004.5)
  S.stop(s, 1004.8)
  assert.strictEqual(s.endedAt, 1003)
  assert.strictEqual(s.pausedSeconds, 1)
  assert.strictEqual(validate(S.doc(s)), 2)
})

test('pause, resume, stop inside one second leaves an empty session', () => {
  const s = mk(100)
  S.pause(s, 1000.2)
  S.unpause(s, 1000.4)
  S.pause(s, 1000.6)
  S.stop(s, 1000.8)
  assert.strictEqual(s.endedAt, 1000)
  assert.strictEqual(s.pausedSeconds, 0)
  assert.deepStrictEqual(S.doc(s).segments, [])
  assert.strictEqual(validate(S.doc(s)), 0)
})

test('resume across seconds with nothing recorded, then stop, is empty', () => {
  const s = mk(100)
  S.pause(s, 1000.2)
  S.unpause(s, 1005.4)
  S.stop(s, 1005.6)
  assert.strictEqual(s.endedAt, 1000)
  assert.strictEqual(s.pausedSeconds, 0)
  assert.deepStrictEqual(S.doc(s).segments, [])
  assert.strictEqual(validate(S.doc(s)), 0)
})
