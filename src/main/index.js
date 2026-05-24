import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join } from 'path'
import chokidar from 'chokidar'
import { readFile } from 'fs/promises'

// Required on Linux: AppImage chrome-sandbox is not setuid root
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow = null
let watcher = null

// Windows: set AUMID so notifications work (must be before app.whenReady)
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName())
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 840,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIPC() {
  // Folder picker dialog
  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Start watching a folder for new PDFs
  ipcMain.handle('watch-folder', async (_event, folderPath) => {
    if (typeof folderPath !== 'string') return false
    if (watcher) await watcher.close()
    watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
    })
    watcher.on('add', async (filePath) => {
      if (!filePath.toLowerCase().endsWith('.pdf')) return
      try {
        const buffer = await readFile(filePath)
        mainWindow.webContents.send('pdf-detected', {
          path: filePath,
          buffer: buffer.buffer,
        })
      } catch (err) {
        console.error('Failed to read PDF from watched folder:', err)
      }
    })
    return true
  })

  // Stop watcher
  ipcMain.handle('unwatch-folder', async () => {
    if (watcher) {
      await watcher.close()
      watcher = null
    }
  })

  // Show native OS notification (rate-limited: one per title per 60s)
  const notifCooldowns = new Map()
  ipcMain.on('show-notification', (_event, { title, body }) => {
    if (!Notification.isSupported()) return
    const now = Date.now()
    const last = notifCooldowns.get(title) || 0
    if (now - last < 60_000) return
    notifCooldowns.set(title, now)
    new Notification({ title, body, silent: false }).show()
  })
}

app.whenReady().then(() => {
  createWindow()
  setupIPC()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
