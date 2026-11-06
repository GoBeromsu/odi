import { useSyncExternalStore } from 'react'
import type { Appearance } from '../shared/api.ts'
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings.ts'

const DARK = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

let current: Settings = DEFAULT_SETTINGS
let dark = false

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const settingsView = () => current

export function applySkin(settings: Settings) {
  const root = document.documentElement
  root.dataset.skin = settings.theme
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.material = settings.material
  if (settings.accent) {
    root.style.setProperty('--acc', settings.accent)
  } else {
    root.style.removeProperty('--acc')
  }
}

export function setSettingsView(next: Settings) {
  current = next
  applySkin(next)
  for (const listener of [...listeners]) {
    listener()
  }
}

export function setAppearance(next: Appearance) {
  dark = next.dark
  applySkin(current)
}

export function connectSkin(api: {
  settings: () => Promise<Settings>
  onSettings: (cb: (s: Settings) => void) => void
  appearance: () => Promise<Appearance>
  onAppearance: (cb: (a: Appearance) => void) => void
}) {
  api.onSettings(setSettingsView)
  api.onAppearance(setAppearance)
  const media = window.matchMedia(DARK)
  media.addEventListener('change', event => {
    setAppearance({ dark: event.matches })
  })
  dark = media.matches
  return Promise.all([
    api.appearance().then(setAppearance),
    api.settings().then(setSettingsView),
  ])
}

export function useSettings() {
  return useSyncExternalStore(subscribe, settingsView, settingsView)
}
