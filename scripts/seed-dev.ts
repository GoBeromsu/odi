import path from 'node:path'
import { openStore, type Sample } from '../src/main/store.ts'

const APPS = [
  'Cursor',
  'Safari',
  'Terminal',
  'Figma',
  'Slack',
  'Notion',
  'Mail',
]

const BUNDLES: Record<string, string> = {
  Cursor: 'com.todesktop.cursor',
  Safari: 'com.apple.Safari',
  Terminal: 'com.apple.Terminal',
  Figma: 'com.figma.Desktop',
  Slack: 'com.tinyspeck.slackmacgap',
  Notion: 'notion.id',
  Mail: 'com.apple.mail',
}

const DOMAINS = ['github.com', 'linear.app', 'youtube.com', 'docs.google.com']

const DAYS = Number(process.env.ODY_SEED_DAYS ?? 120)

const target =
  process.argv[2] ??
  path.join(process.env.ODY_USER_DATA ?? process.cwd(), 'ody.db')

const midnight = (shift: number) => {
  const day = new Date()
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - shift)
  return day
}

const stream = (seed: number) => {
  let value = seed % 2147483646 || 7
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}

const store = openStore(target)

const add = (sample: Sample, start: number, end: number) => {
  store.heartbeat(sample, Math.round(start), 0)
  store.heartbeat(sample, Math.round(end), Math.round(end - start) + 1)
}

let events = 0
let sessions = 0

store.transact(() => {
  for (let back = DAYS - 1; back >= 0; back--) {
    const day = midnight(back)
    const base = day.getTime() / 1000
    const rnd = stream(Math.round(base / 86400))
    const weekend = day.getDay() % 6 === 0
    if (weekend && rnd() < 0.5) {
      continue
    }
    let at = base + 9 * 3600 + rnd() * 3600
    const close = base + (weekend ? 13 : 18.5) * 3600
    let focusStart: number | null = null
    while (at < close) {
      const length = (8 + rnd() * 70) * 60
      const idle = rnd() < 0.1
      const app = APPS[Math.floor(rnd() * rnd() * APPS.length)]
      const sample: Sample = idle
        ? { kind: 'idle', app: null, bundle_id: null, domain: null }
        : {
            kind: 'active',
            app,
            bundle_id: BUNDLES[app],
            domain:
              app === 'Safari'
                ? DOMAINS[Math.floor(rnd() * DOMAINS.length)]
                : null,
          }
      add(sample, at, at + length)
      events++
      if (!idle && app === 'Cursor' && length > 40 * 60) {
        if (focusStart === null) {
          focusStart = at
        }
        const started = Math.round(at)
        store.upsertSession({
          id: new Date(started * 1000).toISOString().replace(/[:.]/g, '-'),
          started_at: started,
          ended_at: Math.round(at + length),
          planned: 1500,
          paused_seconds: 0,
          overtime_seconds: Math.max(0, Math.round(length) - 1500),
          status: 'completed',
          kind: 'focus',
        })
        sessions++
      }
      at += length + (rnd() < 0.2 ? (30 + rnd() * 40) * 60 : 0)
    }
  }
})

store.close()

console.log(
  `seeded ${events} events and ${sessions} sessions over ${DAYS} days into ${target}`
)
