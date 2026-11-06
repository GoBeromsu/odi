import type { Locale } from './i18n/index.ts'
import type { Mode, Phase } from './session.ts'
import type { BrowserAuth, Language, Settings } from './settings.ts'

export type { Mode, Phase }

export type ActivityTab = 'focus' | 'time' | 'settings'

export type HealthState = 'recording' | 'paused' | 'error'
export type HealthReason = 'automation-denied' | 'tracker-failed'

export interface Health {
  state: HealthState
  reason?: HealthReason
}

export interface Appearance {
  dark: boolean
}

export interface LanguageView {
  setting: Language
  system: Locale
  locale: Locale
}

export interface View {
  phase: Phase
  mode: Mode
  planned: number
  remaining: number
  overtime?: number
}

export type EventKind = 'active' | 'idle' | 'away'

export interface ActivityEvent {
  id: number
  start: number
  end: number
  kind: EventKind
  app: string | null
  bundle_id: string | null
  domain: string | null
}

export interface SiteTotal {
  domain: string
  seconds: number
}

export interface AppTotal {
  app: string | null
  bundle_id: string | null
  seconds: number
  sites: SiteTotal[]
}

export interface SessionRecord {
  id: string
  started_at: number
  ended_at: number | null
  planned: number
  paused_seconds: number
  overtime_seconds: number
  status: string
  kind: string
}

export interface OdyApi {
  state: () => Promise<View>
  onState: (cb: (v: View) => void) => void
  openActivity: (tab?: ActivityTab) => Promise<void>
  showPopover: () => Promise<void>
  onSheet: (cb: () => void) => void
  onActivityTab: (cb: (tab: ActivityTab) => void) => void
  start: (mode: Mode, planned?: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  sessions: (from: number, to: number) => Promise<SessionRecord[]>
  events: (from: number, to: number) => Promise<ActivityEvent[]>
  totals: (from: number, to: number) => Promise<AppTotal[]>
  recordedDays: (from: number, to: number) => Promise<string[]>
  health: () => Promise<Health>
  onHealth: (cb: (h: Health) => void) => void
  settings: () => Promise<Settings>
  patchSettings: (changes: Partial<Settings>) => Promise<Settings>
  onSettings: (cb: (s: Settings) => void) => void
  appearance: () => Promise<Appearance>
  onAppearance: (cb: (a: Appearance) => void) => void
  requestBrowserAuth: () => Promise<BrowserAuth>
  openPrivacy: () => Promise<void>
  language: () => Promise<LanguageView>
  setLanguage: (value: Language) => Promise<LanguageView>
  onLanguage: (cb: (view: LanguageView) => void) => void
}
