import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export type EventKind = 'active' | 'idle' | 'away'

export interface Sample {
  kind: EventKind
  app?: string | null
  bundle_id?: string | null
  domain?: string | null
}

export interface Event {
  id: number
  start: number
  end: number
  kind: EventKind
  app: string | null
  bundle_id: string | null
  domain: string | null
}

export interface AppTotal {
  app: string | null
  bundle_id: string | null
  seconds: number
  sites: { domain: string; seconds: number }[]
}

export interface SessionRow {
  id: string
  started_at: number
  ended_at: number | null
  planned: number
  paused_seconds: number
  overtime_seconds: number
  status: string
  kind: string
}

export interface ImportReport {
  already: boolean
  sessions: number
  events: number
  skipped: string[]
}

interface SegmentFile {
  started_at: number
  ended_at: number
  kind: string
  app_name: string | null
  bundle_id: string | null
  domain: string | null
}

interface SessionFile {
  started_at: number
  ended_at?: number | null
  planned_duration: number
  paused_seconds: number
  segments: SegmentFile[]
  status?: string
}

const SCHEMA_VERSION = '1'
const SESSION_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/
const KINDS: readonly EventKind[] = ['active', 'idle', 'away']
const IMPORT_KIND: Record<string, EventKind> = {
  active: 'active',
  idle: 'idle',
  no_input: 'idle',
  away: 'away',
}

type EventTuple = [
  number,
  number,
  number,
  EventKind,
  string | null,
  string | null,
  string | null,
]
type TotalTuple = [string | null, string | null, string | null, number]
type SessionTuple = [
  string,
  number,
  number | null,
  number,
  number,
  number,
  string,
  string,
]

const DDL = `
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY,
  start REAL NOT NULL,
  "end" REAL NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('active','idle','away')),
  app TEXT,
  bundle_id TEXT,
  domain TEXT
);
CREATE INDEX IF NOT EXISTS events_start ON events(start);
CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY,
  started_at REAL,
  ended_at REAL,
  planned INTEGER,
  paused_seconds INTEGER,
  overtime_seconds INTEGER,
  status TEXT,
  kind TEXT
);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
`

const sameTarget = (a: Event, b: Sample) =>
  a.kind === b.kind &&
  a.app === (b.app ?? null) &&
  a.bundle_id === (b.bundle_id ?? null) &&
  a.domain === (b.domain ?? null)

const wellFormed = (d: SessionFile) =>
  Array.isArray(d.segments) &&
  typeof d.started_at === 'number' &&
  typeof d.planned_duration === 'number' &&
  typeof d.paused_seconds === 'number' &&
  d.segments.every(
    g =>
      typeof g.started_at === 'number' &&
      typeof g.ended_at === 'number' &&
      g.ended_at > g.started_at &&
      IMPORT_KIND[g.kind] !== undefined
  )

