import {
  app,
  BrowserWindow,
  Tray,
  nativeImage,
  nativeTheme,
  powerMonitor,
  session,
  shell,
  ipcMain,
  screen,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import * as S from '../shared/session.ts'
import type { Segment, Session, Sampled } from '../shared/session.ts'
import type {
  SessionDetail,
  SessionSummary,
  Theme,
  View,
} from '../shared/api.ts'
import { mmss } from '../shared/time.ts'
import { readFront } from './track.ts'
import { openStore, type Store } from './store.ts'

if (process.env.ODY_USER_DATA) {
  app.setPath('userData', process.env.ODY_USER_DATA)
}

interface SessionFile {
  started_at: number
  ended_at?: number | null
  planned_duration: number
  paused_seconds: number
  segments: Segment[]
  status: string
}

const SESSION_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/
const THEMES: readonly Theme[] = ['system', 'light', 'dark']
const isTheme = (t: unknown): t is Theme => THEMES.includes(t as Theme)
const SAMPLE_GIVE_UP_MS = 3000

const cfg = S.config(process.env)
const now = () => Date.now() / 1000
let win: BrowserWindow | undefined,
  tray: Tray,
  s: Session | null = null,
  timer: NodeJS.Timeout | undefined,
  finalized = false,
  quitting = false
let inflight = false,
  lastSampleAt = 0,
  tickAt = 0,
  maxGap = 0,
  power: { event: string; at: number; last_tick: number }[] = []

const sessionsDir = () => path.join(app.getPath('userData'), 'sessions')

let store: Store | undefined
const database = () => {
  store ??= openStore(path.join(app.getPath('userData'), 'ody.db'))
  return store
}
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
const sessionId = (x: Session) =>
  new Date(x.start * 1000).toISOString().replace(/[:.]/g, '-')
const file = (x: Session) => path.join(sessionsDir(), sessionId(x) + '.json')

function writeJsonAtomic(target: string, data: unknown) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target + '.tmp', JSON.stringify(data, null, 2))
  fs.renameSync(target + '.tmp', target)
}

function write(x: Session, status: string) {
  writeJsonAtomic(file(x), {
    id: sessionId(x),
    ...S.doc(x),
    status,
    diagnostics: { max_tick_gap: maxGap, power },
  })
}

function readSessionFile(id: string): SessionFile | null {
  if (!SESSION_ID.test(id)) {
    return null
  }
  try {
    const d: SessionFile = JSON.parse(
      fs.readFileSync(path.join(sessionsDir(), id + '.json'), 'utf8')
    )
    const wellFormed =
      Array.isArray(d.segments) &&
      typeof d.started_at === 'number' &&
      typeof d.planned_duration === 'number' &&
      typeof d.paused_seconds === 'number' &&
      d.segments.every(g => g.ended_at > g.started_at)
    return wellFormed ? d : null
  } catch {
    return null
  }
}

const closedAt = (d: SessionFile) =>
  d.ended_at ?? d.segments[d.segments.length - 1]?.ended_at ?? d.started_at

function listSessions(): SessionSummary[] {
  const running = s && !s.ended ? sessionId(s) : null
  let names: string[]
  try {
    names = fs.readdirSync(sessionsDir())
  } catch {
    return []
  }
  return names
    .filter(n => n.endsWith('.json'))
    .map(n => n.slice(0, -'.json'.length))
    .filter(id => id !== running)
    .map(id => [id, readSessionFile(id)] as const)
    .filter(
      (e): e is readonly [string, SessionFile] =>
        e[1] !== null && e[1].segments.length > 0
    )
    .map(([id, d]) => ({
      id,
      started_at: d.started_at,
      ended_at: closedAt(d),
      recorded_seconds: d.segments.reduce(
        (sum, g) => sum + g.ended_at - g.started_at,
        0
      ),
      paused_seconds: d.paused_seconds,
      status: d.status,
    }))
    .sort((a, b) => b.started_at - a.started_at)
}

