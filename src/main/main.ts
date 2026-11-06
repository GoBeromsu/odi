import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  powerMonitor,
  session,
  Tray,
} from 'electron'
import path from 'node:path'
import type { Health, LanguageView, View } from '../shared/api.ts'
import {
  resolveLanguage,
  systemLocale,
  t,
  type MessageKey,
} from '../shared/i18n/index.ts'
import type { Mode } from '../shared/session.ts'
import type { Language, Settings } from '../shared/settings.ts'
import { clock } from '../shared/time.ts'
import { requestBrowserAuth } from './permissions.ts'
import { openSettings } from './settings.ts'
import { openStore, type Store } from './store.ts'
import { createTimer, type PersistedSession } from './timer.ts'
import { browserFor, readDomain, readFrontApp } from './track.ts'
import { createWatcher, type Watcher } from './watcher.ts'
import {
  createActivityWindow,
  createPopoverWindow,
  loadPage,
} from './windows.ts'

if (process.env.ODY_USER_DATA) {
  app.setPath('userData', process.env.ODY_USER_DATA)
}

const BOUNDARY_TITLE: Record<Mode, MessageKey> = {
  focus: 'notify.focusEnded',
  break: 'notify.breakEnded',
}

const TRAY_FAULT: Record<string, MessageKey> = {
  'automation-denied': 'tray.automationDenied',
  'tracker-failed': 'tray.trackerFailed',
}

const seconds = (value: string | undefined) => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : null
}

const envFocus = seconds(process.env.ODY_FOCUS_SECONDS)
const envBreak = seconds(process.env.ODY_BREAK_SECONDS)

const now = () => Date.now() / 1000
const userFile = (name: string) => path.join(app.getPath('userData'), name)

let tray: Tray | undefined
let win: BrowserWindow | undefined
let store: Store | undefined
let settingsStore: ReturnType<typeof openSettings> | undefined
let watcher: Watcher | undefined

const database = () => {
  store ??= openStore(userFile('ody.db'))
  return store
}
const settings = () => {
  settingsStore ??= openSettings(userFile('settings.json'))
  return settingsStore
}

const sessionsDir = () => userFile('sessions')

const broadcast = (channel: string, payload: unknown) => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send(channel, payload)
    }
  }
}

const preferredSystemLanguage = () =>
  process.env.ODY_SYSTEM_LANGUAGE ?? app.getPreferredSystemLanguages()[0]

const languageView = (): LanguageView => {
  const setting = settings().get().language
  const preferred = preferredSystemLanguage()
  return {
    setting,
    system: systemLocale(preferred),
    locale: resolveLanguage(setting, preferred),
  }
}

const say = (key: MessageKey) => t(languageView().locale, key)

const health = (): Health => watcher?.health() ?? { state: 'paused' }

const paintTrayState = () => {
  if (!tray) {
    return
  }
  const now = health()
  const key: MessageKey = now.reason
    ? TRAY_FAULT[now.reason]
    : now.state === 'paused'
      ? 'tray.paused'
      : 'tray.recording'
  tray.setToolTip(say(key))
  tray.setContextMenu(
    Menu.buildFromTemplate([{ label: say('menu.quit'), role: 'quit' }])
  )
}

const applySettings = (changes: Partial<Settings>) => {
  const next = settings().patch(changes)
  if (changes.mode !== undefined) {
    nativeTheme.themeSource = next.mode
  }
  if (changes.launchAtLogin !== undefined) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
  }
  if (changes.language !== undefined) {
    broadcast('language-changed', languageView())
  }
  paintTrayState()
  broadcast('settings', next)
  return next
}

const plannedFor = (mode: Mode) => {
  const s = settings().get()
  return mode === 'focus'
    ? (envFocus ?? s.focusMinutes * 60)
    : (envBreak ?? s.breakMinutes * 60)
}

const paintTray = (view: View) => {
  if (!tray) {
    return
  }
  const show = settings().get().menuBarTime && view.phase !== 'idle'
  const prefix = view.phase === 'paused' ? '⏸ ' : ''
  tray.setTitle(show ? prefix + clock(view.remaining) : '')
}

const announce = (mode: Mode) => {
  if (!Notification.isSupported()) {
    return
  }
  new Notification({
    title: say(BOUNDARY_TITLE[mode]),
    silent: settings().get().sound === 'none',
  }).show()
}

const keep = (row: PersistedSession) => {
  database().upsertSession({ ...row })
}

const timer = createTimer({
  settings: () => settings().get(),
  now,
  plannedFor,
  persist: keep,
  notify: announce,
  publish: view => {
    paintTray(view)
    broadcast('state', view)
  },
})

ipcMain.handle('state', () => timer.view())
ipcMain.handle('start', (_e, mode: Mode, planned?: number) => {
  timer.start(mode === 'break' ? 'break' : 'focus', planned)
})
ipcMain.handle('pause', () => timer.pause())
ipcMain.handle('resume', () => timer.resume())
ipcMain.handle('stop', () => timer.stop())
ipcMain.handle('sessions', (_e, from: number, to: number) =>
  database().sessionsBetween(from, to)
)
ipcMain.handle('health', health)
ipcMain.handle('settings', () => settings().get())
ipcMain.handle('patchSettings', (_e, changes: Partial<Settings>) =>
  applySettings(changes ?? {})
)
ipcMain.handle('requestBrowserAuth', () =>
  requestBrowserAuth({
    settings: () => settings().get(),
    patch: changes => applySettings(changes),
  })
)
ipcMain.handle('language', languageView)
ipcMain.handle('setLanguage', (_e, value: Language) => {
  applySettings({ language: value })
  return languageView()
})

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

const showcaseRoute = () => !app.isPackaged && process.env.ODY_SHOWCASE === '1'

function createWindow() {
  const showcase = showcaseRoute()
  const w = showcase ? createActivityWindow() : createPopoverWindow()
  win = w
  loadPage(w, showcase ? 'showcase.html' : 'focus.html')
}

app.on('before-quit', () => {
  if (!timer.idle()) {
    timer.stop()
  }
  watcher?.stop()
})

function startWatching() {
  const w = createWatcher({
    store: database(),
    settings: () => settings().get(),
    patch: changes => applySettings(changes),
    readFrontApp,
    readDomain,
    browserFor,
    idleSeconds: () => powerMonitor.getSystemIdleTime(),
    now,
    onHealth: next => {
      paintTrayState()
      broadcast('health', next)
    },
  })
  watcher = w
  const leave = () => w.suspend(now())
  const arrive = () => w.resume(now())
  powerMonitor.on('suspend', leave)
  powerMonitor.on('lock-screen', leave)
  powerMonitor.on('resume', arrive)
  powerMonitor.on('unlock-screen', arrive)
  w.start()
}

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
  const current = settings().get()
  nativeTheme.themeSource = current.mode
  app.setLoginItemSettings({ openAtLogin: current.launchAtLogin })
  app.dock?.hide()
  tray = new Tray(nativeImage.createEmpty())
  paintTrayState()
  setInterval(() => timer.tick(), 1000)
  startWatching()
  createWindow()
})
