# Phase 1: Electron Desktop + Smart Features - Research

**Researched:** 2026-05-16
**Domain:** Electron (electron-vite), chokidar file watching, IPC, native notifications, electron-builder packaging
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-001 | Wrap existing React/Vite app in Electron using electron-vite. Ship as .exe, .dmg, .AppImage/.deb. No system deps. | electron-vite 5.0 + electron-builder 26.x confirmed. Custom renderer.root config covers existing src/ layout. |
| REQ-002 | Folder watcher: user configures a local path; new .pdf files trigger parsing via existing pdfParser, show confirmation, import approved transactions. Cross-platform. | chokidar 5 in main process + ipcMain.handle / ipcRenderer.invoke bridge. dialog.showOpenDialog for folder picker. |
| REQ-003 | Goal target date weekly savings: display "Save $X/week to reach by [date]". Warn on-track vs behind. | Pure JS calculation: (target - saved) / weeksRemaining. Edge cases documented. Existing getGoalETA already has skeleton. |
| REQ-004 | Native OS overspending notification: fires when category exceeds weekly budget. Shows category, amount over, remaining. | Electron Notification class in main process via IPC. Notification.isSupported() guard required. Windows needs app.setAppUserModelId(). |
</phase_requirements>

---

## Summary

The existing React/Vite/Tailwind v4 web app is a near-perfect candidate for electron-vite migration because electron-vite's renderer config accepts any Vite project as input — the existing `src/` directory, `index.html`, and all components remain untouched. The key structural change is adding two new source directories (`src/main/` for the Electron main process and `src/preload/` for the IPC bridge) alongside the existing web sources, and replacing `vite.config.js` with `electron.vite.config.js`.

The IPC security model is well understood: `contextIsolation: true` (Electron default since v12), `nodeIntegration: false` (Electron default), and a preload script that exposes a narrow `window.electronAPI` surface via `contextBridge.exposeInMainWorld`. The chokidar watcher runs exclusively in the main process and forwards `pdf-detected` events to the renderer via `mainWindow.webContents.send()`. The renderer dispatches the `IMPORT_TRANSACTIONS` action on user confirmation — no changes to the reducer or localStorage layer.

The most important gotcha in this phase is the `pdfjs-dist` worker path. The existing code uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` which Vite bundles correctly in renderer mode, but in a packaged ASAR the resolved `file://` URL must point inside the ASAR archive. The recommended fix is to copy the worker `.mjs` file to the renderer `public/` directory and set `workerSrc` to the relative path (`'./pdf.worker.min.mjs'`), bypassing `import.meta.url` resolution entirely in production. The existing `pdfParser.js` lazy-loads pdfjs — this one line changes and everything else stays the same.

**Primary recommendation:** Add `src/main/index.js` + `src/preload/index.js`, replace `vite.config.js` with `electron.vite.config.js`, update `package.json` scripts and `"main"` field, copy the pdfjs worker to `public/`, and add `electron-builder.yml`. All existing React components, the store, and CSS stay as-is.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folder watching | Electron Main | — | Requires Node.js fs events; renderer is sandboxed |
| PDF parsing (pdfjs-dist) | Electron Renderer | — | Already works in browser context; no Node APIs needed |
| PDF file reading (from watched path) | Electron Main | — | Main reads file bytes via `fs.readFile`, sends ArrayBuffer over IPC |
| Native OS notifications | Electron Main | — | `Notification` class is Main-process-only |
| Overspending detection logic | Electron Renderer | Electron Main (trigger) | Renderer knows budget state; sends IPC to main to fire notification |
| Folder path storage / settings | Electron Renderer | — | Stored in existing localStorage; no separate electron-store needed |
| Goal weekly savings calculation | Electron Renderer | — | Pure date math, no OS APIs; lives in `recommendations.js` |
| Packaging / distribution | electron-builder | — | Post-build step; not an architectural tier |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-vite | 5.0.0 | Build tool wrapping Vite + Electron | Official first-party tool; handles main/preload/renderer split, HMR, ASAR output |
| electron | 42.1.0 | Runtime Chromium + Node.js shell | Ships Chromium — zero system browser deps on any OS |
| chokidar | 5.0.0 | Cross-platform file watching in main process | De facto standard (used by Vite, webpack, Parcel); pure JS in v5, no native addons |
| electron-builder | 26.8.1 | Packaging: .exe (NSIS), .dmg, .AppImage, .deb | Single tool for all three platforms; electron-vite docs reference it directly |

