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
  shell,
  Tray,
} from 'electron'
import path from 'node:path'
import type {
  ActivityTab,
  Health,
  HealthReason,
  LanguageView,
  OnboardingStep,
  StepState,
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
import { askNotifications, isNotifyGranted } from './notify.ts'
import { requestBrowserAuth } from './permissions.ts'
import { openSettings } from './settings.ts'
import { openStore, type Store } from './store.ts'
import { createTimer, type PersistedSession } from './timer.ts'
import { browserFor, readDomain, readFrontApp } from './track.ts'
import { glyphBitmap, pixelAt, type Rgb } from './trayGlyph.ts'
import { createWatcher, type Watcher } from './watcher.ts'
import {
  createActivityWindow,
  createMiniWindow,
  createOnboardingWindow,
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

const PRIVACY_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'

const GLYPH_SIZE = 18
const GLYPH_SCALE = 2
const BADGE_PROBE = 30
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
let onboarding: BrowserWindow | undefined
let store: Store | undefined
let settingsStore: ReturnType<typeof openSettings> | undefined
let watcher: Watcher | undefined
let lastIdle = true
let trayTooltip = ''
let trayGlyph: ReturnType<typeof glyphBitmap> | undefined

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

const appearance = () => ({ dark: nativeTheme.shouldUseDarkColors })

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
  trayGlyph = glyph
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
  trayTooltip = say(key)
  tray.setToolTip(trayTooltip)
  tray.setContextMenu(
    Menu.buildFromTemplate([{ label: say('menu.quit'), role: 'quit' }])
  )
  paintTrayGlyph(timer.view())
}

const trayProbe = () => {
  if (!tray || !trayGlyph) {
    return null
  }
  const image = nativeImage.createFromBitmap(trayGlyph.data, {
    width: trayGlyph.width,
    height: trayGlyph.height,
    scaleFactor: GLYPH_SCALE,
  })
  return {
    tooltip: trayTooltip,
    title: tray.getTitle(),
    badge: pixelAt(trayGlyph, BADGE_PROBE, BADGE_PROBE),
    png: image.toPNG().toString('base64'),
  }
}

if (process.env.ODY_QA_TRAY === '1') {
  Object.assign(globalThis, { odyTrayProbe: trayProbe })
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
  const open =
    popover !== undefined && !popover.isDestroyed() && popover.isVisible()
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

function openOnboarding() {
  if (onboarding && !onboarding.isDestroyed()) {
    onboarding.show()
    return onboarding
  }
  const w = createOnboardingWindow()
  onboarding = w
  void loadPage(w, 'onboarding.html')
  w.on('closed', () => {
    onboarding = undefined
  })
  return w
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
    broadcast('appearance', appearance())
  }
  if (changes.launchAtLogin !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: next.launchAtLogin,
      type: 'mainAppService',
    })
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
ipcMain.handle('events', (_e, from: number, to: number) =>
  database().eventsBetween(from, to)
)
ipcMain.handle('totals', (_e, from: number, to: number) =>
  database().totalsBetween(from, to)
)
ipcMain.handle('recordedDays', (_e, from: number, to: number) =>
  database().recordedDays(from, to)
)
ipcMain.handle('health', health)
ipcMain.handle('openActivity', (_e, tab?: ActivityTab) => {
  openActivity(tab ?? 'focus')
})
ipcMain.handle('showPopover', () => showPopover())
ipcMain.handle('appearance', appearance)
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
const notifyBinary = () =>
  process.env.ODY_NOTIFY_HELPER ??
  path.join(path.dirname(app.getPath('exe')), 'ody-notify-auth')

const stepUpdate = (step: OnboardingStep, state: StepState) => {
  if (onboarding && !onboarding.isDestroyed()) {
    onboarding.webContents.send('onboarding-step', { step, state })
  }
}

const STEP_ORDER: readonly OnboardingStep[] = [
  'frontApp',
  'browsers',
  'notifications',
  'loginItem',
]

const grants: Record<OnboardingStep, () => Promise<boolean>> = {
  frontApp: async () => (await readFrontApp()) !== null,
  browsers: async () =>
    (await requestBrowserAuth({
      settings: () => settings().get(),
      patch: changes => applySettings(changes),
    })) === 'granted',
  notifications: async () =>
    isNotifyGranted(
      await askNotifications(notifyBinary(), undefined, () => {
        new Notification({
          title: say('app.name'),
          body: say('onboarding.notificationsHint'),
          silent: true,
        }).show()
      })
    ),
  loginItem: async () => {
    applySettings({ launchAtLogin: true })
    const login = app.getLoginItemSettings({ type: 'mainAppService' })
    return login.status === 'enabled' || login.openAtLogin
  },
}

async function grantStep(step: OnboardingStep): Promise<StepState> {
  stepUpdate(step, 'waiting')
  const state: StepState = (await grants[step]()) ? 'granted' : 'denied'
  stepUpdate(step, state)
  return state
}

async function grantAll() {
  const results: Record<OnboardingStep, StepState> = {
    frontApp: 'idle',
    browsers: 'idle',
    notifications: 'idle',
    loginItem: 'idle',
  }
  for (const step of STEP_ORDER) {
    results[step] = await grantStep(step)
  }
  return results
}

ipcMain.handle('notifyStatus', () => askNotifications(notifyBinary()))
ipcMain.handle('grantAll', grantAll)
ipcMain.handle('grantStep', (_e, step: OnboardingStep) =>
  STEP_ORDER.includes(step) ? grantStep(step) : 'idle'
)
ipcMain.handle('finishOnboarding', (_e, skipped: boolean) => {
  applySettings({ onboarded: true })
  console.log('onboarding finished, skipped:', skipped === true)
  onboarding?.close()
  openActivity('focus')
})
ipcMain.handle('openPrivacy', () =>
  shell.openExternal(PRIVACY_PANE).catch((e: Error) => {
    console.error('openPrivacy:', e.message)
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
  app.setLoginItemSettings({
    openAtLogin: current.launchAtLogin,
    type: 'mainAppService',
  })
  tray = new Tray(nativeImage.createEmpty())
  tray.on('click', () => togglePopover())
  paintTrayState()
  refreshShortcut(current.focusShortcut)
  nativeTheme.on('updated', () => {
    paintTrayGlyph(timer.view())
    broadcast('appearance', appearance())
  })
  setInterval(() => timer.tick(), 1000)
  startWatching()
  if (showcaseRoute()) {
    const w = createActivityWindow()
    void loadPage(w, 'showcase.html')
    return
  }
  popoverWindow()
  if (!current.onboarded) {
    openOnboarding()
    return
  }
  openActivity('focus')
})

app.on('activate', () => {
  if (!showcaseRoute() && (!onboarding || onboarding.isDestroyed())) {
    openActivity('focus')
  }
})
