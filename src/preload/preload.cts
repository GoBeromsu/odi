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
}

contextBridge.exposeInMainWorld('ody', api)
