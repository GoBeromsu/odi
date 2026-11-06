import {
  app,
  BrowserWindow,
  globalShortcut,
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
import type {
  ActivityTab,
  Health,
  HealthReason,
  LanguageView,
  View,
} from '../shared/api.ts'
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
import { glyphBitmap, type Rgb } from './trayGlyph.ts'
import { createWatcher, type Watcher } from './watcher.ts'
import {
  createActivityWindow,
  createMiniWindow,
  createPopoverWindow,
  loadPage,
  placeUnder,
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

const TRAY_BADGE: Record<HealthReason, Rgb> = {
  'automation-denied': { r: 255, g: 179, b: 71 },
  'tracker-failed': { r: 255, g: 99, b: 105 },
}

const GLYPH_SIZE = 18
const GLYPH_SCALE = 2
const IDLE_DEGREES = 90
const DARK_INK = 236
const LIGHT_INK = 22

const seconds = (value: string | undefined) => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : null
}

const envFocus = seconds(process.env.ODY_FOCUS_SECONDS)
const envBreak = seconds(process.env.ODY_BREAK_SECONDS)

const now = () => Date.now() / 1000
const userFile = (name: string) => path.join(app.getPath('userData'), name)

let tray: Tray | undefined
let popover: BrowserWindow | undefined
let mini: BrowserWindow | undefined
let activity: BrowserWindow | undefined
let store: Store | undefined
let settingsStore: ReturnType<typeof openSettings> | undefined
let watcher: Watcher | undefined
let lastIdle = true

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

const paintTrayGlyph = (view: View) => {
  if (!tray) {
    return
  }
  const reason = health().reason
  const shade = nativeTheme.shouldUseDarkColors ? DARK_INK : LIGHT_INK
  const glyph = glyphBitmap({
    size: GLYPH_SIZE,
    scale: GLYPH_SCALE,
    degrees:
      view.phase === 'idle'
        ? IDLE_DEGREES
        : (Math.max(0, view.remaining) / 3600) * 360,
    ink: { r: shade, g: shade, b: shade },
    badge: reason ? TRAY_BADGE[reason] : null,
  })
  tray.setImage(
    nativeImage.createFromBitmap(glyph.data, {
      width: glyph.width,
      height: glyph.height,
      scaleFactor: GLYPH_SCALE,
    })
  )
}

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
  paintTrayGlyph(timer.view())
}

function popoverWindow() {
  if (!popover || popover.isDestroyed()) {
    const w = createPopoverWindow()
    popover = w
    void loadPage(w, 'focus.html')
    w.on('blur', () => {
      w.hide()
      refreshMini()
    })
    w.on('show', () => mini?.hide())
    w.on('closed', () => {
      popover = undefined
    })
  }
  return popover
}

function miniWindow() {
  if (!mini || mini.isDestroyed()) {
    const w = createMiniWindow()
    mini = w
    void loadPage(w, 'mini.html')
    w.on('closed', () => {
      mini = undefined
    })
  }
  return mini
}

function refreshMini() {
  const open = popover !== undefined && !popover.isDestroyed() && popover.isVisible()
  if (timer.idle() || open) {
    mini?.hide()
    return
  }
  const pill = miniWindow()
  placeUnder(pill, tray?.getBounds())
  pill.showInactive()
}

function showPopover() {
  const w = popoverWindow()
  placeUnder(w, tray?.getBounds())
  w.show()
  w.focus()
}

function togglePopover() {
  const w = popoverWindow()
  if (w.isVisible()) {
    w.hide()
    refreshMini()
    return
  }
  showPopover()
}

function openActivity(tab: ActivityTab) {
  if (!activity || activity.isDestroyed()) {
    const w = createActivityWindow()
    activity = w
    void loadPage(w, 'activity.html', { tab })
    w.on('closed', () => {
      activity = undefined
    })
    return
  }
  activity.show()
  activity.focus()
  activity.webContents.send('activity-tab', tab)
}

function refreshShortcut(accelerator: string) {
  globalShortcut.unregisterAll()
  try {
    const taken = globalShortcut.register(accelerator, () => {
      showPopover()
      popover?.webContents.send('open-sheet')
    })
    if (!taken) {
      console.error('globalShortcut: already taken', accelerator)
    }
  } catch (e) {
    console.error('globalShortcut:', (e as Error).message)
  }
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
  if (changes.focusShortcut !== undefined && app.isReady()) {
    refreshShortcut(next.focusShortcut)
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
    paintTrayGlyph(view)
    broadcast('state', view)
    const idle = view.phase === 'idle'
    if (idle !== lastIdle) {
      lastIdle = idle
      refreshMini()
    }
  },
})

ipcMain.handle('state', () => timer.view())
ipcMain.handle('start', (_e, mode: Mode, planned?: number) => {
  const wanted = mode === 'break' ? 'break' : 'focus'
  const seam = wanted === 'break' ? envBreak : envFocus
  timer.start(wanted, seam ?? planned)
})
ipcMain.handle('pause', () => timer.pause())
ipcMain.handle('resume', () => timer.resume())
ipcMain.handle('stop', () => timer.stop())
ipcMain.handle('sessions', (_e, from: number, to: number) =>
  database().sessionsBetween(from, to)
)
ipcMain.handle('health', health)
ipcMain.handle('openActivity', (_e, tab?: ActivityTab) => {
  openActivity(tab ?? 'focus')
})
ipcMain.handle('showPopover', () => showPopover())
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

app.on('before-quit', () => {
  if (!timer.idle()) {
    timer.stop()
  }
  watcher?.stop()
  globalShortcut.unregisterAll()
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
  if (!showcaseRoute()) {
    showPopover()
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
  tray.on('click', () => togglePopover())
  paintTrayState()
  refreshShortcut(current.focusShortcut)
  nativeTheme.on('updated', () => paintTrayGlyph(timer.view()))
  setInterval(() => timer.tick(), 1000)
  startWatching()
  if (showcaseRoute()) {
    const w = createActivityWindow()
    void loadPage(w, 'showcase.html')
    return
  }
  showPopover()
})
