import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder management (for chokidar watcher)
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  watchFolder: (path) => ipcRenderer.invoke('watch-folder', path),
  unwatchFolder: () => ipcRenderer.invoke('unwatch-folder'),

  // Receive PDF detection events pushed from main process
  onPdfDetected: (callback) => {
    ipcRenderer.on('pdf-detected', (_event, data) => callback(data))
  },
  offPdfDetected: () => {
    ipcRenderer.removeAllListeners('pdf-detected')
  },

  // Fire native OS notification via main process
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body })
  },
})
