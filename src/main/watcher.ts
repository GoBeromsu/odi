import type { Health, HealthReason } from '../shared/api.ts'
import type { Settings } from '../shared/settings.ts'
import type { Sample, Store } from './store.ts'
import type { Browser, DomainRead, FrontApp } from './track.ts'

export const PULSE = 2
export const NULL_FRONT_LIMIT = 5

export interface WatcherDeps {
  store: Pick<Store, 'heartbeat' | 'boundary' | 'closeCrashGap'>
  settings: () => Settings
  patch: (changes: Partial<Settings>) => void
  readFrontApp: () => Promise<FrontApp | null>
  readDomain: (b: Browser) => Promise<DomainRead>
  browserFor: (bundleId: string | null) => Browser | null
  idleSeconds: () => number
  now: () => number
  onHealth?: (health: Health) => void
  pulse?: number
}

const named = (front: FrontApp, name: string) => {
  const needle = name.trim().toLowerCase()
  return (
    needle.length > 0 &&
    (front.app.toLowerCase() === needle ||
      (front.bundle_id ?? '').toLowerCase() === needle)
  )
}

export function createWatcher(deps: WatcherDeps) {
  const pulse = deps.pulse ?? PULSE
  let fault: HealthReason | null = null
  let awayStart: number | null = null
  let nullFronts = 0
  let busy = false
  let loop: NodeJS.Timeout | undefined

  const health = (): Health => {
    if (fault) {
      return { state: 'error', reason: fault }
    }
    return awayStart === null ? { state: 'recording' } : { state: 'paused' }
  }

  let announced = JSON.stringify(health())
  const announce = () => {
    const next = JSON.stringify(health())
    if (next !== announced) {
      announced = next
      deps.onHealth?.(health())
    }
  }

  const fail = (reason: HealthReason) => {
    fault = reason
    announce()
  }

  const kindOf = (settings: Settings, front: FrontApp): Sample['kind'] => {
    const exempt = settings.idleExempt.some(name => named(front, name))
    return !exempt && deps.idleSeconds() >= settings.idleSeconds
      ? 'idle'
      : 'active'
  }

  const leave = (at: number) => {
    if (awayStart === null) {
      awayStart = Math.floor(at)
    }
    announce()
  }

  const arrive = (at: number) => {
    const end = Math.floor(at)
    if (awayStart !== null) {
      if (end > awayStart) {
        deps.store.boundary('away', awayStart, end)
      }
      awayStart = null
    }
    announce()
  }

  const tick = async () => {
    if (busy || awayStart !== null) {
      return
    }
    busy = true
    try {
      const settings = deps.settings()
      if (fault === 'automation-denied' && settings.browserAuth === 'granted') {
        fault = null
      }
      const front = await deps.readFrontApp()
      if (!front) {
        nullFronts += 1
        if (nullFronts >= NULL_FRONT_LIMIT) {
          fail('tracker-failed')
        }
        return
      }
      nullFronts = 0
      if (fault === 'tracker-failed') {
        fault = null
      }
      if (settings.excludedApps.some(name => named(front, name))) {
        announce()
        return
      }
      const sample: Sample = {
        kind: kindOf(settings, front),
        app: front.app,
        bundle_id: front.bundle_id,
        domain: null,
      }
      const browser = deps.browserFor(front.bundle_id)
      if (
        browser &&
        settings.browserConsent &&
        settings.browserAuth === 'granted'
      ) {
        const read = await deps.readDomain(browser)
        if (read.denied) {
          deps.patch({ browserAuth: 'denied' })
          fault = 'automation-denied'
        } else {
          sample.domain = read.domain
        }
      }
      deps.store.heartbeat(sample, Math.floor(deps.now()), pulse)
      announce()
    } finally {
      busy = false
    }
  }

  return {
    health,
    tick,
    suspend: leave,
    lock: leave,
    resume: arrive,
    unlock: arrive,
    closeCrashGap: () =>
      deps.store.closeCrashGap(Math.floor(deps.now()), pulse),
    start: () => {
      if (loop) {
        return
      }
      deps.store.closeCrashGap(Math.floor(deps.now()), pulse)
      loop = setInterval(() => {
        void tick()
      }, 1000)
      void tick()
    },
    stop: () => {
      clearInterval(loop)
      loop = undefined
    },
  }
}

export type Watcher = ReturnType<typeof createWatcher>
