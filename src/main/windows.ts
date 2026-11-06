import { app, BrowserWindow, screen } from 'electron'
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

export function loadPage(w: BrowserWindow, page: string) {
  const dev = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
  if (dev) {
    return w.loadURL(`${dev}/${page}`)
  }
  return w.loadFile(path.join(import.meta.dirname, '../renderer', page))
}
