'use strict'
const { execFile } = require('child_process')
const BROWSER_BY_LOWERCASE_BUNDLE_ID = {
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

const run = (cmd, args, ms) =>
  new Promise(resolve =>
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

let gw
async function frontApp() {
  try {
    gw = gw || (await import('get-windows'))
    const w = await gw.activeWindow({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    })
    if (w && w.owner) return { app: w.owner.name, bundle_id: w.owner.bundleId }
  } catch (e) {
    console.error('get-windows:', e.message)
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
function host(url) {
  try {
    const u = new URL(url)
    return /^https?:$/.test(u.protocol)
      ? u.hostname.replace(/^www\./, '') || null
      : null
  } catch {
    return null
  }
}

const lastErr = {}
async function domainOf(b) {
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
    if (!a) return null
    const b =
      a.bundle_id && BROWSER_BY_LOWERCASE_BUNDLE_ID[a.bundle_id.toLowerCase()]
    return { ...a, domain: b ? await domainOf(b) : null }
  } catch (e) {
    console.error('readFront:', e.message)
    return null
  }
}

module.exports = { readFront, host }
