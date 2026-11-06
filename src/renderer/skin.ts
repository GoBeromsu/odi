import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings.ts'

const DARK = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

let current: Settings = DEFAULT_SETTINGS

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
  root.dataset.theme = window.matchMedia(DARK).matches ? 'dark' : 'light'
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

export function connectSkin(api: {
  settings: () => Promise<Settings>
  onSettings: (cb: (s: Settings) => void) => void
}) {
  api.onSettings(setSettingsView)
  window.matchMedia(DARK).addEventListener('change', () => applySkin(current))
  return api.settings().then(setSettingsView)
}

export function useSettings() {
  return useSyncExternalStore(subscribe, settingsView, settingsView)
}
