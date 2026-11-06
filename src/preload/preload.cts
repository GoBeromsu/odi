import { contextBridge, ipcRenderer } from 'electron'
import type { OdyApi } from '../shared/api.ts'

const api: OdyApi = {
  state: () => ipcRenderer.invoke('state'),
  onState: cb => {
    ipcRenderer.on('state', (_e, v) => cb(v))
  },
  start: (mode, planned) => ipcRenderer.invoke('start', mode, planned),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  stop: () => ipcRenderer.invoke('stop'),
  sessions: (from, to) => ipcRenderer.invoke('sessions', from, to),
  health: () => ipcRenderer.invoke('health'),
  onHealth: cb => {
    ipcRenderer.on('health', (_e, h) => cb(h))
  },
  settings: () => ipcRenderer.invoke('settings'),
  patchSettings: changes => ipcRenderer.invoke('patchSettings', changes),
  onSettings: cb => {
    ipcRenderer.on('settings', (_e, s) => cb(s))
  },
  requestBrowserAuth: () => ipcRenderer.invoke('requestBrowserAuth'),
  language: () => ipcRenderer.invoke('language'),
  setLanguage: value => ipcRenderer.invoke('setLanguage', value),
  onLanguage: cb => {
    ipcRenderer.on('language-changed', (_e, view) => cb(view))
  },
}

contextBridge.exposeInMainWorld('ody', api)
