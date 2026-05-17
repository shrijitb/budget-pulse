# Project Research Summary

**Project:** BudgetPulse — Local-first desktop budgeting app
**Domain:** Electron desktop shell wrapping existing React/Vite web UI
**Researched:** 2026-05-16
**Confidence:** HIGH

## Executive Summary

BudgetPulse is a local-first desktop budgeting app built on a React/Vite web UI that is already feature-complete as a web app. The Electron v1 milestone is not about building new product features — it's about wrapping the existing renderer in a secure, installable desktop shell. The recommended approach is a minimal Electron main process (`electron/main.js`) with a preload script (`electron/preload.js`) that exposes a typed IPC API via `contextBridge`, a Vite build pipeline that produces the renderer bundle in `dist/`, and `electron-builder` for cross-platform installer generation. The existing `src/` React app requires zero structural changes.

The primary technical risks center on two integration points: the `pdfjs-dist` worker path breaking silently in production builds (due to asar path changes), and the IPC surface growing insecure if not defined with a typed contract up front. Both risks are preventable if addressed in Phase 1 before any feature work begins. The secondary risks — chokidar duplicate events on Windows, silent notification failures on Linux/macOS unsigned builds, and localStorage data loss from `appId` changes — are well-documented and have clear mitigations.

The correct sequencing is: establish the secure Electron shell with PDF worker resolution first, then add the two native features (folder watcher + notifications) that require IPC plumbing, then produce cross-platform installers. This order ensures each phase builds on a stable foundation and prevents the most costly rework scenarios.

## Key Findings

### Recommended Stack

Electron ^34 wraps the existing Vite 8 / React 19 renderer with no changes to `src/`. The main process uses chokidar ^4 (pure JS, no `electron-rebuild`) for folder watching and Electron's native `Notification` API for OS alerts. `electron-builder ^25` produces Windows NSIS, macOS DMG, and Linux AppImage installers from a single configuration. The preload pattern uses `@electron-toolkit/preload` to reduce boilerplate.

**Core technologies:**
- **Electron ^34**: Desktop shell — ships Chromium 132 + Node 22; contextIsolation + preload is the required security pattern
- **electron-builder ^25**: Cross-platform packaging — single config produces Win/Mac/Linux installers; handles code signing and auto-update wiring
- **chokidar ^4**: Folder watcher — pure JS (no native rebuild), cross-platform FSEvents normalization, `awaitWriteFinish` prevents partial-file reads
- **Vite ^8 (existing)**: Renderer build — output to `dist/`; Electron loads `dist/index.html` via `loadFile` in production
- **concurrently + wait-on**: Dev workflow — `concurrently "vite" "wait-on http://localhost:5173 && electron ."` for parallel dev startup

### Expected Features

The web UI already ships: setup wizard, dashboard, weekly ritual score, PDF import with auto-categorization, goal tracking, history charts, and streak tracking. The Electron v1 milestone adds the desktop-native layer on top.

**Must have (table stakes — v1):**
- Electron shell with correct security config (contextIsolation: true, nodeIntegration: false, preload script)
- PDF worker path resolution in packaged builds (pdfjs-dist worker must resolve in asar/extraResources)
- electron-builder cross-platform installer (Windows NSIS, macOS DMG, Linux AppImage)
- Goal weekly savings calculator (low complexity, high value — already scoped in PROJECT.md)

**Should have (differentiators — v1.x):**
- Folder watcher for auto PDF import — zero-friction ingestion via chokidar; user still approves imports
- Native OS overspending notifications — proactive mid-week alert, no browser permission prompt
- Manual JSON export/import — addresses backup need without cloud sync

**Defer (v2+):**
- Cloud sync — changes product category to SaaS; breaks privacy promise
- Bank API / Plaid integration — antithetical to local-first value prop
- Custom budget categories — more cognitive load defeats the <10-min ritual goal
- Mobile companion app — desktop-native UX doesn't translate

### Architecture Approach

