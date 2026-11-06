import { execFile } from 'node:child_process'

export interface Browser {
  id: string
  name: string
  tab: string
}

export interface FrontApp {
  app: string
  bundle_id: string | null
}

export interface DomainRead {
  domain: string | null
  denied: boolean
  failed: boolean
}

interface Run {
  err: (Error & { killed?: boolean }) | null
  out: string
  errOut: string
}

export const SUPPORTED_BROWSERS: Record<string, Browser> = {
  'at.studio.asidebrowser': {
    id: 'at.studio.AsideBrowser',
    name: 'Aside',
    tab: 'active tab',
  },
  'com.google.chrome': {
    id: 'com.google.Chrome',
    name: 'Chrome',
    tab: 'active tab',
  },
  'com.apple.safari': {
    id: 'com.apple.Safari',
    name: 'Safari',
    tab: 'current tab',
  },
  'company.thebrowser.browser': {
    id: 'company.thebrowser.Browser',
    name: 'Arc',
    tab: 'active tab',
  },
  'company.thebrowser.dia': {
    id: 'company.thebrowser.dia',
    name: 'Dia',
    tab: 'active tab',
  },
}

const OSASCRIPT = process.env.ODY_OSASCRIPT ?? 'osascript'

export const osascriptBinary = () => OSASCRIPT

export const browserFor = (bundleId: string | null | undefined) =>
  bundleId ? (SUPPORTED_BROWSERS[bundleId.toLowerCase()] ?? null) : null

export const browserById = (id: string) =>
  SUPPORTED_BROWSERS[id.toLowerCase()] ?? null

export const isAutomationDenied = (stderr: string) => stderr.includes('(-1743)')

const run = (cmd: string, args: string[], ms: number) =>
  new Promise<Run>(resolve =>
    execFile(
      cmd,
      args,
      { timeout: ms, killSignal: 'SIGKILL' },
      (err, out, errOut) =>
        resolve({
          err,
          out: String(out || '').trim(),
          errOut: String(errOut || '').trim(),
        })
    )
  )

export function host(url: string) {
  try {
    const u = new URL(url)
    return /^https?:$/.test(u.protocol)
      ? u.hostname.replace(/^www\./, '') || null
      : null
  } catch {
    return null
  }
}

let windows: typeof import('get-windows') | undefined

async function activeWindowApp(): Promise<FrontApp | null> {
  try {
    windows = windows || (await import('get-windows'))
    const w = await windows.activeWindow({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    })
    if (w && w.owner) {
      return {
        app: w.owner.name,
        bundle_id: 'bundleId' in w.owner ? w.owner.bundleId : null,
      }
    }
  } catch (e) {
    console.error('get-windows:', (e as Error).message)
  }
  return null
}

async function listedApp(): Promise<FrontApp | null> {
  const front = (await run('lsappinfo', ['front'], 1500)).out
  if (!front) {
    return null
  }
  const info = (
    await run(
      'lsappinfo',
      ['info', '-only', 'name', '-only', 'bundleid', front],
      1500
    )
  ).out
  const name = /^"([^"]+)"/.exec(info)
  const id = /bundleID="([^"]+)"/.exec(info)
  return name ? { app: name[1], bundle_id: id ? id[1] : null } : null
}

export async function readFrontApp(): Promise<FrontApp | null> {
  try {
    return (await activeWindowApp()) ?? (await listedApp())
  } catch (e) {
    console.error('readFrontApp:', (e as Error).message)
    return null
  }
}

const lastError: Record<string, string> = {}

export async function readDomain(b: Browser): Promise<DomainRead> {
  const r = await run(
    OSASCRIPT,
    [
      '-e',
      `tell application id "${b.id}" to get URL of ${b.tab} of front window`,
    ],
    1500
  )
  if (r.err) {
    const message = r.err.killed
      ? 'timeout'
      : r.errOut.split('\n')[0].slice(0, 160)
    if (!r.err.killed && lastError[b.name] !== message) {
      lastError[b.name] = message
      console.error('osascript', b.name + ':', message)
    }
    return {
      domain: null,
      denied: isAutomationDenied(r.errOut),
      failed: true,
    }
  }
  delete lastError[b.name]
  return { domain: host(r.out), denied: false, failed: false }
}