function readSessionDetail(id: string): SessionDetail | null {
  const d = readSessionFile(id)
  if (!d) {
    return null
  }
  try {
    return {
      id,
      planned: d.planned_duration,
      paused_seconds: d.paused_seconds,
      started_at: d.started_at,
      ended_at: closedAt(d),
      segments: d.segments,
      totals: S.totals(d.segments),
      status: d.status,
    }
  } catch {
    return null
  }
}

function savedTheme(): Theme {
  try {
    const { theme } = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
    return isTheme(theme) ? theme : 'system'
  } catch {
    return 'system'
  }
}

function view(): View {
  if (!s || s.ended) {
    return { phase: 'idle', planned: cfg.planned }
  }
  return {
    phase: s.pausedAt === null ? 'running' : 'paused',
    planned: s.planned,
    remaining: S.remaining(s),
  }
}

function push() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('state', view())
  }
}

function sendEnded(id: string) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('ended', id)
  }
}

function alertUser(x: Session) {
  ;[0, 350, 700].forEach(ms => setTimeout(() => shell.beep(), ms))
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
  }
  sendEnded(sessionId(x))
}

function after() {
  if (!s) {
    return
  }
  if (s.ended && !finalized) {
    finalized = true
    clearInterval(timer)
    write(s, s.stopped ? 'stopped' : 'ended')
    tray.setTitle('')
    push()
  } else if (!s.ended) {
    tray.setTitle((s.pausedAt === null ? '' : '⏸ ') + mmss(S.remaining(s)))
    push()
  }
  if (S.takeAlert(s)) {
    alertUser(s)
  }
}

function maybeSample(sess: Session, t: number) {
  if (inflight || t - lastSampleAt < 2 || !S.canSample(sess)) {
    return
  }
  inflight = true
  lastSampleAt = t
  const gen = sess.gen
  const real = readFront()
  const clearInflightOnlyWhenReallySettled = () => {
    inflight = false
  }
  real.then(
    clearInflightOnlyWhenReallySettled,
    clearInflightOnlyWhenReallySettled
  )
  Promise.race([
    real,
    new Promise<null>(r => setTimeout(r, SAMPLE_GIVE_UP_MS, null)),
  ]).then((r: Sampled | null) => {
    if (r && s === sess && S.sample(sess, now(), gen, r)) {
      after()
    }
  })
}

function tick(sess: Session) {
  const t = now()
  if (tickAt) {
    maxGap = Math.max(maxGap, Math.floor(t) - Math.floor(tickAt))
  }
  tickAt = t
  S.tick(sess, t, powerMonitor.getSystemIdleTime())
  if (!sess.ended) {
    maybeSample(sess, t)
  }
  after()
}

const POWER_EVENTS: [
  'suspend' | 'resume' | 'lock-screen' | 'unlock-screen',
  (x: Session, t: number) => void,
][] = [
  ['suspend', S.suspend],
  ['resume', S.wake],
  ['lock-screen', S.lock],
  ['unlock-screen', S.unlock],
]
for (const [name, fn] of POWER_EVENTS) {
  powerMonitor.on(name as 'suspend', () => {
    if (!s) {
      return
    }
    power.push({
      event: name,
      at: Math.floor(now()),
      last_tick: Math.floor(tickAt),
    })
    console.log(name, 'at', Math.floor(now()), 'last tick', Math.floor(tickAt))
    fn(s, now())
    after()
  })
}

ipcMain.handle('state', view)

ipcMain.handle('start', () => {
  if (s && !s.ended) {
    return
  }
  const sess = S.create(now(), cfg.planned, cfg.idle)
  s = sess
  finalized = false
  inflight = false
  lastSampleAt = 0
  tickAt = 0
  maxGap = 0
  power = []
  timer = setInterval(() => tick(sess), 1000)
  tick(sess)
  write(sess, 'in_progress')
})