The architecture is a standard Electron two-process model: a main process that owns OS-level capabilities (file system via chokidar, native notifications, BrowserWindow lifecycle) and a renderer process that is the unmodified Vite bundle. The preload script is the only bridge — it exposes exactly 4 typed IPC channels via `contextBridge.exposeInMainWorld('electronAPI', {...})`. The renderer never touches Node APIs directly.

**Major components:**
1. **`electron/main.js`** — BrowserWindow creation, ipcMain handlers, chokidar watcher lifecycle, Notification dispatch
2. **`electron/preload.js`** — contextBridge IPC surface: `setWatchFolder`, `onPdfQueued`, `sendNotification`, `getAppVersion`
3. **`src/` (unchanged)** — React app: useStore.jsx (localStorage state), pdfParser.js (pdfjs-dist), App.jsx (routing/tabs)
4. **`electron-builder.yml`** — Packaging: points `files` at `dist/` + `electron/`; `extraResources` for pdfjs worker; asar + asarUnpack for native modules

### Critical Pitfalls

1. **pdfjs worker path broken in production** — Worker URL resolves differently inside asar. Fix: copy worker via `extraResources`, set `GlobalWorkerOptions.workerSrc` based on `app.isPackaged`. Address in Phase 1 before any other work.
2. **IPC surface grows insecure** — Ad-hoc IPC channels without validation create an XSS-to-filesystem attack vector (malicious PDF content). Fix: define a typed IPC contract (4 channels max) in Phase 1; validate all renderer-supplied paths before any fs operation.
3. **localStorage lost on appId change** — Changing `appId` in electron-builder config moves the userData directory; all user data silently disappears. Fix: lock `appId: "com.budgetpulse.app"` on day one; treat it as immutable.
4. **chokidar fires on incomplete files (Windows)** — `add` event fires before Chrome finishes writing `.crdownload` → rename. Fix: always use `awaitWriteFinish: { stabilityThreshold: 500 }` and filter by `.pdf` extension.
5. **Notifications silent in packaged builds** — macOS requires signed bundle ID; Linux requires `libnotify`. Fix: wrap in `Notification.isSupported()` check; test in signed packaged build, not just `electron .` dev mode.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Electron Shell & Security Baseline
**Rationale:** Everything else depends on a correctly configured Electron process. The PDF worker path, IPC contract, appId, and dev/prod URL split must all be correct before adding features — retrofitting any of these is expensive. Three of the five critical pitfalls are Phase 1 concerns.
**Delivers:** A working Electron window that loads the existing React UI, with correct security config, PDF import functioning in both dev and packaged builds, and a stable userData path.
**Addresses:** Electron shell + security config (P1), PDF worker path resolution (P1)
**Avoids:** Pitfalls 1 (pdfjs worker), 2 (IPC contract), 3 (appId lock), 8 (Vite output path mismatch)
**Research flag:** Standard patterns — Electron preload + contextBridge is well-documented; skip dedicated research phase.

### Phase 2: Native Desktop Features
**Rationale:** Folder watcher and native notifications both require the IPC bridge established in Phase 1. They are independent of each other but share the same infrastructure. Bundling them avoids a second round of IPC plumbing work.
**Delivers:** Auto-import via folder watch (user designates a folder; PDFs queued for review automatically) + native OS overspending notifications (fires from main process, no permission prompt).
**Uses:** chokidar ^4 (awaitWriteFinish), Electron Notification API, the 4-channel IPC contract from Phase 1
**Implements:** Folder watcher component in main.js, notification dispatch handler
**Avoids:** Pitfalls 4 (chokidar Windows duplicates), 5 (notification silent failures), 10 (UI blocking during PDF import)
**Research flag:** Standard patterns for chokidar and Electron Notification — skip research phase. Verify on Windows VM for chokidar rename sequence.

