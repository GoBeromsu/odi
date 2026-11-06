export type Skin = 'ambient' | 'fukasawa' | 'ataraxia' | 'graphite'
export type ColorMode = 'system' | 'light' | 'dark'
export type Material = 'glass' | 'solid'
export type Dial = 'disc' | 'segment' | 'movement'
export type AtEnd = 'overtime' | 'stop'
export type BrowserAuth = 'unknown' | 'granted' | 'denied'
export type Language = 'system' | 'ko' | 'en'
export type Sound = 'none' | 'glass' | 'tink' | 'pop'

export interface Settings {
  focusMinutes: number
  breakMinutes: number
  atEnd: AtEnd
  suggestBreak: boolean
  sound: Sound
  autoBreakMinutes: number
  idleSeconds: number
  browserConsent: boolean
  browserAuth: BrowserAuth
  idleExempt: string[]
  excludedApps: string[]
  theme: Skin
  accent: string | null
  mode: ColorMode
  material: Material
  dial: Dial
  language: Language
  launchAtLogin: boolean
  menuBarTime: boolean
  focusShortcut: string
  onboarded: boolean
}

export const SKINS: readonly Skin[] = [
  'ambient',
  'fukasawa',
  'ataraxia',
  'graphite',
]
export const COLOR_MODES: readonly ColorMode[] = ['system', 'light', 'dark']
export const MATERIALS: readonly Material[] = ['glass', 'solid']
export const DIALS: readonly Dial[] = ['disc', 'segment', 'movement']
export const AT_END: readonly AtEnd[] = ['overtime', 'stop']
export const BROWSER_AUTHS: readonly BrowserAuth[] = [
  'unknown',
  'granted',
  'denied',
]
export const LANGUAGES: readonly Language[] = ['system', 'ko', 'en']
export const SOUNDS: readonly Sound[] = ['none', 'glass', 'tink', 'pop']

export const FOCUS_MINUTE_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 50, 60, 90]
export const BREAK_MINUTE_OPTIONS = [3, 5, 10, 15, 20, 30]
export const IDLE_SECOND_OPTIONS = [60, 180, 300]
export const AUTO_BREAK_MINUTE_OPTIONS = [5, 10, 15, 20, 30]
export const ACCENT_OPTIONS = [
  '#00c2a8',
  '#5b84ff',
  '#8e4ec6',
  '#d0352b',
  '#a52142',
  '#f5a524',
  '#30a46c',
]

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  breakMinutes: 5,
  atEnd: 'overtime',
  suggestBreak: true,
  sound: 'glass',
  autoBreakMinutes: 10,
  idleSeconds: 180,
  browserConsent: false,
  browserAuth: 'unknown',
  idleExempt: [],
  excludedApps: [],
  theme: 'ambient',
  accent: null,
  mode: 'system',
  material: 'glass',
  dial: 'disc',
  language: 'system',
  launchAtLogin: false,
  menuBarTime: true,
  focusShortcut: 'Alt+Space',
  onboarded: false,
}

const member = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T => (allowed.includes(value as T) ? (value as T) : fallback)

const bounded = (
  value: unknown,
  low: number,
  high: number,
  fallback: number
) => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= low && n <= high ? n : fallback
}

const flag = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback

const names = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((x): x is string => typeof x === 'string'))]
    : []

const accentOf = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : null

const shortcutOf = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 40
    ? value
    : DEFAULT_SETTINGS.focusShortcut

export function coerceSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    focusMinutes: bounded(r.focusMinutes, 1, 180, d.focusMinutes),
    breakMinutes: bounded(r.breakMinutes, 1, 120, d.breakMinutes),
    atEnd: member(r.atEnd, AT_END, d.atEnd),
    suggestBreak: flag(r.suggestBreak, d.suggestBreak),
    sound: member(r.sound, SOUNDS, d.sound),
    autoBreakMinutes: bounded(r.autoBreakMinutes, 1, 120, d.autoBreakMinutes),
    idleSeconds: bounded(r.idleSeconds, 30, 3600, d.idleSeconds),
    browserConsent: flag(r.browserConsent, d.browserConsent),
    browserAuth: member(r.browserAuth, BROWSER_AUTHS, d.browserAuth),
    idleExempt: names(r.idleExempt),
    excludedApps: names(r.excludedApps),
    theme: member(r.theme, SKINS, d.theme),
    accent: accentOf(r.accent),
    mode: member(r.mode, COLOR_MODES, d.mode),
    material: member(r.material, MATERIALS, d.material),
    dial: member(r.dial, DIALS, d.dial),
    language: member(r.language, LANGUAGES, d.language),
    launchAtLogin: flag(r.launchAtLogin, d.launchAtLogin),
    menuBarTime: flag(r.menuBarTime, d.menuBarTime),
    focusShortcut: shortcutOf(r.focusShortcut),
    onboarded: flag(r.onboarded, d.onboarded),
  }
}