[VERIFIED: npm registry — all versions confirmed 2026-05-16]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron-toolkit/preload | latest | Typed `electronAPI` helper for preload scripts | Optional — reduces boilerplate, provides `ipcRenderer` typings |
| date-fns | 4.1.0 | Week/day arithmetic for goal savings calc | Already installed; use `differenceInCalendarWeeks`, `parseISO` |

[VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | vite-plugin-electron | electron-vite is the mature/maintained fork; vite-plugin-electron is lower-level and requires more manual config |
| electron-builder | electron-forge | electron-forge is opinionated and harder to bolt onto an existing project; electron-builder is config-file-driven |
| chokidar | fs.watch (Node built-in) | fs.watch is unreliable on macOS (no recursive support), missing on older Linux kernels; chokidar normalizes all of this |

**Installation:**
```bash
npm install electron electron-vite electron-builder chokidar --save-dev
```

Note: `electron`, `electron-builder`, and `electron-vite` all go in `devDependencies` because they are build/packaging tools, not runtime dependencies shipped inside the app bundle. `chokidar` should also be in `devDependencies` if you want electron-vite to bundle it into the main process output (the default behavior for devDeps is to bundle them). If placed in `dependencies`, electron-vite will externalize it and electron-builder must include it — either works but bundling is cleaner.

**Version verification:** [VERIFIED: npm view electron-vite version → 5.0.0, npm view electron version → 42.1.0, npm view chokidar version → 5.0.0, npm view electron-builder version → 26.8.1, 2026-05-16]

---

## Architecture Patterns

### System Architecture Diagram

```
User drops PDF into watched folder
         │
         ▼
[chokidar watcher] ── 'add' event ──► [Main Process: ipcMain]
  (src/main/index.js)                        │
                                             │ fs.readFile(path)
                                             │ → ArrayBuffer
                                             │
                                  mainWindow.webContents.send('pdf-detected', {path, buffer})
                                             │
                                             ▼
                              [Preload: contextBridge] exposes window.electronAPI
                                             │
                                             ▼
                              [Renderer: React component] receives 'pdf-detected'
                                             │
                                    parsePDF(buffer) → transactions[]
                                             │
                                   User confirms in modal
                                             │
                              dispatch(IMPORT_TRANSACTIONS)
                                             │
                                             ▼
                                      localStorage

─────────────────────────────────────────────────────────────────────

User adds transaction that exceeds budget
         │
         ▼
[Renderer: AddTransaction] calculates overspend
         │
         │ window.electronAPI.notify({title, body})
         ▼
[Preload: contextBridge] → ipcRenderer.send('show-notification', {title, body})
         │
         ▼
[Main Process: ipcMain.on('show-notification')] 
         │
         └─► new Notification({title, body}).show()  [native OS]
```

### Recommended Project Structure

```
budgeting_app/
├── src/
│   ├── main/
│   │   └── index.js         # Electron main process (new)
│   ├── preload/
│   │   └── index.js         # contextBridge IPC bridge (new)
│   ├── App.jsx              # UNCHANGED — existing React root
│   ├── index.css            # UNCHANGED — Tailwind v4 + custom props
│   ├── main.jsx             # UNCHANGED — React entry point
│   ├── store/
│   │   └── useStore.jsx     # UNCHANGED
│   ├── utils/
│   │   ├── pdfParser.js     # SMALL CHANGE: workerSrc path only
│   │   ├── categorizer.js   # UNCHANGED
│   │   ├── recommendations.js  # SMALL CHANGE: add weeklyRequired calc
│   │   └── scoring.js       # UNCHANGED
│   └── components/
│       ├── Goals.jsx        # SMALL CHANGE: display weeklyRequired
│       ├── PDFImporter.jsx  # SMALL CHANGE: add IPC-triggered import path
│       └── ... (all others UNCHANGED)
├── public/
│   └── pdf.worker.min.mjs   # COPY from node_modules/pdfjs-dist/build/
├── index.html               # UNCHANGED
├── electron.vite.config.js  # NEW — replaces vite.config.js
├── electron-builder.yml     # NEW
├── package.json             # UPDATED: scripts, "main" field
└── vite.config.js           # DELETE (replaced by electron.vite.config.js)
```

### Pattern 1: electron.vite.config.js for Existing src/ Layout

The existing project has React sources directly in `src/` (not `src/renderer/`). The `renderer.root` must be set to `'.'` and input specified explicitly.

```javascript
// electron.vite.config.js
// Source: https://electron-vite.org/guide/dev (customizing structure)
import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js'),
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [tailwindcss(), react()],
  },
})
```

[VERIFIED: Context7 /alex8088/electron-vite-docs + https://electron-vite.org/guide/dev]

### Pattern 2: Electron Main Process Entry (src/main/index.js)

```javascript
// src/main/index.js
// Source: https://www.electronjs.org/docs/latest/tutorial/ipc
import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join } from 'path'
import chokidar from 'chokidar'
import { readFile } from 'fs/promises'

let mainWindow = null
let watcher = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 840,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,      // default true in Electron 12+
      nodeIntegration: false,       // default false
      sandbox: false,               // required so preload can import Node modules
    },
  })

  // Dev: load from Vite dev server; Prod: load built file
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Windows: set AUMID so notifications work during dev
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName())
}

app.whenReady().then(() => {
  createWindow()
  setupIPC()
})

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
    if (watcher) await watcher.close()
    watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: true,             // don't fire for files already there
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
    })
    watcher.on('add', async (filePath) => {
      if (!filePath.toLowerCase().endsWith('.pdf')) return
      try {
        const buffer = await readFile(filePath)
        mainWindow.webContents.send('pdf-detected', {
          path: filePath,
          buffer: buffer.buffer,       // send as ArrayBuffer
        })
      } catch (err) {
        console.error('Failed to read PDF:', err)
      }
    })
    return true
  })

  // Stop watcher
  ipcMain.handle('unwatch-folder', async () => {
    if (watcher) { await watcher.close(); watcher = null }
  })

  // Show native notification
  ipcMain.on('show-notification', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

[VERIFIED: Context7 /websites/electronjs — ipcMain.handle, Notification, dialog.showOpenDialog, BrowserWindow webPreferences]

### Pattern 3: Preload Script (src/preload/index.js)

```javascript
// src/preload/index.js
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder management
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  watchFolder: (path) => ipcRenderer.invoke('watch-folder', path),
  unwatchFolder: () => ipcRenderer.invoke('unwatch-folder'),

  // Receive PDF detection events from main
  onPdfDetected: (callback) => {
    ipcRenderer.on('pdf-detected', (_event, data) => callback(data))
  },
  offPdfDetected: () => {
    ipcRenderer.removeAllListeners('pdf-detected')
  },

  // Fire native notification
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body })
  },
})
```

[VERIFIED: Context7 /alex8088/electron-vite-docs — contextBridge.exposeInMainWorld pattern]

### Pattern 4: Goal Weekly Savings Calculation

```javascript
// src/utils/recommendations.js — add this function
// (target - saved) / weeks_remaining formula
export function getWeeklyRequired(goal) {
  if (!goal.targetDate) return null
  const now = new Date()
  const target = new Date(goal.targetDate)
  if (target <= now) return null  // date passed — can't calculate

  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksRemaining = Math.max(1, (target - now) / msPerWeek)
  const remaining = goal.target - (goal.saved || 0)
  if (remaining <= 0) return 0   // already funded

  return remaining / weeksRemaining  // exact float; caller rounds for display
}

