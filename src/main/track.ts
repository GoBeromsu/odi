import { execFile } from 'node:child_process'

interface Browser {
  id: string
  name: string
  tab: string
}
interface Front {
  app: string
  bundle_id: string | null
}
interface Run {
  err: (Error & { killed?: boolean }) | null
  out: string
  errOut: string
}

const BROWSER_BY_LOWERCASE_BUNDLE_ID: Record<string, Browser> = {
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

let gw: typeof import('get-windows') | undefined
async function frontApp(): Promise<Front | null> {
  try {
    gw = gw || (await import('get-windows'))
    const w = await gw.activeWindow({
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
  const front = (await run('lsappinfo', ['front'], 1500)).out
  const info = (
    await run(
      'lsappinfo',
      ['info', '-only', 'name', '-only', 'bundleid', front],
      1500
    )
  ).out
  const name = /^"([^"]+)"/.exec(info),
    id = /bundleID="([^"]+)"/.exec(info)
  return name ? { app: name[1], bundle_id: id ? id[1] : null } : null
}
function host(url: string) {
  try {
    const u = new URL(url)
    return /^https?:$/.test(u.protocol)
      ? u.hostname.replace(/^www\./, '') || null
      : null
  } catch {
    return null
  }
}

const lastErr: Record<string, string> = {}
async function domainOf(b: Browser) {
  const r = await run(
    'osascript',
    [
      '-e',
      `tell application id "${b.id}" to get URL of ${b.tab} of front window`,
    ],
    1500
  )
  if (r.err) {
    const msg = r.err.killed ? 'timeout' : r.errOut.split('\n')[0].slice(0, 120)
    if (!r.err.killed && lastErr[b.name] !== msg) {
      lastErr[b.name] = msg
      console.error('osascript', b.name + ':', msg)
    }
    return null
  }
  delete lastErr[b.name]
  return host(r.out)
}

async function readFront() {
  try {
    const a = await frontApp()
    if (!a) {
      return null
    }
    const b =
      a.bundle_id && BROWSER_BY_LOWERCASE_BUNDLE_ID[a.bundle_id.toLowerCase()]
    return { ...a, domain: b ? await domainOf(b) : null }
  } catch (e) {
    console.error('readFront:', (e as Error).message)
    return null
  }
}

export { readFront, host }
