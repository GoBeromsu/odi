import { execFile } from 'node:child_process'
import type { BrowserAuth, Settings } from '../shared/settings.ts'
import {
  browserById,
  readDomain as readBrowserDomain,
  SUPPORTED_BROWSERS,
  type Browser,
  type DomainRead,
} from './track.ts'

export interface AuthIo {
  settings: () => Settings
  patch: (changes: Partial<Settings>) => void
  readDomain?: (b: Browser) => Promise<DomainRead>
  browsers?: () => Promise<Browser[]>
}

const installed = (id: string) =>
  new Promise<boolean>(resolve =>
    execFile(
      'mdfind',
      [`kMDItemCFBundleIdentifier == '${id}'`],
      { timeout: 3000, killSignal: 'SIGKILL' },
      (err, out) => resolve(!err && String(out || '').trim().length > 0)
    )
  )

export async function installedBrowsers(): Promise<Browser[]> {
  const seam = process.env.ODY_BROWSERS
  if (seam) {
    return seam
      .split(',')
      .map(id => browserById(id.trim()))
      .filter((b): b is Browser => b !== null)
  }
  const known = Object.values(SUPPORTED_BROWSERS)
  const present = await Promise.all(known.map(b => installed(b.id)))
  return known.filter((_b, i) => present[i])
}

export async function requestBrowserAuth(io: AuthIo): Promise<BrowserAuth> {
  const ask = io.readDomain ?? readBrowserDomain
  const list = io.browsers ?? installedBrowsers
  io.patch({ browserConsent: true })
  const browsers = await list()
  let denied = false
  for (const browser of browsers) {
    const read = await ask(browser)
    if (read.denied) {
      denied = true
    }
  }
  const auth: BrowserAuth = denied ? 'denied' : 'granted'
  io.patch({ browserAuth: auth })
  return auth
}