// In GoalCard, determine status:
// const weeklyRequired = getWeeklyRequired(goal)
// const avgWeeklySavings = /* from weeklyHistory */
// const onTrack = weeklyRequired !== null && avgWeeklySavings >= weeklyRequired
```

[ASSUMED] — The formula is straightforward but the "on-track vs behind" threshold for amber/green is not specified in requirements; the assumption is `avgWeeklySavings >= weeklyRequired` = green, otherwise amber. This matches the existing `onTrack` pattern in `getGoalETA`.

### Pattern 5: Overspending Detection in Renderer

```javascript
// In AddTransaction.jsx, after dispatch('ADD_TRANSACTION'):
// (or in a useEffect that watches categoryTotals vs budgets)
const overspent = Object.entries(budgets).filter(([cat, budget]) => {
  if (cat === 'savings') return false
  return (categoryTotals[cat] || 0) > budget
})
overspent.forEach(([cat, budget]) => {
  const spent = categoryTotals[cat]
  const over = spent - budget
  const remaining = Math.max(0, budget - spent + over)  // = 0 when over
  window.electronAPI?.showNotification(
    `Over budget: ${cat}`,
    `$${over.toFixed(2)} over. Budget was $${budget}.`
  )
})
```

Note: `window.electronAPI` will be `undefined` in browser dev mode. Guard with optional chaining so web mode continues to work.

### Pattern 6: pdfParser.js Worker Path Fix

The current code uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. This works in Vite dev mode but breaks in a packaged ASAR because `import.meta.url` resolves to an `app.asar://` URL that the browser's worker constructor cannot load from.

