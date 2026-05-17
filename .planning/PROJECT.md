# BudgetPulse

## What This Is

BudgetPulse is a cross-platform desktop budgeting app for people who want financial discipline without open banking or cloud accounts. Users set a weekly income, allocate budgets across 6 categories, import bank PDFs, log transactions, and complete a guided weekly ritual to earn a 0–100 score. All data stays local — no accounts, no subscriptions, no sync.

## Core Value

The weekly ritual must complete in under 10 minutes and produce a score that makes the user feel either motivated or appropriately accountable.

## Requirements

### Validated

- ✓ Setup wizard (income + budget allocation + first goal) — v0 web
- ✓ Dashboard with weekly score ring, category bars, and recent transactions — v0 web
- ✓ 5-step weekly ritual with streak tracking — v0 web
- ✓ Goal management (create, fund, track ETA, optional target date) — v0 web
- ✓ History tab with score/savings trend charts and projections — v0 web
- ✓ PDF bank statement import with auto-categorization (100+ keywords, 6 categories) — v0 web
- ✓ Manual transaction entry with category override — v0 web
- ✓ LocalStorage persistence (key: `budgetpulse_v1`) — v0 web

### Active

- [ ] Electron shell wrapping the existing web UI — no system dependencies at install time (ship as single binary/installer)
- [ ] Folder watcher for auto PDF import — user designates a folder; new PDFs are parsed and queued for review automatically
- [ ] Goal target date + weekly savings calculation — show "save $X/week to hit goal by [date]" on each goal card
- [ ] Native OS overspending notifications — system tray alert when a category exceeds budget mid-week

### Out of Scope

- Cloud sync / accounts — the entire value proposition is local-first; adding a backend changes the product category
- Mobile app — the ritual UX and PDF import workflow are desktop-native; a mobile port is a separate product
- Bank API / open banking — PDF import is intentional friction that avoids OAuth scopes and data liability
- Multi-currency — not validated; adds complexity to scoring and categorization before core is proven
- Shared / household budgets — single-user model keeps state simple and the ritual personal

## Context

- The web UI is fully functional and production-quality (React 19, Vite, Tailwind v4, Framer Motion, Recharts, pdfjs-dist).
- State is managed via Context + Reducer in `src/store/useStore.jsx`; persisted to localStorage as `budgetpulse_v1`.
- PDF parsing uses `pdfjs-dist` directly in the browser — this works in Electron's renderer process without changes.
- The UI is mobile-first (max-width 480px) and dark-themed with glassmorphism; it will render correctly inside an Electron window at a fixed width.
- No existing Electron config — this is a greenfield Electron integration on top of a mature web codebase.
- `.planning/config.json` sets `mode: yolo` with parallel workflows and auto-advance — aggressive development style is expected.

## Constraints

- **Tech stack**: Electron must wrap the existing Vite build without ejecting or rewriting the React app — the renderer is the compiled web bundle.
- **Distribution**: Ship as a self-contained installer (electron-builder) for Windows, macOS, and Linux; no Node.js or Python required on the user's machine.
- **Security**: Electron `contextIsolation: true` and `nodeIntegration: false` in the renderer; use a preload script for any IPC.
- **Data**: All user data stays on-device; no telemetry, no remote calls.
- **PDF worker**: `pdfjs-dist` requires its worker file to be accessible — must configure the worker path correctly for both dev and production Electron builds.
- **Notifications**: Use Electron's `Notification` API (not the Web Notifications API) for native OS alerts to avoid permission prompts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | pdfjs-dist ships a JS worker; Rust-based Tauri would complicate the worker bundling and Wasm story | — Pending |
| electron-builder for packaging | Single tool handles Windows NSIS, macOS DMG, Linux AppImage; broad community support | — Pending |
| Preload script + contextBridge for IPC | Required by Electron security best practices; renderer stays sandboxed while accessing folder-watcher events | — Pending |
| Folder watcher via chokidar | Mature, cross-platform, handles Windows/macOS/Linux FSEvents consistently | — Pending |
| Keep localStorage as data store | Electron's renderer has full localStorage access; no migration needed for existing users | — Pending |

---
*Last updated: 2026-05-16 after initial research phase*
