import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import path from 'node:path'

const PORTRAIT_RIGHT = 'portrait-right'

export function targetDisplay() {
  if (process.env.ODY_QA_DISPLAY !== PORTRAIT_RIGHT) {
    return screen.getPrimaryDisplay()
  }
  const portrait = screen
    .getAllDisplays()
    .filter(d => d.bounds.height > d.bounds.width)
  if (portrait.length === 0) {
    return screen.getPrimaryDisplay()
  }
  return portrait.reduce(
    (best, d) => (d.bounds.x > best.bounds.x ? d : best),
    portrait[0]
  )
}

const centered = (width: number, height: number) => {
  const area = targetDisplay().workArea
  const w = Math.min(width, area.width)
  const h = Math.min(height, area.height)
  return {
    width: w,
    height: h,
    x: area.x + Math.round((area.width - w) / 2),
    y: area.y + Math.round((area.height - h) / 2),
  }
}

const anchoredTopRight = (width: number, height: number, inset = 12) => {
  const area = targetDisplay().workArea
  const w = Math.min(width, area.width)
  const h = Math.min(height, area.height)
  return {
    width: w,
    height: h,
    x: area.x + Math.max(0, area.width - w - inset),
    y: area.y + inset,
  }
}

const chrome = () => ({
  preload: path.join(import.meta.dirname, '../preload/preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
})

const harden = (w: BrowserWindow) => {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.webContents.on('will-navigate', e => e.preventDefault())
  return w
}

export function createPopoverWindow() {
  return harden(
    new BrowserWindow({
      ...anchoredTopRight(320, 380),
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      vibrancy: 'popover',
      visualEffectState: 'active',
      roundedCorners: true,
      webPreferences: chrome(),
    })
  )
}

export function createMiniWindow() {
  return harden(
    new BrowserWindow({
      ...anchoredTopRight(152, 36, 18),
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#00000000',
      vibrancy: 'popover',
      visualEffectState: 'active',
      roundedCorners: true,
      webPreferences: chrome(),
    })
  )
}

export function createOnboardingWindow() {
  return harden(
    new BrowserWindow({
      ...centered(560, 640),
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#00000000',
      vibrancy: 'popover',
      visualEffectState: 'active',
      webPreferences: chrome(),
    })
  )
}

export function placeUnder(w: BrowserWindow, anchor?: Rectangle) {
  const area = targetDisplay().workArea
  const { width, height } = w.getBounds()
  const reachable =
    anchor !== undefined &&
    anchor.width > 0 &&
    anchor.x >= area.x &&
    anchor.x <= area.x + area.width
  if (!reachable) {
    const spot = anchoredTopRight(width, height)
    w.setPosition(spot.x, spot.y)
    return
  }
  const middle = Math.round(anchor.x + anchor.width / 2 - width / 2)
  const x = Math.min(
    Math.max(middle, area.x),
    area.x + Math.max(0, area.width - width)
  )
  const y = Math.min(
    anchor.y + anchor.height + 6,
    area.y + Math.max(0, area.height - height)
  )
  w.setPosition(x, y)
}

export function createActivityWindow() {
  return harden(
    new BrowserWindow({
      ...centered(1040, 720),
      minWidth: 760,
      minHeight: 520,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#00000000',
      vibrancy: 'sidebar',
      visualEffectState: 'followWindow',
      webPreferences: chrome(),
    })
  )
}

export function loadPage(
  w: BrowserWindow,
  page: string,
  query?: Record<string, string>
) {
  const dev = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
  const search = query ? '?' + new URLSearchParams(query).toString() : ''
  if (dev) {
    return w.loadURL(`${dev}/${page}${search}`)
  }
  return w.loadFile(path.join(import.meta.dirname, '../renderer', page), {
    query,
  })
}
