import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join } from 'path'
import { createRequire } from 'module'
import chokidar from 'chokidar'
import { readFile } from 'fs/promises'
import { parseTransactions, extractText } from '../utils/pdfParser.js'

const _require = createRequire(import.meta.url)

let pdfjsLib = null
async function getMainPdfjs() {
  if (pdfjsLib) return pdfjsLib
  // Use the legacy build — pdfjs-dist itself recommends this for Node.js environments.
  // The browser build references DOMMatrix at module level which doesn't exist in Node.js.
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Resolve the matching legacy worker so pdfjs can run extraction off the main thread.
  // createRequire resolves inside the asar transparently in packaged Electron builds.
  const workerPath = _require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  mod.GlobalWorkerOptions.workerSrc = new URL(`file://${workerPath}`).toString()
  pdfjsLib = mod
  return mod
}

async function parsePdfBuffer(buffer) {
  const pdfjs = await getMainPdfjs()
  const data = buffer instanceof Buffer ? buffer : Buffer.from(buffer)
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableRange: true,
    disableStream: true,
  }).promise
  const text = await extractText(pdf)
  if (text.trim().length < 80) throw new Error('IMAGE_BASED')
  return parseTransactions(text)
}

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
      preload: join(__dirname, '../preload/index.mjs'),
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

  // Parse a PDF buffer in the main process (no browser worker needed)
  ipcMain.handle('parse-pdf', async (_event, buffer) => {
    return parsePdfBuffer(buffer)
  })

  // Start watching a folder for new PDFs — parse in main, send transactions to renderer
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
        const txs = await parsePdfBuffer(buffer)
        mainWindow.webContents.send('pdf-detected', { txs, path: filePath })
      } catch (err) {
        console.error('Failed to parse PDF from watched folder:', err)
        mainWindow.webContents.send('pdf-detected', { error: err.message, path: filePath })
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
