# Architecture Research

**Domain:** Electron desktop app wrapping a React/Vite web UI
**Researched:** 2026-05-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Electron Main Process                      │
│  ┌─────────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │   BrowserWindow  │  │  chokidar   │  │ Notification API │  │
│  │  (creates win)   │  │ FolderWatch │  │ (native alerts)  │  │
│  └────────┬────────┘  └──────┬──────┘  └────────┬─────────┘  │
│           │                  │                   │            │
│           └──────────────────┴───────────────────┘            │
│                              │ ipcMain                        │
├──────────────────────────────┼───────────────────────────────┤
│                     Preload Script                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   contextBridge.exposeInMainWorld('electronAPI', {...}) │  │
│  │   - onPdfQueued(callback)    - setWatchFolder(path)    │  │
│  │   - importPdfs(paths)        - sendNotification(...)   │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │ ipcRenderer (sandboxed)        │
├──────────────────────────────┼───────────────────────────────┤
│              Renderer Process (Vite bundle, unchanged)        │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   App.jsx    │  │  useStore.jsx     │  │  pdfParser.js │  │
│  │  (tabs/nav)  │  │ Context+Reducer   │  │ (pdfjs-dist)  │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────┬───────┘  │
│         │                   │                     │           │
│  ┌──────┴───────────────────┴─────────────────────┴───────┐  │
│  │              localStorage (budgetpulse_v1)               │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `main.js` | Create BrowserWindow, register ipcMain handlers, start chokidar watcher | Node.js, Electron APIs |
| `preload.js` | Bridge main↔renderer via contextBridge; expose typed API surface only | `contextBridge.exposeInMainWorld` |
| `src/store/useStore.jsx` | All app state; localStorage read/write; reducer actions | React Context + useReducer |
| `src/utils/pdfParser.js` | Parse bank PDFs to transaction objects; auto-categorize | pdfjs-dist (renderer-side) |
| `src/utils/scoring.js` | Compute 0–100 weekly score from transactions vs budgets | Pure functions |
| `src/utils/categorizer.js` | Keyword-match merchant names → 6 categories | Pure functions |
| `src/components/*` | UI screens: Dashboard, WeeklyRitual, Goals, History, SetupFlow | React components |
| electron-builder config | Bundle app → installers (NSIS/DMG/AppImage) | `electron-builder.yml` or `package.json` |

## Recommended Project Structure

```
budgeting_app/
├── electron/
│   ├── main.js            # Main process: BrowserWindow, ipcMain, chokidar, Notification
│   └── preload.js         # contextBridge API exposed to renderer
├── src/                   # Existing React app — untouched
│   ├── store/useStore.jsx
│   ├── utils/
│   ├── components/
│   ├── App.jsx
│   └── main.jsx
├── public/
├── dist/                  # Vite build output (renderer)
├── dist-electron/         # Compiled electron/ output (main process)
├── electron-builder.yml   # Packaging config
├── vite.config.js         # Extended with Electron renderer config
└── package.json           # Updated scripts + electron deps
```

### Structure Rationale

- **`electron/` at root:** Keeps main-process code completely separate from renderer source; prevents accidental imports of Node APIs in the renderer bundle.
- **`dist/` for renderer:** electron-builder points BrowserWindow to `dist/index.html` in production; `loadURL('http://localhost:5173')` in dev.
- **`dist-electron/` for main:** If using TypeScript or needing a compile step for main.js, output here. With plain JS, main.js can be referenced directly from `package.json#main`.
- **No changes to `src/`:** The entire React app is renderer-only code. Adding Electron means adding new files, not modifying existing ones.

## Architectural Patterns

### Pattern 1: Preload + contextBridge IPC (required)

**What:** The preload script runs in the renderer's JS context but has access to Node/Electron APIs before the page loads. `contextBridge.exposeInMainWorld` injects a typed API object into `window.electronAPI` that the React app can call.

**When to use:** Every time the renderer needs to call a main-process capability (file system, notifications, folder watcher control).

