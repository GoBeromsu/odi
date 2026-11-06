'use strict'

const num = (v, d) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : d
}
const config = env => ({
  planned: num(env.ODY_SESSION_SECONDS, 1500),
  idle: num(env.ODY_IDLE_SECONDS, 180),
})

const UNKNOWN = { app: '알 수 없음', bundle_id: null, domain: null }
const NONE = { app: null, bundle_id: null, domain: null }
const away = s => s.asleep || s.locked
const due = s =>
  s.start +
  s.planned +
  s.pausedSeconds +
  (s.pausedAt === null ? 0 : s.lastNow - s.pausedAt)
const remaining = s => due(s) - s.lastNow

function create(now, planned, idle) {
  const t = Math.floor(now)
  return {
    planned,
    idle,
    start: t,
    lastNow: t,
    cursor: t,
    B: t,
    pausedSeconds: 0,
    pausedAt: null,
    asleep: false,
    locked: false,
    noInput: null,
    last: null,
    labels: [],
    gen: 0,
    ended: false,
    stopped: false,
    endedAt: null,
    alert: null,
  }
}

function label(s) {
  if (away(s)) return { kind: 'away', ...NONE }
  if (s.noInput) return { kind: 'no_input', ...s.noInput }
  return { kind: 'active', ...(s.last || UNKNOWN) }
}

function paint(s, from, to, l) {
  for (let t = from; t < to; t++)
    if (s.labels[t - s.start]) s.labels[t - s.start] = l
}
function advance(s, now, idle) {
  s.lastNow = Math.max(Math.floor(now), s.lastNow)
  if (s.ended || s.pausedAt !== null) return
  const d = due(s)
  const upTo = Math.min(s.lastNow, d)
  for (let t = s.cursor; t < upTo; t++) s.labels[t - s.start] = label(s)
  s.cursor = Math.max(s.cursor, upTo)
  if (idle !== undefined && !away(s)) {
    const li = Math.max(s.lastNow - Math.floor(idle), s.B)
    if (!s.noInput && s.lastNow - li >= s.idle) {
      const ref = s.labels[li - s.start] || s.last || UNKNOWN
      s.noInput = { app: ref.app, bundle_id: ref.bundle_id, domain: ref.domain }
      paint(s, li, s.cursor, { kind: 'no_input', ...s.noInput })
    } else if (s.noInput && s.lastNow - li < s.idle) {
      s.noInput = null
      paint(s, li, s.cursor, label(s))
    }
  }
  if (s.lastNow >= d) {
    s.ended = true
    s.endedAt = d
    s.gen++
    s.alert = away(s) ? 'held' : 'pending'
  }
}

const tick = advance

function pause(s, now) {
  advance(s, now)
  if (s.ended || s.pausedAt !== null) return
  s.pausedAt = s.lastNow
  s.gen++
}

function unpause(s, now) {
  advance(s, now)
  if (s.ended || s.pausedAt === null) return
  s.pausedSeconds += s.lastNow - s.pausedAt
  s.pausedAt = null
  s.cursor = s.B = s.lastNow
  s.noInput = null
  s.gen++
}

function stop(s, now) {
  advance(s, now)
  if (s.ended) return
  const last = s.start + s.labels.length
  s.pausedSeconds -= s.cursor - last
  s.ended = true
  s.stopped = true
  s.endedAt = last
  s.pausedAt = null
  s.alert = null
  s.gen++
}

function setAway(s, now, key, val) {
  advance(s, now)
  const was = away(s)
  s[key] = val
  if (was === away(s)) return
  s.gen++
  if (!away(s)) {
    s.B = s.lastNow
    s.noInput = null
    if (s.ended && s.alert === 'held') s.alert = 'pending'
  }
}
const suspend = (s, now) => setAway(s, now, 'asleep', true)
const wake = (s, now) => setAway(s, now, 'asleep', false)
const lock = (s, now) => setAway(s, now, 'locked', true)
const unlock = (s, now) => setAway(s, now, 'locked', false)
function sample(s, now, gen, r) {
  advance(s, now)
  if (s.ended || gen !== s.gen) return false
  s.last = {
    app: r.app,
    bundle_id: r.bundle_id || null,
    domain: r.domain || null,
  }
  return true
}

const canSample = s => !s.ended && s.pausedAt === null && !away(s)
const takeAlert = s => {
  const a = s.ended && s.alert === 'pending'
  if (a) s.alert = null
  return a
}
function segments(s) {
  const out = []
  s.labels.forEach((l, i) => {
    const t = s.start + i,
      p = out[out.length - 1]
    if (
      p &&
      p.ended_at === t &&
      p.kind === l.kind &&
      p.app_name === l.app &&
      p.bundle_id === l.bundle_id &&
      p.domain === l.domain
    )
      p.ended_at = t + 1
    else
      out.push({
        started_at: t,
        ended_at: t + 1,
        kind: l.kind,
        app_name: l.app,
        bundle_id: l.bundle_id,
        domain: l.domain,
      })
  })
  return out
}
function totals(segs) {
  const apps = new Map(),
    r = { apps: [], no_input: 0, away: 0 }
  for (const g of segs) {
    const d = g.ended_at - g.started_at
    if (g.kind !== 'active') {
      r[g.kind] += d
      continue
    }
    const k = g.bundle_id || g.app_name
    const a = apps.get(k) || {
      app: g.app_name,
      bundle_id: g.bundle_id,
      seconds: 0,
      sites: new Map(),
    }
    a.seconds += d
    apps.set(k, a)
    if (g.domain) a.sites.set(g.domain, (a.sites.get(g.domain) || 0) + d)
  }
  const desc = (a, b) => b.seconds - a.seconds
  r.apps = [...apps.values()]
    .map(a => ({
      ...a,
      sites: [...a.sites]
        .map(([domain, seconds]) => ({ domain, seconds }))
        .sort(desc),
    }))
    .sort(desc)
  return r
}

const doc = s => ({
  planned_duration: s.planned,
  started_at: s.start,
  ended_at: s.endedAt,
  paused_seconds: s.pausedSeconds,
  segments: segments(s),
})

module.exports = {
  config,
  create,
  advance,
  tick,
  pause,
  unpause,
  stop,
  suspend,
  wake,
  lock,
  unlock,
  sample,
  canSample,
  takeAlert,
  remaining,
  segments,
  totals,
  doc,
}
