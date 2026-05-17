# Pitfalls Research

**Domain:** Electron desktop app wrapping a Vite/React web UI with PDF parsing, folder watching, and native notifications
**Researched:** 2026-05-16
**Confidence:** HIGH (Electron-specific pitfalls are well-documented; pdfjs-dist/Electron combination is a known pain point)

---

## Critical Pitfalls

### Pitfall 1: pdfjs-dist Worker Path Breaks in Production Builds

**What goes wrong:**
PDF parsing silently fails after packaging with electron-builder. The worker loads fine in dev (`vite dev`) because Vite serves `pdfjs-dist/build/pdf.worker.min.mjs` as a static asset. In the packaged app, the asar archive changes all paths, and the worker URL resolves to a path that doesn't exist — resulting in a `Setting up fake worker` warning, degraded performance, or total parse failure for large PDFs.

**Why it happens:**
`pdfjs-dist` requires `GlobalWorkerOptions.workerSrc` to point to the worker file. In Vite dev, `?url` imports resolve automatically. In Electron production, `app.asar` paths are prefixed with `app://./` and the file must either be excluded from asar or served via a custom protocol. Developers copy the Vite setup verbatim and forget the production path diverges.

**How to avoid:**
- In the preload or renderer init, set `workerSrc` conditionally:
  ```js
  // renderer bootstrap (before any PDF parse)
  import { GlobalWorkerOptions } from 'pdfjs-dist';
  GlobalWorkerOptions.workerSrc = app.isPackaged
    ? `file://${path.join(process.resourcesPath, 'pdf.worker.min.mjs')}`
    : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  ```
- Use `electron-builder`'s `extraResources` to copy the worker file outside the asar:
  ```json
  "extraResources": [{ "from": "node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "to": "pdf.worker.min.mjs" }]
  ```
- Add an integration test: parse a real PDF in the packaged app before each release.

**Warning signs:**
- Console shows `Setting up fake worker` in the renderer
- PDF parsing succeeds in dev but times out or returns empty in prod
- Worker fetch returns 404 in DevTools Network tab

**Phase to address:** Phase 1 (Electron shell setup) — configure the worker path and extraResources before any other feature work; it's the foundation everything else depends on.

---

### Pitfall 2: IPC Surface Grows Into a Security and Maintenance Liability

**What goes wrong:**
Developers start with one or two IPC channels, then keep adding `ipcMain.handle('do-thing', ...)` calls ad-hoc. After a few months the preload exposes 15 channels with inconsistent naming, no validation, and some that execute arbitrary shell commands because "it's local anyway." A compromised renderer (malicious PDF content triggering XSS in pdfjs) can call any of them.

**Why it happens:**
Electron's IPC feels like a simple function call. The threat model ("it's a local app, no internet") lulls developers into skipping input validation. The preload accumulates surface over time with no architectural pressure to keep it small.

**How to avoid:**
- Define a typed IPC contract in a shared `ipc-channels.js` file at project start. Every channel name is a constant.
- Validate all arguments in `ipcMain.handle` before acting. Never pass renderer-supplied strings directly to `exec`, `spawn`, or `fs` without sanitization.
- Keep the preload's `contextBridge.exposeInMainWorld` surface minimal — expose capabilities (e.g., `watchFolder(path)`) not raw IPC (`invoke('ipc-channel', args)`).
- Use `webContents.fromFrame` checks to verify the sender before acting on sensitive IPC calls.

**Warning signs:**
- More than 8 IPC channels for this app's scope is a smell
- Any `ipcMain.handle` that calls `exec`, `eval`, or `require` with renderer-supplied data
- Preload file growing past ~100 lines

**Phase to address:** Phase 1 — establish the IPC contract skeleton before feature work begins; retrofitting is painful.

---

### Pitfall 3: Content Security Policy Blocks Inline Scripts and Vite's HMR

**What goes wrong:**
Setting a strict CSP header in the main process (or meta tag) blocks Vite's HMR websocket and any inline styles injected by Tailwind/Framer Motion, breaking the dev experience. In production, a missing CSP leaves the app open to content injection from parsed PDF text rendered as HTML.

**Why it happens:**
Electron docs show CSP examples that are correct for production but incompatible with Vite dev. Teams copy the production CSP into the Vite dev config and spend hours debugging why HMR stops working.

**How to avoid:**
- Use `session.defaultSession.webRequest.onHeadersReceived` to inject CSP only in production (`app.isPackaged`).
- Production CSP minimum: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:;` — the `worker-src blob:` is required for the pdfjs worker.
- Never render PDF-extracted text as `innerHTML` — always use `textContent` or React's JSX rendering.

**Warning signs:**
- DevTools console shows CSP violation errors
- HMR stops reconnecting in dev mode after adding security headers
- PDF text rendering uses `dangerouslySetInnerHTML`

**Phase to address:** Phase 1 (security baseline), verified in Phase 3 (packaging/production build).

---

### Pitfall 4: electron-builder asar Swallows Native Modules and Large Binaries

**What goes wrong:**
electron-builder packages everything into `app.asar` by default. Native modules (`.node` files) can't be loaded from inside an asar archive — they silently fail or throw `Error: dlopen failed`. Similarly, the pdfjs worker (if not excluded via `extraResources`) ends up inside asar and becomes inaccessible to the web worker API.

**Why it happens:**
asar is transparent for most Node.js `require` calls but not for `dlopen` (native modules) or URLs resolved by the browser engine. Developers don't hit this in dev because asar isn't used.

**How to avoid:**
- Explicitly set `"asar": true` and `"asarUnpack": ["**/*.node"]` in electron-builder config — this unpacks native modules alongside the asar.
- Chokidar may pull in `fsevents` (native on macOS) — ensure it's listed in `asarUnpack`.
- Test the packaged build on all three platforms before shipping; don't assume dev = prod.

**Warning signs:**
- `Error: The specified module could not be found` or `dlopen` errors after packaging
- `fsevents` watch not firing on macOS in packaged builds
- Any `require('...')` of a `.node` file from the main process failing silently

**Phase to address:** Phase 3 (packaging) — configure asar settings before the first test package build.

---

### Pitfall 5: chokidar Watch Fires Duplicate Events or Misses Renames on Windows

**What goes wrong:**
On Windows, chokidar's `add` event fires twice for the same file (once for the temp file, once after the rename completes). Bank statement downloaders typically save as `statement.pdf.crdownload` then rename to `statement.pdf` — chokidar fires `add` on both. Processing the temp file causes a parse error; processing the renamed file works. Without deduplication logic the queue UI shows errors alongside valid imports.

**Why it happens:**
Windows file system events don't have FSEvents (macOS-style atomic notifications). chokidar uses polling or ReadDirectoryChangesW, both of which can fire on intermediate write states. The default `awaitWriteFinish` option is off.

**How to avoid:**
- Always enable `awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }` in the chokidar config — this delays the event until the file size stops changing.
- Filter by `.pdf` extension in the `add` handler before queuing: `if (!filePath.endsWith('.pdf')) return;`
- Deduplicate by file path with a 1-second cooldown Map in the main process.

**Warning signs:**
- Duplicate entries appearing in the PDF import queue
- Parse errors on files that exist and are valid
- Watch events firing for `.crdownload` or `.tmp` files

**Phase to address:** Phase 2 (folder watcher feature).

---

### Pitfall 6: localStorage Data Lost When App userData Path Changes

**What goes wrong:**
Electron stores localStorage in `app.getPath('userData')/Local Storage/`. If the `appId` in electron-builder config is changed (even once, during development), a new userData directory is created and all existing user data becomes invisible to the app. Users lose their budgets, goals, and history with no warning.

**Why it happens:**
The `appId` determines the userData folder name on Windows (`%APPDATA%\<appId>`) and macOS (`~/Library/Application Support/<appId>`). Developers iterate on the appId during early packaging setup without realizing this is a destructive migration.

**How to avoid:**
- Lock the `appId` in `package.json`/electron-builder config on day one: `"appId": "com.budgetpulse.app"` — treat it as immutable after first release.
- Add a comment in the config: `// DO NOT CHANGE — changing breaks all existing user data`.
- Consider exporting/importing a JSON backup as a safety net feature (future scope).

**Warning signs:**
- App launches showing setup wizard despite user having data
- DevTools Application > Local Storage showing empty storage
- `userData` directory in a new location after a config change

**Phase to address:** Phase 1 — set appId before any local testing with real data.

---

### Pitfall 7: Notifications Silently Fail on Linux Without libnotify or on macOS Without Correct Bundle ID

**What goes wrong:**
`new Notification()` from Electron's main process returns no error but the notification never appears. On Linux without a notification daemon (common in minimal distros), it silently drops. On macOS, notifications require the app to be signed and have a valid bundle ID — unsigned dev builds often don't show tray notifications.

**Why it happens:**
Electron's Notification API wraps the OS notification system. It doesn't throw if the system can't deliver — it just fails silently. The macOS bundle ID requirement is documented but easy to miss.

**How to avoid:**
- Test notifications in the packaged, signed build on each platform — not just in `electron .` dev mode.
- Wrap `new Notification(...)` in a check: `if (Notification.isSupported()) { ... }` before sending.
- For Linux, document in the README that `libnotify` must be installed (most desktop Linux distros have it, but not all).
- On macOS, ensure `appId` in electron-builder matches the bundle ID in the signing cert.

**Warning signs:**
- Notification code runs (confirmed via console log) but no OS notification appears
- Works on macOS dev machine, fails in packaged app
- AppImage on Linux shows no notification on minimal setups

**Phase to address:** Phase 2 (native notifications feature) — include multi-platform smoke test.

---

### Pitfall 8: Vite Build Output Path Doesn't Match Electron's loadFile Path

**What goes wrong:**
Electron's `mainWindow.loadFile('dist/index.html')` fails with `ERR_FILE_NOT_FOUND` if Vite's `build.outDir` is changed (e.g., from `dist` to `build` or `out`). In dev mode, `loadURL('http://localhost:5173')` works fine, masking the misconfiguration until the first production build.

**Why it happens:**
Vite's default output is `dist/`. If the developer changes `vite.config.js` outDir for any reason, the Electron main process path becomes stale. These are in different files with no runtime link.

**How to avoid:**
- Keep Vite's `build.outDir` as `dist` (the default) — don't rename it.
- In `main.js`, derive the renderer path from `__dirname` reliably:
  ```js
  const rendererPath = path.join(__dirname, '../dist/index.html');
  ```
- In dev mode, use `VITE_DEV_SERVER_URL` env var (set by vite-plugin-electron or manually) to switch between `loadURL` and `loadFile`.

**Warning signs:**
- `ERR_FILE_NOT_FOUND` in the Electron window on first production launch
- Works in `npm run dev` but white screens in `npm run preview`
- `loadFile` path hardcoded as a string literal without `path.join`

**Phase to address:** Phase 1 — the dev/prod load URL split is the first thing to get right.

---

### Pitfall 9: Framer Motion Animations Stutter in Electron Due to Missing GPU Acceleration Flags

**What goes wrong:**
Framer Motion animations (the weekly score ring, category bars) stutter or drop to ~15fps in Electron even on capable hardware. Chrome's GPU process in Electron can be sandboxed differently than a browser, and some Linux configurations disable hardware acceleration by default.

**Why it happens:**
Electron uses Chromium's GPU process, but certain `--disable-gpu` flags added for compatibility (sometimes added by Linux distro electron packages or via app.commandLine) can disable compositing. Framer Motion relies on CSS transforms and `will-change` which need GPU compositing.

**How to avoid:**
- Don't add `--disable-gpu` or `--disable-software-rasterizer` flags unless absolutely necessary.
- Enable hardware acceleration explicitly: `app.commandLine.appendSwitch('enable-gpu-rasterization')` in main.js if users report jank.
- Test animation frame rate on Linux specifically — it's the most likely platform for GPU issues.

**Warning signs:**
- Animations run fine in browser but jank in Electron window
- DevTools Performance panel shows "Forced reflows" or dropped frames during transitions
- Only reproducible on Linux machines

**Phase to address:** Phase 1 (Electron shell) — verify animation smoothness before adding more features.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `nodeIntegration: true` to avoid preload boilerplate | Faster initial dev, no IPC setup | Any renderer XSS (e.g., via malicious PDF content) can read the filesystem | Never — contextIsolation + preload is a one-time 30-min setup |
| Hardcoded file paths in main process | Simple code | Breaks across OSes and packaging; Windows uses backslashes | Never — always use `path.join` |
| Skipping `awaitWriteFinish` in chokidar | Slightly faster event delivery | Duplicate events, parsing of incomplete files | Never for PDF watching |
| Using `shell.openExternal` for all URLs | Simple link handling | Opens any URL in the OS browser, including renderer-injected ones | Only for hardcoded, trusted URLs |
| Storing all state in localStorage without size checks | No migration code needed | localStorage has a 5-10MB limit per origin; large transaction histories will hit it | Acceptable for MVP; add size warning before v1.0 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pdfjs-dist in Electron renderer | Using `?url` import for worker, assuming it resolves in prod | Copy worker to `extraResources`, set `workerSrc` based on `app.isPackaged` |
| chokidar in main process | Watching a path before `app.on('ready')` | Initialize chokidar watcher inside `app.whenReady()` |
| Electron Notification API | Calling it from the renderer via `window.Notification` | Always call from the main process; renderer uses IPC to request a notification |
| electron-builder + Vite | Using `vite build --watch` for live reload in main process | Use `vite-plugin-electron` or separate `nodemon` for main process; don't mix bundler watch modes |
| `path.join` across processes | Passing absolute paths from renderer to main via IPC | Validate that renderer-supplied paths are within the designated watch folder before any fs operation |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parsing PDFs in the renderer on the main thread | UI freezes for 1-3s per PDF | pdfjs is already async; ensure it's not blocked by synchronous localStorage writes happening simultaneously | Any PDF over ~2MB |
| chokidar watching a root drive (`C:\` or `/`) | 100% CPU, thousands of events per second | Only watch the specific user-designated folder, never a drive root | Immediately on watch start |
| Loading all transactions into React state at once | Dashboard render takes >500ms with large history | Paginate or virtualize the transaction list; the weekly view only needs the current week's data | ~500+ transactions |
| Synchronous `fs.readFileSync` in main process IPC handler | Blocks the Electron main process, freezes the entire app | Always use `fs.promises` or async equivalents in IPC handlers | Files over ~100KB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `webSecurity: false` in BrowserWindow | Disables CORS and same-origin policy, allowing any loaded content to make cross-origin requests | Never disable webSecurity; it's not needed for local file loading |
| Exposing `require` or `__dirname` via contextBridge | Renderer gets full Node.js access — defeats the entire security model | Only expose specific, typed capabilities (e.g., `watchFolder(path: string): void`) |
| Not validating IPC arguments before fs operations | Renderer-supplied path like `../../.ssh/id_rsa` could be read/written | Validate all paths are within `app.getPath('userData')` or the user's designated watch folder |
| Rendering PDF-extracted text as HTML | Malicious PDF with XSS payload executes in the renderer | Always render extracted text as plain text; never use `innerHTML` with PDF content |
| Using `shell.openExternal` with renderer-supplied URLs | PDF could contain URLs that trigger protocol handlers (e.g., `file://`, `ms-word://`) | Only call `shell.openExternal` with URLs from a hardcoded allowlist |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking the UI during PDF import | App feels frozen; user force-quits thinking it crashed | Show a loading state immediately; process PDF in background; update queue when done |
| No confirmation before clearing the watch folder path | User accidentally removes their auto-import folder with no undo | Require explicit confirmation with the folder path shown: "Stop watching ~/Downloads/bank-statements?" |
| System tray icon with no tooltip | Users forget what the tray icon is after days of no alerts | Always set a tray tooltip: "BudgetPulse — Week score: 82" |
| Notification fires for every transaction above budget, not just once | Notification spam after importing 30 transactions | Debounce: one notification per category per week, not per transaction |
| Window position not remembered between sessions | App opens at 0,0 or wrong monitor every launch | Persist `window.getBounds()` to a config file on `close`; restore on launch |

---

## "Looks Done But Isn't" Checklist

- [ ] **PDF worker:** Works in `npm run dev` — verify it also works in a packaged build by parsing a real PDF in the installer output.
- [ ] **Notifications:** Appear in dev on macOS — verify they appear in the signed, packaged app (unsigned dev builds often skip macOS notification delivery).
- [ ] **Folder watcher:** Events fire in dev on macOS — verify on Windows with a file downloaded via Chrome (rename event sequence differs).
- [ ] **App icon:** Icon shows in dock/taskbar — verify all required sizes are present for each platform (macOS needs `.icns`, Windows needs `.ico` with multiple sizes).
- [ ] **Auto-start on login (if added later):** Works via Electron's `app.setLoginItemSettings` — verify it survives a system reboot, not just a logout/login.
- [ ] **Data persistence:** LocalStorage survives app restart — verify `appId` is locked and userData path is stable across builds.
- [ ] **Window close behavior:** Closing the window quits the app on Windows/Linux, goes to tray on macOS — verify the platform-specific behavior is implemented, not just one path.
- [ ] **Installer on Windows:** Doesn't require admin rights — verify NSIS installer runs without UAC elevation for a per-user install.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| pdfjs worker broken in production | MEDIUM | Add `extraResources` config, update `workerSrc` path logic, rebuild and test packaged app |
| appId changed, user data lost | HIGH | Cannot recover lost localStorage data; add a data export/import feature before next release to prevent recurrence |
| IPC surface compromised by nodeIntegration error | HIGH | Audit all IPC handlers, add validation, rebuild with correct security settings; audit for any user-facing impact |
| chokidar duplicate events causing bad imports | LOW | Add `awaitWriteFinish` and path deduplication; reload the watch without data loss |
| Notification silent failure on a platform | LOW | Wrap in `isSupported()` check, add in-app fallback alert, document OS requirements |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| pdfjs worker path broken in production | Phase 1 — Electron shell setup | Parse a real PDF in the packaged AppImage/DMG/EXE |
| IPC surface grows insecure | Phase 1 — establish IPC contract | Review preload surface before Phase 2 begins |
| CSP blocks dev HMR or production content | Phase 1 — security baseline | Check DevTools console for CSP violations in both dev and prod |
| electron-builder asar breaks native modules | Phase 3 — packaging | Run chokidar watch in packaged app on macOS (fsevents check) |
| chokidar duplicate events on Windows | Phase 2 — folder watcher | Test with Chrome download rename sequence on Windows VM |
| localStorage lost on appId change | Phase 1 — lock appId | Confirm userData path matches expected value after first build |
| Notifications silent on platforms | Phase 2 — native notifications | Smoke test notification in signed build on each target OS |
| Vite output path mismatch | Phase 1 — dev/prod URL split | Confirm `loadFile` resolves correctly in packaged build |
| Animation stutter in Electron | Phase 1 — Electron shell | Run Framer Motion animations in Electron window on Linux |
| UI blocks during PDF import | Phase 2 — PDF import UX | Import a 5MB PDF and verify UI remains responsive |

---

## Sources

- Electron security documentation: https://www.electronjs.org/docs/latest/tutorial/security
- electron-builder documentation (asar, extraResources, appId): https://www.electron.build/configuration/configuration
- pdfjs-dist Electron integration known issues: https://github.com/mozilla/pdf.js/wiki/Setup-PDF.js-in-a-website
- chokidar README (awaitWriteFinish): https://github.com/paulmillr/chokidar
- Electron Notification API: https://www.electronjs.org/docs/latest/api/notification
- Community post-mortems: electron/electron GitHub issues, r/electronjs common questions

---
*Pitfalls research for: Electron desktop app (BudgetPulse) — Vite/React renderer, pdfjs-dist, chokidar, electron-builder*
*Researched: 2026-05-16*