ipcMain.handle('pause', () => {
  if (s && !s.ended) {
    S.pause(s, now())
    write(s, 'in_progress')
    after()
  }
})
ipcMain.handle('resume', () => {
  if (s && !s.ended) {
    S.unpause(s, now())
    after()
  }
})

ipcMain.handle('stop', () => {
  if (!s || s.ended) {
    return
  }
  const id = sessionId(s)
  S.stop(s, now())
  if (s.stopped && S.segments(s).length === 0) {
    clearInterval(timer)
    fs.rmSync(file(s), { force: true })
    s = null
    tray.setTitle('')
    push()
    return
  }
  after()
  if (s.stopped) {
    sendEnded(id)
  }
})

ipcMain.handle('sessions', listSessions)
ipcMain.handle('session', (_e, id: string) => readSessionDetail(id))

ipcMain.handle('theme', () => nativeTheme.themeSource)
ipcMain.handle('setTheme', (_e, theme: unknown) => {
  if (!isTheme(theme)) {
    throw new Error('invalid theme')
  }
  writeJsonAtomic(settingsFile(), { theme })
  nativeTheme.themeSource = theme
})

setInterval(() => {
  if (s && !s.ended) {
    write(s, 'in_progress')
  }
}, 30000)

const devRendererUrl = () =>
  app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL

function contentSecurityPolicy() {
  const dev = devRendererUrl()
  if (!dev) {
    return "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'"
  }
  const socket = dev.replace(/^http/, 'ws')
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${dev}`,
    `style-src 'self' 'unsafe-inline' ${dev}`,
    `connect-src 'self' ${dev} ${socket}`,
    `img-src 'self' data: ${dev}`,
    `font-src 'self' ${dev}`,
  ].join('; ')
}

function guardContent() {
  const policy = contentSecurityPolicy()
  session.defaultSession.webRequest.onHeadersReceived((details, done) => {
    done({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

const windowBackground = () =>
  nativeTheme.shouldUseDarkColors ? '#0E0C0B' : '#F3EEE8'

function createWindow() {
  const d =
    screen.getAllDisplays().find(x => x.bounds.height > x.bounds.width) ||
    screen.getPrimaryDisplay()
  const a = d.workArea,
    width = Math.min(900, a.width),
    height = Math.min(760, a.height)
  const w = new BrowserWindow({
    width,
    height,
    minWidth: 420,
    minHeight: 560,
    x: a.x + Math.round((a.width - width) / 2),
    y: a.y + Math.round((a.height - height) / 2),
    backgroundColor: windowBackground(),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win = w
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.webContents.on('will-navigate', e => e.preventDefault())
  w.on('close', e => {
    if (!quitting && s && !s.ended) {
      e.preventDefault()
      w.hide()
    }
  })
  const dev = devRendererUrl()
  if (dev) {
    w.loadURL(dev + '/focus.html')
  } else {
    w.loadFile(path.join(import.meta.dirname, '../renderer/focus.html'))
  }
}

nativeTheme.on('updated', () => {
  if (win && !win.isDestroyed()) {
    win.setBackgroundColor(windowBackground())
  }
})

app.on('before-quit', () => {
  quitting = true
  if (s && !finalized) {
    S.advance(s, now())
    write(s, s.ended ? 'ended' : 'in_progress')
  }
})
app.on('activate', () => {
  if (win && !win.isDestroyed()) {
    win.show()
  }
})

app.whenReady().then(() => {
  const imported = database().importJson(sessionsDir())
  if (!imported.already) {
    console.log(
      'store: imported',
      imported.sessions,
      'sessions and',
      imported.events,
      'events, skipped',
      imported.skipped.length
    )
  }
  guardContent()
  nativeTheme.themeSource = savedTheme()
  tray = new Tray(nativeImage.createEmpty())
  createWindow()
})