**Trade-offs:** Adds a small amount of boilerplate per IPC channel; eliminates XSS-to-RCE attack surface that `nodeIntegration: true` would create.

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setWatchFolder: (path) => ipcRenderer.invoke('set-watch-folder', path),
  onPdfQueued:    (cb)   => ipcRenderer.on('pdf-queued', (_e, paths) => cb(paths)),
  sendNotification: (title, body) => ipcRenderer.invoke('send-notification', title, body),
})
```

```javascript
// electron/main.js
ipcMain.handle('set-watch-folder', (_e, folderPath) => {
  startWatcher(folderPath)
})
ipcMain.handle('send-notification', (_e, title, body) => {
  new Notification({ title, body }).show()
})
```

### Pattern 2: Folder Watcher in Main Process

**What:** chokidar watches a user-designated directory in the main process. When a new `.pdf` file stabilizes (add + no further change within 500ms), main process sends a `pdf-queued` IPC event to the renderer with the file path.

**When to use:** Auto-import feature — user drops PDFs into their Downloads or a dedicated folder.

**Trade-offs:** Main process must read file bytes and send them to renderer (or renderer reads via `fetch('file://...')` if `webSecurity: false` — avoid this). Instead: main reads bytes, sends `Buffer`, renderer passes to `pdfParser.parsePDF()` via a synthetic `File` object.

```javascript
// electron/main.js
const chokidar = require('chokidar')

let watcher = null
function startWatcher(folderPath) {
  if (watcher) watcher.close()
  watcher = chokidar.watch(`${folderPath}/**/*.pdf`, { awaitWriteFinish: { stabilityThreshold: 500 } })
  watcher.on('add', (filePath) => {
    const bytes = fs.readFileSync(filePath)
    mainWindow.webContents.send('pdf-queued', { path: filePath, bytes: bytes.buffer })
  })
}
```

### Pattern 3: pdfjs-dist Worker Path Resolution

**What:** `pdfjs-dist` requires `GlobalWorkerOptions.workerSrc` to point to `pdf.worker.min.mjs`. In the browser this is a URL; in Electron's renderer it must be a file:// path or a bundled asset.

**When to use:** This must be handled before any PDF parsing happens.

**Trade-offs:** The current code uses `import.meta.url` which works in Vite dev mode. In the production Electron build, the worker file must be copied to the `dist/` folder and referenced with `__dirname`-relative path or a `protocol.registerFileProtocol` handler.

**Recommended approach:** Use `vite-plugin-static-copy` to copy `pdfjs-dist/build/pdf.worker.min.mjs` into `dist/pdf.worker.min.mjs` at build time, then set `workerSrc` to `new URL('./pdf.worker.min.mjs', import.meta.url).href`. This works in both dev and Electron production because Vite/Electron serve the dist folder as-is.

```javascript
// vite.config.js addition
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{
        src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
        dest: '.',
      }],
    }),
  ],
})
```

## Data Flow

### App Startup Flow

```
Electron main.js
    │
    ├─→ creates BrowserWindow (contextIsolation: true, nodeIntegration: false)
    │   └─→ loads dist/index.html (prod) or localhost:5173 (dev)
    │
    └─→ React app boots:
        └─→ StoreProvider initializes → load() reads localStorage
            └─→ AppShell renders (setup check → Dashboard or SetupFlow)
```

### PDF Auto-Import Flow

```
User drops PDF into watched folder
    │
    ↓
chokidar 'add' event (main process)
    │
    ↓
fs.readFileSync → Buffer → ipcRenderer.send('pdf-queued', bytes)
    │
    ↓
preload onPdfQueued callback fires (renderer)
    │
    ↓
PDFImporter component queues file for user review
    │
    ↓
User confirms → parsePDF() → dispatch IMPORT_TRANSACTIONS
    │
    ↓
State saved to localStorage
```

### Overspending Notification Flow

```
User adds/imports transaction (dispatch ADD_TRANSACTION or IMPORT_TRANSACTIONS)
    │
    ↓
useEffect in Dashboard computes categoryTotals
    │
    ↓
If any category total > budget → window.electronAPI.sendNotification(title, body)
    │
    ↓
ipcMain handler → new Notification({ title, body }).show()
    │
    ↓
OS native notification appears (no permission prompt needed)
```

### State Management

```
localStorage (budgetpulse_v1)
    ↓ (load on init)
useReducer(reducer, undefined, load)
    ↓ (useEffect on every state change)
localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

