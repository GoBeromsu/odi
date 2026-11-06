import { contextBridge, ipcRenderer } from 'electron'
import type { OdyApi } from '../shared/api.ts'

const api: OdyApi = {
  state: () => ipcRenderer.invoke('state'),
  onState: cb => {
    ipcRenderer.on('state', (_e, v) => cb(v))
  },
  openActivity: tab => ipcRenderer.invoke('openActivity', tab),
  showPopover: () => ipcRenderer.invoke('showPopover'),
  onSheet: cb => {
    ipcRenderer.on('open-sheet', () => cb())
  },
  onActivityTab: cb => {
    ipcRenderer.on('activity-tab', (_e, tab) => cb(tab))
  },
  start: (mode, planned) => ipcRenderer.invoke('start', mode, planned),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  stop: () => ipcRenderer.invoke('stop'),
  sessions: (from, to) => ipcRenderer.invoke('sessions', from, to),
  events: (from, to) => ipcRenderer.invoke('events', from, to),
  totals: (from, to) => ipcRenderer.invoke('totals', from, to),
  recordedDays: (from, to) => ipcRenderer.invoke('recordedDays', from, to),
  health: () => ipcRenderer.invoke('health'),
  onHealth: cb => {
    ipcRenderer.on('health', (_e, h) => cb(h))
  },
  settings: () => ipcRenderer.invoke('settings'),
  patchSettings: changes => ipcRenderer.invoke('patchSettings', changes),
  onSettings: cb => {
    ipcRenderer.on('settings', (_e, s) => cb(s))
  },
  appearance: () => ipcRenderer.invoke('appearance'),
  onAppearance: cb => {
    ipcRenderer.on('appearance', (_e, a) => cb(a))
  },
  requestBrowserAuth: () => ipcRenderer.invoke('requestBrowserAuth'),
  openPrivacy: () => ipcRenderer.invoke('openPrivacy'),
  language: () => ipcRenderer.invoke('language'),
  setLanguage: value => ipcRenderer.invoke('setLanguage', value),
  onLanguage: cb => {
    ipcRenderer.on('language-changed', (_e, view) => cb(view))
  },
}

contextBridge.exposeInMainWorld('ody', api)
