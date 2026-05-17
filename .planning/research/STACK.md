# Stack Research

**Domain:** Electron desktop app wrapping existing React/Vite web UI
**Researched:** 2026-05-16
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | ^34.x | Native desktop shell | Current stable; Chromium 132, Node 22; long-term support cycle aligns with Vite 8 and React 19 |
| Vite | ^8.0 (existing) | Build tooling for renderer | Already in use; produces the compiled bundle Electron loads via `loadFile` |
| React 19 | ^19.2 (existing) | UI framework | Already in use; no changes needed — renderer is the Vite output |
| electron-builder | ^25.x | Cross-platform installer packaging | Single tool produces Windows NSIS, macOS DMG, Linux AppImage; widest adoption, best CI story |
| chokidar | ^4.x | Cross-platform folder watcher | Pure JS in v4 (no native module rebuild headaches in Electron); works in main process only |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron-toolkit/preload | ^3.x | Expose `ipcRenderer`, `webFrame`, `process` to renderer safely | Use in preload.js to avoid manually re-exporting Electron internals |
| @electron-toolkit/utils | ^4.x | `is.dev` flag, `optimizer` for native module handling | Use in main.js for dev/prod branching and module optimizer |
| electron-updater | ^6.x | Auto-update via electron-builder's update server protocol | Only needed if adding auto-update later; include now in `package.json` so builder knows to wire NSIS/DMG update targets |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| concurrently | Run Vite dev server + Electron main in parallel | `concurrently "vite" "electron ."` — wait for Vite port before Electron launches |
| wait-on | Block Electron start until Vite dev server is ready | `wait-on http://localhost:5173` before `electron .` in dev script |
| electron (devDependency) | Electron binary for local dev | Install as devDep; electron-builder bundles its own copy for distribution |

## Installation

```bash
# Core Electron
npm install -D electron electron-builder

# Folder watcher (main process only)
npm install chokidar

# Electron toolkit (optional but reduces boilerplate)
npm install @electron-toolkit/preload @electron-toolkit/utils

# Dev workflow
npm install -D concurrently wait-on
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| electron-builder | Electron Forge | Forge is better for greenfield; builder is better when you own the build pipeline (Vite 8 config) |
| electron-builder | electron-packager | Packager is lower-level; builder adds installers, auto-update, code signing in one tool |
| chokidar ^4 | Node.js `fs.watch` | `fs.watch` is unstable on macOS (misses events, reports duplicates); chokidar normalizes cross-platform FSEvents |
| chokidar ^4 | chokidar ^3 | v3 has native deps that require `electron-rebuild`; v4 is pure JS — zero rebuild step |
| `loadFile()` renderer | `loadURL('http://localhost')` in prod | Never serve from localhost in production; `loadFile` loads the compiled bundle directly |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nodeIntegration: true` | Exposes all of Node.js to the renderer; any XSS becomes full system compromise | `contextIsolation: true` + preload + `contextBridge.exposeInMainWorld` |
| `enableRemoteModule: true` | Deprecated in Electron 14, removed in 21; same security risks as nodeIntegration | IPC with typed channels via `ipcMain`/`ipcRenderer` |
| Web Notifications API in renderer | Requires user permission prompt (browser-style); unreliable in sandboxed renderer | `Notification` from Electron main process — no prompt, works in all OS contexts |
| `electron-rebuild` | Only needed for native (C++) Node modules; chokidar v4 avoids this entirely | Use pure-JS alternatives wherever possible |
| Tauri | Rust toolchain complicates pdfjs-dist JS worker bundling; Wasm story is non-trivial | Electron — JS-native, pdfjs worker works as-is in renderer |

## Stack Patterns by Variant

**For IPC (folder watcher events → renderer):**
- Main process runs chokidar, emits `ipcMain`-side events
- Preload script exposes `onNewPdf(callback)` via `contextBridge`
- Renderer calls `window.electronAPI.onNewPdf(cb)` — zero Node.js exposure

**For pdfjs-dist worker in production build:**
- Copy `pdfjs-dist/build/pdf.worker.min.mjs` into `public/` at build time (Vite `copyPublicDir`)
- Set `GlobalWorkerOptions.workerSrc` to a relative path that resolves inside the `app://` protocol
- In dev: Vite serves the worker from `node_modules`; production: the copied file is bundled by electron-builder

**For Electron main entry with Vite:**
- Keep `main.js` (CommonJS or ESM with `"type": "module"` in a sub-package) outside `src/`
- Vite builds the renderer to `dist/`; Electron loads `dist/index.html` via `loadFile`
- Do NOT use `electron-vite` (separate tool) unless you want to restructure the project — for a Vite-wrapping approach, a manual `electron/main.js` + `electron/preload.js` is simpler

**For system tray notifications:**
- Use `new Notification({ title, body })` from `electron` in the main process
- Trigger via IPC when renderer detects overspend: renderer → `ipcRenderer.send('notify-overspend', category)` → main creates `Notification`

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| electron ^34 | Node.js 22 (bundled) | Do not rely on system Node; Electron ships its own |
| electron ^34 | Chromium 132 | React 19 and Vite 8 output are fully compatible |
| chokidar ^4 | electron ^34 | Pure JS; no `electron-rebuild` needed |
| pdfjs-dist ^5.7 | electron ^34 renderer | Worker runs in renderer's Chromium context; no Electron changes needed |
| electron-builder ^25 | Vite 8 output in `dist/` | Point `files` config at `dist/` + `electron/` directories |

## Sources

- [Electron contextBridge docs](https://www.electronjs.org/docs/latest/api/context-bridge) — IPC security patterns (HIGH confidence)
- [Electron preload tutorial](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload) — preload script setup (HIGH confidence)
- [electron-builder GitHub](https://github.com/electron-userland/electron-builder) — packaging targets and config (HIGH confidence)
- [chokidar npm](https://www.npmjs.com/package/chokidar) — v4 pure-JS, v5 latest (MEDIUM confidence)
- [electron-vite guide](https://electron-vite.org/guide/dev) — Vite + Electron integration patterns (MEDIUM confidence)
- WebSearch: Electron/chokidar native module rebuild issues (MEDIUM confidence)

---
*Stack research for: BudgetPulse — Electron desktop shell*
*Researched: 2026-05-16*