**Fix:** Copy the worker file to `public/` so Vite treats it as a static asset and emits it to the output root.

```bash
# Add to package.json postinstall or run once:
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

```javascript
// src/utils/pdfParser.js — change only the workerSrc line
mod.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'
// ↑ Relative to index.html in both dev (served from /) and production (file://)
```

[VERIFIED via multiple WebSearch cross-references — this is the canonical Vite+Electron pattern when import.meta.url is unreliable in ASAR]
[CITED: https://github.com/mozilla/pdf.js/discussions/19520]

### Anti-Patterns to Avoid

- **Setting `nodeIntegration: true` in renderer:** Exposes entire Node.js API to untrusted web content. All Node access must go through the preload/contextBridge channel.
- **Using `ipcRenderer` directly in renderer source files:** Only valid in the preload script. If you import it from a component, Vite will fail to bundle it (it's an Electron internal module).
- **Watching in the renderer process:** Chokidar requires Node.js `fs` events — it must live in the main process.
- **Using hash router in web mode, history router in Electron:** electron-vite docs explicitly warn: in production, Electron loads a `file://` URL. React Router needs `HashRouter` or `MemoryRouter` for production Electron (no server to handle history routes). The current app uses tab state (not React Router), so this is not an issue.
- **Placing `electron` or `electron-builder` in `dependencies`:** They must be `devDependencies`. electron-builder will error if `electron` ends up in the production bundle.
- **Calling `new Notification()` before `app.whenReady()`:** Notification requires the app to be ready and on Windows requires the AUMID to be set first.
- **`workerSrc` via CDN in production:** The app is fully local — no internet access guaranteed. CDN fallback for pdfjs worker is not acceptable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File watching cross-platform | Custom `fs.watch` wrapper | chokidar | `fs.watch` has no recursive support on macOS <10.7, unreliable on Linux, misses atomic writes |
| Native OS notifications | node-notifier + system call | Electron `Notification` class | Electron's built-in requires no extra native addons; works on all three platforms with zero system deps |
| App packaging | Custom zip/installer scripts | electron-builder | NSIS (Windows), DMG (macOS), AppImage (Linux) each have platform-specific quirks; electron-builder is battle-tested |
| IPC security layer | Direct `nodeIntegration: true` | contextBridge + preload | Manual ipc without contextBridge exposes Node globally to renderer; violates Electron security model |

**Key insight:** Electron + electron-vite + electron-builder cover the entire desktop app lifecycle. Any custom solution for packaging, watching, or notifications will be worse and harder to maintain.

---

## Common Pitfalls

### Pitfall 1: pdfjs Worker ASAR Path

**What goes wrong:** In a packaged app, `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` resolves to an `asar://` URL that Chromium cannot spawn a Worker from.
**Why it happens:** Workers require a real `file://` or `http://` URL. ASAR is a virtual filesystem that Electron patches into Node.js but not into Chromium's Worker loader.
**How to avoid:** Copy `pdf.worker.min.mjs` to `public/` and set `workerSrc = './pdf.worker.min.mjs'`.
**Warning signs:** PDF parsing works in `electron-vite dev` but fails silently in `electron-vite preview` or packaged build.

### Pitfall 2: Tailwind v4 CSS Not Loading in Renderer

**What goes wrong:** Styles are missing in Electron renderer because the Tailwind Vite plugin was added to the wrong config section.
**Why it happens:** electron-vite has three separate Vite configs (main, preload, renderer). The `@tailwindcss/vite` plugin must be in the `renderer.plugins` array, not at the top level.
**How to avoid:** See Pattern 1 above — `tailwindcss()` goes in `renderer: { plugins: [...] }`.
**Warning signs:** App loads but all text is unstyled; console shows no CSS errors.

### Pitfall 3: `sandbox: false` Required for Preload to Use Node APIs