export function openStore(file: string) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode=WAL')
  db.exec('PRAGMA foreign_keys=ON')
  db.exec(DDL)

  const setMeta = db.prepare(
    'INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  )
  const getMeta = db.prepare('SELECT value FROM meta WHERE key=?')
  const lastEvent = db.prepare(
    'SELECT id, start, "end", kind, app, bundle_id, domain FROM events ORDER BY start DESC, id DESC LIMIT 1'
  )
  const extend = db.prepare('UPDATE events SET "end"=? WHERE id=?')
  const insert = db.prepare(
    'INSERT INTO events(start,"end",kind,app,bundle_id,domain) VALUES(?,?,?,?,?,?)'
  )
  const between = db.prepare(
    `SELECT id, MAX(start,?), MIN("end",?), kind, app, bundle_id, domain
     FROM events WHERE "end">=? AND start<=? ORDER BY start, id`
  )
  between.setReturnArrays(true)
  const totals = db.prepare(
    `SELECT app, bundle_id, domain, SUM(MIN("end",?) - MAX(start,?))
     FROM events
     WHERE kind='active' AND "end">=? AND start<=?
     GROUP BY app, bundle_id, domain`
  )
  totals.setReturnArrays(true)
  const recorded = db.prepare(
    `SELECT DISTINCT date(start, 'unixepoch', 'localtime')
     FROM events
     WHERE kind='active' AND "end">=? AND start<=?
     ORDER BY 1`
  )
  recorded.setReturnArrays(true)
  const putSession = db.prepare(
    `INSERT INTO sessions(id,started_at,ended_at,planned,paused_seconds,overtime_seconds,status,kind)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       started_at=excluded.started_at,
       ended_at=excluded.ended_at,
       planned=excluded.planned,
       paused_seconds=excluded.paused_seconds,
       overtime_seconds=excluded.overtime_seconds,
       status=excluded.status,
       kind=excluded.kind`
  )
  const sessionsIn = db.prepare(
    `SELECT id, started_at, ended_at, planned, paused_seconds, overtime_seconds, status, kind
     FROM sessions
     WHERE started_at<=? AND COALESCE(ended_at, started_at)>=?
     ORDER BY started_at, id`
  )
  sessionsIn.setReturnArrays(true)

  setMeta.run('schema_version', SCHEMA_VERSION)

  const meta = (key: string) => {
    const row = getMeta.get(key) as { value: string } | undefined
    return row ? row.value : null
  }
  const transact = <T>(body: () => T): T => {
    db.exec('BEGIN')
    try {
      const value = body()
      db.exec('COMMIT')
      return value
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
  const put = (s: Sample, start: number, end: number) => {
    insert.run(
      start,
      end,
      s.kind,
      s.app ?? null,
      s.bundle_id ?? null,
      s.domain ?? null
    )
  }

  function heartbeat(sample: Sample, at: number, pulse: number) {
    if (!KINDS.includes(sample.kind)) {
      throw new Error('unknown kind: ' + sample.kind)
    }
    const last = lastEvent.get() as Event | undefined
    const continues =
      last !== undefined &&
      sameTarget(last, sample) &&
      at >= last.end &&
      at - last.end <= pulse
    if (continues) {
      extend.run(at, last.id)
    } else {
      put(sample, at, at)
    }
    setMeta.run('last_alive', String(at))
  }

  function boundary(kind: EventKind, start: number, end: number) {
    put({ kind }, start, end)
  }

  function eventsBetween(a: number, b: number): Event[] {
    const rows = between.all(a, b, a, b) as unknown as EventTuple[]
    const out: Event[] = new Array(rows.length)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      out[i] = {
        id: r[0],
        start: r[1],
        end: r[2],
        kind: r[3],
        app: r[4],
        bundle_id: r[5],
        domain: r[6],
      }
    }
    return out
  }

  function totalsBetween(a: number, b: number): AppTotal[] {
    const rows = totals.all(b, a, a, b) as unknown as TotalTuple[]
    const apps = new Map<string, AppTotal>()
    for (const [app, bundleId, domain, seconds] of rows) {
      const key = String(bundleId ?? app)
      const entry = apps.get(key) ?? {
        app,
        bundle_id: bundleId,
        seconds: 0,
        sites: [],
      }
      entry.seconds += seconds
      if (domain) {
        entry.sites.push({ domain, seconds })
      }
      apps.set(key, entry)
    }
    const desc = (x: { seconds: number }, y: { seconds: number }) =>
      y.seconds - x.seconds
    return [...apps.values()]
      .map(a2 => ({ ...a2, sites: a2.sites.sort(desc) }))
      .sort(desc)
  }

  function recordedDays(a: number, b: number): string[] {
    const rows = recorded.all(a, b) as unknown as [string][]
    return rows.map(r => r[0])
  }

  function upsertSession(s: SessionRow) {
    putSession.run(
      s.id,
      s.started_at,
      s.ended_at,
      s.planned,
      s.paused_seconds,
      s.overtime_seconds,
      s.status,
      s.kind
    )
  }

  function sessionsBetween(a: number, b: number): SessionRow[] {
    const rows = sessionsIn.all(b, a) as unknown as SessionTuple[]
    return rows.map(r => ({
      id: r[0],
      started_at: r[1],
      ended_at: r[2],
      planned: r[3],
      paused_seconds: r[4],
      overtime_seconds: r[5],
      status: r[6],
      kind: r[7],
    }))
  }

  function lastAlive() {
    const v = meta('last_alive')
    return v === null ? null : Number(v)
  }

  function closeCrashGap(now: number, pulse: number) {
    const alive = lastAlive()
    setMeta.run('last_alive', String(now))
    if (alive === null || now - alive <= pulse) {
      return null
    }
    boundary('away', alive, now)
    return { start: alive, end: now }
  }

  function importJson(dir: string): ImportReport {
    const report: ImportReport = {
      already: meta('imported_json') === '1',
      sessions: 0,
      events: 0,
      skipped: [],
    }
    if (report.already) {
      return report
    }
    let names: string[] = []
    try {
      names = fs
        .readdirSync(dir)
        .filter(n => n.endsWith('.json'))
        .sort()
    } catch {
      names = []
    }
    transact(() => {
      for (const name of names) {
        const id = name.slice(0, -'.json'.length)
        let data: SessionFile
        try {
          data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
        } catch (e) {
          console.warn('store import: unreadable', name, (e as Error).message)
          report.skipped.push(name)
          continue
        }
        if (!SESSION_ID.test(id) || !wellFormed(data)) {
          console.warn('store import: malformed', name)
          report.skipped.push(name)
          continue
        }
        for (const g of data.segments) {
          put(
            {
              kind: IMPORT_KIND[g.kind],
              app: g.app_name,
              bundle_id: g.bundle_id,
              domain: g.domain,
            },
            g.started_at,
            g.ended_at
          )
          report.events++
        }
        const last = data.segments[data.segments.length - 1]
        upsertSession({
          id,
          started_at: data.started_at,
          ended_at: data.ended_at ?? last?.ended_at ?? data.started_at,
          planned: data.planned_duration,
          paused_seconds: data.paused_seconds,
          overtime_seconds: 0,
          status: typeof data.status === 'string' ? data.status : 'ended',
          kind: 'focus',
        })
        report.sessions++
      }
      setMeta.run('imported_json', '1')
    })
    return report
  }

  return {
    heartbeat,
    boundary,
    eventsBetween,
    totalsBetween,
    recordedDays,
    upsertSession,
    sessionsBetween,
    importJson,
    closeCrashGap,
    lastAlive,
    meta,
    transact,
    close: () => db.close(),
  }
}

export type Store = ReturnType<typeof openStore>
