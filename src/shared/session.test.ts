import { expect, test } from 'vitest'
import * as S from './session.ts'
import type { Sampled, Session } from './session.ts'

interface Doc {
  status?: string
  started_at: number
  ended_at: number | null
  paused_seconds: number
  segments: S.Segment[]
}

const ok = (value: unknown, message?: string) => {
  expect(value, message).toBeTruthy()
}
const eq = <T>(actual: T, expected: T, message?: string) => {
  expect(actual, message).toStrictEqual(expected)
}

function validate(d: Doc) {
  let prev = d.started_at,
    gaps = 0,
    sum = 0
  for (const g of d.segments) {
    ok(g.ended_at > g.started_at, 'empty segment')
    ok(g.started_at >= prev, 'overlap or disorder')
    gaps += g.started_at - prev
    prev = g.ended_at
    sum += g.ended_at - g.started_at
    ok(!g.domain || !/[/:]/.test(g.domain), 'domain must be a bare host')
  }
  eq(gaps, d.paused_seconds, 'gaps != paused_seconds')
  if (d.ended_at !== null) {
    eq(prev, d.ended_at, 'last segment must close at ended_at')
    eq(
      sum,
      d.ended_at - d.started_at - d.paused_seconds,
      'total != session - paused'
    )
  }
  return sum
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
  eq(S.config({}), { planned: 1500, idle: 180 })
  eq(S.config({ ODY_SESSION_SECONDS: '20.9', ODY_IDLE_SECONDS: '5' }), {
    planned: 20,
    idle: 5,
  })
  for (const bad of ['', '0', '-3', 'abc', '0.5', 'Infinity']) {
    eq(S.config({ ODY_SESSION_SECONDS: bad }).planned, 1500, bad)
  }
})

test('fractional inputs, natural finish, pause gaps, monotonic now', () => {
  const s = mk(100, 30, 1000.9)
  eq(s.start, 1000)
  S.sample(s, 1000.2, gen(s), A)
  run(s, 1001, 1040)
  S.pause(s, 1040.9)
  S.tick(s, 1030, 0)
  eq(s.lastNow, 1040)
  S.unpause(s, 1070.1)
  eq(s.pausedSeconds, 30)
  run(s, 1071, 1300)
  ok(s.ended)
  eq(s.endedAt, 1000 + 100 + 30)
  const d = S.doc(s)
  eq(validate(d), 100)
  eq(d.paused_seconds, 30)
  ok(S.takeAlert(s) && !S.takeAlert(s))
})

test('handlers do nothing after the end', () => {
  const s = mk(10)
  run(s, 1001, 1010)
  ok(s.ended)
  const g = s.gen
  S.pause(s, 1020)
  S.unpause(s, 1021)
  ok(!S.sample(s, 1022, g, B))
  eq(S.doc(s).segments.length, 1)
})

test('completion driven through wake: sleep across due, alert waits for wake', () => {
  const s = mk(60)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1020)
  S.suspend(s, 1020.5)
  S.tick(s, 1500)
  ok(s.ended && s.endedAt === 1060 && !S.takeAlert(s))
  S.wake(s, 1501)
  ok(S.takeAlert(s))
  const d = S.doc(s)
  eq(validate(d), 60)
  eq(
    d.segments.map(g => g.kind),
    ['active', 'away']
  )
  eq(d.segments[1].started_at, 1020)
  eq(S.totals(d.segments).away, 40)
})

test('completion while locked waits for unlock; asleep+locked needs both to clear', () => {
  const s = mk(60)
  run(s, 1001, 1010)
  S.lock(s, 1010)
  S.suspend(s, 1015)
  S.wake(s, 1100)
  ok(s.ended && !S.takeAlert(s))
  S.unlock(s, 1101)
  ok(S.takeAlert(s))
  eq(validate(S.doc(s)), 60)
})

test('awake + completion during no input alerts at due', () => {
  const s = mk(100, 30)
  S.sample(s, 1000, gen(s), A)
  for (let t = 1001; t <= 1100; t++) {
    S.tick(s, t, Math.max(0, t - 1040))
  }
  ok(s.ended && S.takeAlert(s))
  const d = S.doc(s)
  validate(d)
  eq(
    d.segments.map(g => g.kind),
    ['active', 'no_input']
  )
})

test('retroactive no input across segments: keeps the app at last input; B clamps it', () => {
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
  eq(
    segs.map(g => [g.kind, g.started_at, g.ended_at]),
    [
      ['active', 1000, 1010],
      ['no_input', 1010, 1100],
    ] as (string | number)[][]
  )
  const ni = segs.filter(g => g.kind === 'no_input')
  eq(ni.length, 1)
  eq(ni[0].started_at, 1010)
  eq(ni[0].ended_at, 1100)
  eq(ni[0].app_name, 'Obsidian')
  for (let t = 1101; t <= 1110; t++) {
    S.tick(s, t, t < 1105 ? t - 1010 : t - 1105)
  }
  segs = S.doc(s).segments
  validate(S.doc(s))
  eq(segs[segs.length - 1].kind, 'active')
  eq(segs[segs.length - 1].started_at, 1105)
  S.pause(s, 1111)
  S.unpause(s, 1200)
  for (let t = 1201; t <= 1260; t++) {
    S.tick(s, t, 9999)
  }
  segs = S.doc(s).segments
  validate(S.doc(s))
  eq(segs.filter(g => g.kind === 'no_input').pop()?.started_at, 1200)
})