**What goes wrong:** Preload script crashes with "require is not defined" or similar.
**Why it happens:** Since Electron 20, `sandbox: true` is the default, which restricts preload scripts to a browser-like environment. electron-vite's preload build expects to use Node modules.
**How to avoid:** Set `sandbox: false` in `webPreferences`. This is safe because the preload's Node access is still controlled by `contextIsolation: true`.
**Warning signs:** Preload fails to import `electron` or any Node module at startup.

### Pitfall 4: Windows Notifications Silently Fail

**What goes wrong:** `new Notification(...).show()` does nothing on Windows in development.
**Why it happens:** Windows notifications require an AppUserModelID tied to a Start Menu shortcut. In dev, no shortcut exists.
**How to avoid:** Call `app.setAppUserModelId(app.getName())` (or `process.execPath` in dev) at the top of the main process, before `app.whenReady()`.
**Warning signs:** `Notification.isSupported()` returns `true` but nothing appears in the Action Center.

### Pitfall 5: `type: "module"` Conflict with Main Process CJS Output

**What goes wrong:** The existing `package.json` has `"type": "module"`. electron-vite 5 compiles the main process and preload to CJS by default (since Electron < 28 doesn't fully support ESM). The output files get `.cjs` extensions, and the `"main"` field in `package.json` must point to the correct extension.
**Why it happens:** When `"type": "module"` is set, Node.js treats `.js` files as ESM. electron-vite works around this by emitting `.cjs` for main/preload.
**How to avoid:** Set `"main": "out/main/index.cjs"` in `package.json` (electron-vite 5 with `"type": "module"` outputs `.cjs`). Verify by running `electron-vite build` and checking the `out/` directory.
**Warning signs:** Electron launches but immediately exits with `ERR_REQUIRE_ESM` or similar.

### Pitfall 6: chokidar `ignoreInitial` Must Be `true`

**What goes wrong:** On app launch, chokidar fires `add` for every existing file in the watched folder, flooding the renderer with stale PDFs.
**Why it happens:** chokidar's default `ignoreInitial: false` emits `add` for all files during the initial scan.
**How to avoid:** Always set `ignoreInitial: true` for the folder watcher in this context.
**Warning signs:** On startup, multiple PDF import dialogs appear for files already in the folder.

### Pitfall 7: electron-builder Treating electron as Runtime Dep

**What goes wrong:** electron-builder includes the `electron` npm package in the app bundle, creating a 200MB+ installer.
**Why it happens:** `electron` in `dependencies` (not `devDependencies`) causes electron-builder to bundle it.
**How to avoid:** Keep `electron`, `electron-vite`, and `electron-builder` all in `devDependencies`.
**Warning signs:** Build output is unexpectedly large; installer >100MB for a simple app.

---

## Code Examples

### package.json Updates

```json
{
  "name": "budgetpulse",
  "version": "1.0.0",
  "type": "module",
  "main": "out/main/index.cjs",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "build:win": "npm run build && electron-builder --win --config electron-builder.yml",
    "build:mac": "npm run build && electron-builder --mac --config electron-builder.yml",
    "build:linux": "npm run build && electron-builder --linux --config electron-builder.yml"
  }
}
```

[VERIFIED: Context7 /alex8088/electron-vite-docs distribution docs]

### electron-builder.yml

```yaml
# electron-builder.yml
# Source: https://electron-vite.org/guide/distribution
appId: com.budgetpulse.app
productName: BudgetPulse
directories:
  buildResources: build
  output: dist
files:
  - out/**
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.*'
  - '!{.eslintignore,.eslintrc.*,.prettierrc.*}'
  - '!{tsconfig.json,tsconfig.*.json}'
win:
  executableName: BudgetPulse
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
dmg:
  artifactName: ${name}-${version}.${ext}
linux:
  target:
    - AppImage
    - deb
  maintainer: shrijit.bannerjee@gmail.com
  category: Office
appImage:
  artifactName: ${name}-${version}.${ext}
npmRebuild: false
```

[VERIFIED: Context7 /alex8088/electron-vite-docs distribution config template]

### Goal Weekly Savings Display in GoalCard

```jsx
// In Goals.jsx GoalCard — add after existing ETA display
import { getWeeklyRequired } from '../utils/recommendations'

// Inside GoalCard:
const weeklyRequired = getWeeklyRequired(goal)  // null if no targetDate
const avgWeeklySavings = history.length > 0
  ? history.slice(0, 8).reduce((s, w) => s + (w.totalSaved || 0), 0) / Math.min(8, history.length)
  : 0
const isOnTrack = weeklyRequired !== null && avgWeeklySavings >= weeklyRequired

// JSX:
{weeklyRequired !== null && !done && (
  <p className="text-xs" style={{ color: isOnTrack ? 'var(--color-green)' : 'var(--color-amber)' }}>
    {isOnTrack ? '✓' : '⚠'} Save ${weeklyRequired.toFixed(2)}/wk to reach by {new Date(goal.targetDate).toLocaleDateString()}
  </p>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `externalizeDepsPlugin()` in electron-vite | `build.externalizeDeps` option | electron-vite 5.0 (Dec 2025) | Old plugin still works but is deprecated; use config option for v5 |
| `new URL(worker, import.meta.url)` for pdfjs | Static public/ asset path | pdfjs-dist v4+ / Vite 5+ | `import.meta.url` in node_modules is now a known Vite limitation |
| `@tailwind base/components/utilities` directives | `@import "tailwindcss"` | Tailwind v4 | Single import replaces all three directives; existing `index.css` already uses this |
| `nodeIntegration: true` | `contextIsolation: true` + preload | Electron 12 (2021) | nodeIntegration off by default since Electron 5; preload/contextBridge is mandatory |
| Chokidar v4 (with native fsevents) | Chokidar v5 (pure JS) | Chokidar 5.0 (2024) | v5 dropped native `fsevents` dependency entirely — simpler cross-platform builds |

[VERIFIED: npm registry versions + Context7 docs]

**Deprecated/outdated:**
- `vite.config.js` at project root: replaced by `electron.vite.config.js`; keep only one.
- `"dev": "vite"` script: replaced by `"dev": "electron-vite dev"`.
- `"build": "vite build"` script: replaced by `"build": "electron-vite build"`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "On-track" threshold is `avgWeeklySavings >= weeklyRequired` | Architecture Patterns (Pattern 4) | If user wants a different threshold (e.g., 90%), the GoalCard display would be off; easy to fix |
| A2 | The app will keep using `MemoryRouter`-equivalent tab state (not React Router); no HashRouter migration needed | Anti-Patterns | If React Router is added later, production Electron will break on page reload without HashRouter |
| A3 | `sandbox: false` is acceptable for this app's threat model (local app, no remote URLs loaded) | Pattern 1 (BrowserWindow) | If security requirements harden, preload must be rewritten to avoid Node APIs, using only IPC |
| A4 | pdfjs worker file can be safely copied to `public/` as a postinstall step | Pattern 6 | If pdfjs-dist updates break the copied file, a postinstall script or `vite-plugin-static-copy` should be used instead |

---

## Open Questions (RESOLVED)

1. **Does the app need an auto-update mechanism?**
   - What we know: electron-builder supports `electron-updater` for auto-update via GitHub Releases or a generic server.
   - What's unclear: Whether the user wants auto-update in Phase 1 or later.
   - RESOLVED: Omit from Phase 1 (not in requirements). Add to ROADMAP as a future phase if requested.

2. **macOS code signing / notarization**
   - What we know: macOS 10.15+ requires notarization for apps distributed outside the App Store. Notification events require code signing to emit correctly.
   - What's unclear: Whether the user has an Apple Developer account ($99/yr).
   - RESOLVED: Build .dmg without notarization for Phase 1. Works via "Allow apps from anywhere" for direct installs. Notarization deferred to a future packaging phase.

3. **Linux libnotify on Arch/minimal distros**
   - What we know: Electron uses libnotify on Linux. Since libnotify 0.8.0+, it uses the notification portal in sandboxed environments. Outside a sandbox, libnotify must be installed.
   - What's unclear: Arch Linux minimal installs may not have libnotify or a notification daemon (dunst/mako).
   - RESOLVED: Guard all notification calls with `Notification.isSupported()`. App degrades gracefully (no notification shown) rather than crashing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite, build tools | ✓ | v24.15.0 | — |
| npm | package installation | ✓ | 11.12.1 | — |
| electron (npm pkg) | Electron runtime in dev | not yet installed | — | Run `npm install` |
| electron-vite (npm pkg) | Build tool | not yet installed | — | Run `npm install` |
| electron-builder (npm pkg) | Packaging | not yet installed | — | Run `npm install` |
| chokidar (npm pkg) | Folder watching | not yet installed | — | Run `npm install` |

**Node.js version check:** v24.15.0 satisfies electron-vite 5's requirement of `>=22.12.0`. [VERIFIED: npm view electron-vite engines]

**Missing dependencies with no fallback:** None — all are npm packages, installable in one command.

**Missing dependencies with fallback:** None applicable.

---

## Validation Architecture

`nyquist_validation` is not explicitly set to `false` in `.planning/config.json` — validation is enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — see Wave 0 |
| Quick run command | `npm test` (after setup) |
| Full suite command | `npm test` (after setup) |

The current project has no test infrastructure (no `vitest`, `jest`, or test files). Given the `mode: yolo` + `granularity: coarse` config, minimal smoke tests are appropriate.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-001 | Electron app launches without errors | smoke | `electron-vite preview` (visual check) | ❌ Wave 0 |
| REQ-002 | PDF file in watched folder triggers import event | integration | manual — requires fs + IPC | ❌ Wave 0 |
| REQ-003 | `getWeeklyRequired(goal)` returns correct value | unit | `vitest run src/utils/recommendations.test.js` | ❌ Wave 0 |
| REQ-004 | `Notification.isSupported()` guard prevents crash | unit | manual / OS-level check | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `electron-vite build` (compile check)
- **Per wave merge:** `electron-vite preview` (smoke test — app launches)
- **Phase gate:** Manual end-to-end check before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest` install: `npm install vitest --save-dev` — for REQ-003 unit test
- [ ] `src/utils/recommendations.test.js` — covers `getWeeklyRequired` edge cases (no date, past date, already funded, weeks < 1)
- [ ] No integration test harness needed for REQ-002 (IPC) or REQ-004 (OS notification) — manual testing is the appropriate gate for these

---

## Security Domain

`security_enforcement` is not set in config — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — local-only app, no accounts |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — single-user local app |
| V5 Input Validation | Yes (partial) | PDF path from IPC: validate it is a `.pdf` extension and within the watched folder before reading |
| V6 Cryptography | No | localStorage data is not encrypted (not in scope for this phase) |

### Known Threat Patterns for Electron Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer executing arbitrary Node.js | Elevation of Privilege | `nodeIntegration: false` + `contextIsolation: true` (enforced in BrowserWindow config) |
| Preload leaking broad Node API surface | Elevation of Privilege | Expose only named functions via `contextBridge.exposeInMainWorld`; never expose `ipcRenderer` directly |
| Path traversal via IPC folder path | Tampering | Validate IPC-received paths are strings and within the configured watch folder before `fs.readFile` |
| Malicious PDF triggering code execution | Tampering | pdfjs-dist runs in a sandboxed renderer Web Worker; no Node.js access from the worker context |
| Notification spam | Denial of Service | Rate-limit `showNotification` calls in main process (e.g., debounce per category per minute) |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/alex8088/electron-vite-docs` — project structure, config syntax, distribution, IPC preload patterns
- Context7 `/websites/electronjs` — Notification API, ipcMain/ipcRenderer, dialog, BrowserWindow webPreferences, CSP
- Context7 `/paulmillr/chokidar` — watch API, options, event types
- npm registry — verified versions for electron-vite@5.0.0, electron@42.1.0, chokidar@5.0.0, electron-builder@26.8.1

### Secondary (MEDIUM confidence)
- https://electron-vite.org/guide/ — setup steps, package.json scripts, "main" field
- https://electron-vite.org/guide/dev — custom project structure with `renderer.root: '.'`
- https://electron-vite.org/guide/distribution — electron-builder.yml template
- https://electron-vite.org/guide/troubleshooting — sandbox preload, ESM/CJS, HashRouter warning
- https://iifx.dev/en/articles/457403541 — Tailwind v4 + electron-vite renderer plugin config

### Tertiary (LOW confidence — flagged)
- https://github.com/mozilla/pdf.js/discussions/19520 — pdfjs worker ASAR workaround (community finding, not official Electron docs)
- WebSearch: Linux libnotify dependency behavior — multiple sources agree but no single authoritative 2025 Electron doc found

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry 2026-05-16
- Architecture: HIGH — IPC patterns verified via official Electron docs + electron-vite docs
- pdfjs worker fix: MEDIUM — community-verified pattern, not in official Electron docs
- Pitfalls: HIGH for Electron-general pitfalls (official docs); MEDIUM for pdfjs-specific (community)

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (electron-vite and Electron release frequently; re-check versions before executing)
