import { useSyncExternalStore } from 'react'
import type { LanguageView } from '../shared/api.ts'
import {
  fmtDate,
  fmtDuration,
  fmtRelativeDay,
  t,
  type DateStyle,
  type MessageKey,
  type Vars,
} from '../shared/i18n/index.ts'

const listeners = new Set<() => void>()

let current: LanguageView = { setting: 'system', system: 'en', locale: 'en' }

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const languageView = () => current

export function setLanguageView(next: LanguageView) {
  current = next
  for (const listener of [...listeners]) {
    listener()
  }
}

export function connectLanguage(api: {
  language: () => Promise<LanguageView>
  onLanguage: (cb: (view: LanguageView) => void) => void
}) {
  api.onLanguage(setLanguageView)
  return api.language().then(setLanguageView)
}

export function useT() {
  const view = useSyncExternalStore(subscribe, languageView, languageView)
  return {
    locale: view.locale,
    setting: view.setting,
    system: view.system,
    t: (key: MessageKey, vars?: Vars) => t(view.locale, key, vars),
    duration: (seconds: number) => fmtDuration(view.locale, seconds),
    date: (date: Date, style?: DateStyle) => fmtDate(view.locale, date, style),
    relativeDay: (date: Date, today?: Date) =>
      fmtRelativeDay(view.locale, date, today),
  }
}