### Phase 3: Packaging & Distribution
**Rationale:** Installer packaging is a verification phase as much as a build phase — it surfaces asar issues, icon requirements, per-platform behavior differences (window close behavior, UAC elevation), and signing requirements that can't be caught in dev mode.
**Delivers:** Cross-platform installers (Windows NSIS without UAC, macOS DMG, Linux AppImage) + goal weekly savings calculator (low-complexity UI feature, include in v1 alongside the installer).
**Uses:** electron-builder ^25, `electron-builder.yml` with extraResources + asarUnpack config
**Avoids:** Pitfalls 4 (asar swallowing native modules / pdfjs worker), packaging-specific variants of Pitfalls 1 and 5
**Research flag:** Standard electron-builder patterns — skip research phase. Requires multi-platform smoke test before shipping.

### Phase Ordering Rationale

- **Phase 1 must be first** because the PDF worker path and IPC contract are foundational — changing them after feature work requires revisiting every IPC handler and every place `workerSrc` is set.
- **Phase 2 before Phase 3** because folder watcher and notification features need to be present and working before the packaged installer can be tested end-to-end. Testing packaging without features risks a false pass.
- **Goal calculator deferred to Phase 3** because it's a pure UI/math feature with no Electron IPC dependencies — it can be dropped into the installer milestone without risk of delaying Phase 1 or 2.
- **v1.x features (JSON export, keyword rule editor) excluded from roadmap** — ship after validating the Electron build is stable with real users.

### Research Flags

Phases likely needing deeper research during planning:
- **None identified** — all three phases use well-documented, standard Electron patterns with high-confidence sources.

Phases with standard patterns (skip research phase):
- **Phase 1:** contextIsolation + preload + contextBridge is the Electron canonical pattern since v12; electron-toolkit reduces boilerplate further.
- **Phase 2:** chokidar watch-in-main + IPC-forward is the standard Electron folder-watch pattern; Electron Notification API docs are complete.
- **Phase 3:** electron-builder multi-platform config is extensively documented with examples for exactly this Vite + Electron setup.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations backed by official Electron docs and electron-builder docs; chokidar v4 pure-JS confirmed on npm |
| Features | HIGH | All v1 features already validated in existing web UI; active features are clearly scoped in PROJECT.md |
| Architecture | HIGH | Standard Electron two-process model with preload; IPC channel design is minimal and well-reasoned |
| Pitfalls | HIGH | pdfjs/asar and chokidar/Windows issues are well-documented community pain points; prevention strategies are confirmed |

**Overall confidence:** HIGH

### Gaps to Address

- **Code signing setup:** Research didn't cover the specific cert acquisition and `electron-builder` signing config for macOS notarization and Windows Authenticode. This is required for notifications to work reliably on macOS packaged builds. Address during Phase 3 planning.
- **pdfjs-dist version compatibility:** The extraResources approach is confirmed for pdfjs-dist ^4.x; the project uses ^5.7 (per STACK.md). Worker filename may differ (`pdf.worker.min.mjs` vs `pdf.worker.mjs`). Verify exact filename before Phase 1 implementation.
- **Window tray behavior on Linux:** AppImage + system tray interaction varies by desktop environment (GNOME, KDE, XFCE). If tray is used for notifications, test on at least 2 Linux DEs.

## Sources

### Primary (HIGH confidence)
- Electron contextBridge and security docs — IPC security patterns, preload script setup, contextIsolation requirement
- electron-builder GitHub + docs — multi-platform targets, extraResources, asar/asarUnpack configuration
- PROJECT.md — validated and active feature set, product positioning

### Secondary (MEDIUM confidence)
- chokidar npm / README — v4 pure-JS confirmation, awaitWriteFinish configuration
- electron-vite guide — Vite + Electron integration patterns (referenced for dev/prod URL split)
- pdfjs-dist Mozilla wiki — GlobalWorkerOptions.workerSrc configuration requirements

### Tertiary (LOW confidence)
- Community post-mortems (electron/electron GitHub issues, r/electronjs) — Windows chokidar rename sequence behavior, Linux notification daemon requirements

---
*Research completed: 2026-05-16*
*Ready for roadmap: yes*