test('pause during no input closes it; resume starts active again', () => {
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
  eq(
    d.segments.map(g => g.kind),
    ['active', 'no_input', 'active']
  )
  eq(d.paused_seconds, 49)
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
  eq(
    d.segments.map(g => [g.kind, g.started_at, g.ended_at]),
    [
      ['active', 1000, 1010],
      ['away', 1010, 1060],
      ['active', 1060, 1065],
    ] as (string | number)[][]
  )
})

test('stale sample is dropped after any transition', () => {
  const s = mk(1000)
  S.sample(s, 1000, gen(s), A)
  const g = gen(s)
  S.pause(s, 1005)
  S.unpause(s, 1006)
  ok(!S.sample(s, 1007, g, B))
  eq(s.last?.app, 'Obsidian')
  const g2 = gen(s)
  S.lock(s, 1008)
  ok(!S.sample(s, 1009, g2, B))
  ok(!S.canSample(s))
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
  eq(
    t.apps.map(a => [a.app, a.seconds]),
    [
      ['Aside', 20],
      ['Obsidian', 5],
    ] as (string | number | null)[][]
  )
  eq(t.apps[0].sites, [{ domain: 'a.com', seconds: 15 }])
  eq(t.no_input, 15)
  eq(t.away, 7)
})

test('stop while running closes at the last whole second', () => {
  const s = mk(100)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1010)
  const g = s.gen
  S.stop(s, 1012.5)
  eq(s.stopped, true)
  eq(s.ended, true)
  eq(s.endedAt, 1012)
  eq(s.pausedAt, null)
  eq(s.alert, null)
  eq(s.gen, g + 1)
  eq(S.takeAlert(s), false)
  eq(validate(S.doc(s)), 12)
})

test('stop while paused closes at the pause and ignores the trailing pause', () => {
  const s = mk(100)
  S.sample(s, 1000, gen(s), A)
  run(s, 1001, 1010)
  S.pause(s, 1010)
  S.tick(s, 1040, 0)
  S.stop(s, 1050)
  eq(s.endedAt, 1010)
  eq(s.pausedAt, null)
  eq(s.pausedSeconds, 0)
  eq(validate(S.doc(s)), 10)
})

test('stop after an earlier pause keeps that gap only', () => {
  const s = mk(100)
  run(s, 1001, 1010)
  S.pause(s, 1010)
  S.unpause(s, 1020)
  run(s, 1021, 1025)
  S.pause(s, 1025)
  S.stop(s, 1030)
  eq(s.endedAt, 1025)
  eq(s.pausedSeconds, 10)
  eq(validate(S.doc(s)), 15)
})

test('stop with no recorded second leaves no segments', () => {
  const s = mk(100)
  S.stop(s, 1000.5)
  eq(s.stopped, true)
  eq(s.endedAt, 1000)
  eq(S.doc(s).segments, [])
  eq(validate(S.doc(s)), 0)
})

test('stop after a natural end changes nothing', () => {
  const s = mk(100)
  run(s, 1001, 1100)
  eq(s.endedAt, 1100)
  const g = s.gen
  S.stop(s, 1200)
  eq(s.stopped, false)
  eq(s.endedAt, 1100)
  eq(s.alert, 'pending')
  eq(s.gen, g)
  eq(validate(S.doc(s)), 100)
})

test('stop past due stays a natural end with a pending alert', () => {
  const s = mk(100)
  run(s, 1001, 1050)
  S.stop(s, 1200)
  eq(s.ended, true)
  eq(s.stopped, false)
  eq(s.endedAt, 1100)
  eq(s.alert, 'pending')
  eq(validate(S.doc(s)), 100)
})

test('stop right after a resume drops the unclosed trailing pause', () => {
  const s = mk(100)
  run(s, 1001, 1003)
  S.pause(s, 1003)
  S.unpause(s, 1004)
  S.stop(s, 1004.5)
  eq(s.endedAt, 1003)
  eq(s.pausedSeconds, 0)
  eq(validate(S.doc(s)), 3)
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
  eq(s.endedAt, 1003)
  eq(s.pausedSeconds, 1)
  eq(validate(S.doc(s)), 2)
})

test('pause, resume, stop inside one second leaves an empty session', () => {
  const s = mk(100)
  S.pause(s, 1000.2)
  S.unpause(s, 1000.4)
  S.pause(s, 1000.6)
  S.stop(s, 1000.8)
  eq(s.endedAt, 1000)
  eq(s.pausedSeconds, 0)
  eq(S.doc(s).segments, [])
  eq(validate(S.doc(s)), 0)
})

test('resume across seconds with nothing recorded, then stop, is empty', () => {
  const s = mk(100)
  S.pause(s, 1000.2)
  S.unpause(s, 1005.4)
  S.stop(s, 1005.6)
  eq(s.endedAt, 1000)
  eq(s.pausedSeconds, 0)
  eq(S.doc(s).segments, [])
  eq(validate(S.doc(s)), 0)
})