Components → dispatch(action) → reducer → new state → re-render
```

## Anti-Patterns

### Anti-Pattern 1: nodeIntegration: true

**What people do:** Enable `nodeIntegration: true` to avoid writing preload boilerplate — lets renderer import `fs`, `path`, etc. directly.

**Why it's wrong:** Any XSS vulnerability in the React app becomes arbitrary code execution on the user's machine. Electron's security docs explicitly forbid this for apps loading third-party content (even via `file://`).

**Do this instead:** Keep `nodeIntegration: false`, `contextIsolation: true`. Write a preload script that exposes exactly the operations needed, nothing more.

### Anti-Pattern 2: loadURL with webSecurity: false for file access

**What people do:** Disable web security to allow `fetch('file://...')` from the renderer, avoiding the need to send file bytes via IPC.

**Why it's wrong:** Disables CORS and same-origin protections. Opens the renderer to reading arbitrary files if any untrusted content is ever rendered.

**Do this instead:** Have the main process read files and send bytes via IPC. The renderer never touches the filesystem directly.

### Anti-Pattern 3: Forgetting awaitWriteFinish for the folder watcher

**What people do:** Listen on chokidar's `add` event immediately and try to parse the PDF.

**Why it's wrong:** Large PDFs copied into the folder trigger the `add` event before the file write is complete. Reading the file early produces a truncated or corrupt buffer.

**Do this instead:** Configure `awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }` so chokidar only fires after the file size has been stable for 500ms.

### Anti-Pattern 4: Using Web Notifications API instead of Electron's Notification

**What people do:** Call `new Notification(title, { body })` from the renderer (Web API).

**Why it's wrong:** Electron apps must request notification permission via the renderer just like a website. On macOS and Windows the user gets an OS permission prompt for a local app, which feels wrong and may be denied.

**Do this instead:** Call `window.electronAPI.sendNotification(title, body)` which routes to the main process where `new Notification({ title, body }).show()` fires without a permission prompt.

## Integration Points

### IPC Channel Design

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `set-watch-folder` | renderer → main | `string` (path) | User picks folder to watch |
| `pdf-queued` | main → renderer | `{ path: string, bytes: ArrayBuffer }` | New PDF detected by watcher |
| `send-notification` | renderer → main | `{ title: string, body: string }` | Trigger native OS notification |
| `get-app-version` | renderer → main | none | Display version in UI (optional) |

### Build Pipeline

```
vite build
    → dist/            (renderer: HTML + JS + CSS + pdf.worker.min.mjs)

electron-builder
    → reads dist/ as renderer
    → bundles electron/ as main process
    → produces:
        Windows: BudgetPulse-Setup-1.0.0.exe (NSIS)
        macOS:   BudgetPulse-1.0.0.dmg
        Linux:   BudgetPulse-1.0.0.AppImage
```

### Dev Workflow

```
Terminal 1: npm run dev          → Vite dev server on :5173
Terminal 2: npm run electron:dev → Electron loads localhost:5173
```

Main process must detect dev vs prod mode (e.g., `process.env.NODE_ENV === 'development'`) to switch between `loadURL('http://localhost:5173')` and `loadFile('dist/index.html')`.

## electron-builder Configuration

```yaml
# electron-builder.yml
appId: com.budgetpulse.app
productName: BudgetPulse
directories:
  output: release/
files:
  - dist/**
  - electron/**
  - package.json
win:
  target: nsis
  icon: public/icon.ico
mac:
  target: dmg
  icon: public/icon.icns
linux:
  target: AppImage
  icon: public/icon.png
```

Key constraint: `electron/main.js` must be referenced as `package.json#main` so electron-builder knows the entry point. The `dist/` folder (Vite output) is the renderer; `electron/` contains only main-process code.

## Sources

- Electron Security Best Practices (official docs): contextIsolation, nodeIntegration, preload scripts
- electron-builder documentation: multi-platform targets, file inclusion patterns
- chokidar README: `awaitWriteFinish` configuration for stable file detection
- pdfjs-dist: `GlobalWorkerOptions.workerSrc` configuration requirements
- Existing codebase: `src/store/useStore.jsx`, `src/utils/pdfParser.js`, `src/App.jsx`

---
*Architecture research for: BudgetPulse — Electron desktop wrapper*
*Researched: 2026-05-16*
