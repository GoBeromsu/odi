const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('ody', {
  state: () => ipcRenderer.invoke('state'),
  onState: cb => ipcRenderer.on('state', (_e, v) => cb(v)),
  start: () => ipcRenderer.invoke('start'),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  stop: () => ipcRenderer.invoke('stop'),
  sessions: () => ipcRenderer.invoke('sessions'),
  session: id => ipcRenderer.invoke('session', id),
  onEnded: cb => ipcRenderer.on('ended', (_e, id) => cb(id)),
  theme: () => ipcRenderer.invoke('theme'),
  setTheme: v => ipcRenderer.invoke('setTheme', v),
})
