# Roadmap: BudgetPulse

## Overview

Three phases deliver a local-first desktop budgeting app: first, the Electron shell wraps the existing React/Vite web UI and verifies all pre-existing features work on desktop; second, Electron-native integration locks in the security model, PDF worker resolution for production builds, and the goal savings calculator; third, cross-platform installers ship the app.

## Phases

- [ ] **Phase 1: Electron Shell & Web UI Integration** - Wrap the existing web UI in Electron; verify all pre-existing features work on desktop with persistent data
- [ ] **Phase 2: Native Electron Integration** - Lock in security config, fix PDF worker path for production, add goal savings calculator, add error handling
- [ ] **Phase 3: Packaging & Distribution** - Produce Windows, macOS, and Linux installers via electron-builder

## Phase Details

### Phase 1: Electron Shell & Web UI Integration
**Goal**: The existing React/Vite web UI runs inside an Electron window and all pre-existing features (setup wizard, dashboard, transactions, goals, weekly ritual, history) are fully functional on desktop with data persisting across restarts.
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, DASH-01, DASH-02, DASH-03, DASH-04, TXN-01, TXN-02, TXN-03, TXN-04, GOAL-01, GOAL-02, GOAL-03, GOAL-06, RITUAL-01, RITUAL-02, RITUAL-03, RITUAL-04, RITUAL-05, HIST-01, HIST-02, HIST-03, HIST-04, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. App launches from double-click and shows the setup wizard on first run with no terminal required
  2. All 6 dashboard category bars update in real time when transactions are added or modified
  3. Weekly ritual completes all 5 steps and produces a score visible on the dashboard immediately after submission
  4. Goal cards, history charts, and PDF import all function inside the Electron window identically to the web build
  5. Closing and reopening the app shows the same state — localStorage data survives restarts
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Install electron-vite, create main process + preload + config, fix pdfjs worker path
- [ ] 01-02-PLAN.md — Goal weekly savings calc, overspending notifications, folder watcher UI + PDF IPC path
- [ ] 01-03-PLAN.md — Build verification and human end-to-end acceptance test
**UI hint**: yes

### Phase 2: Native Electron Integration
**Goal**: Electron security model is locked in, PDF worker resolves correctly in packaged builds, goal savings calculator is live, and unhandled errors surface to users with actionable messages.
**Depends on**: Phase 1
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, GOAL-04, GOAL-05, ELEC-01, ELEC-02, ELEC-03, ELEC-04, ELEC-05, ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. PDF import works in a packaged Electron build — pdfjs worker resolves without silent failure
  2. Goal cards with a target date display "Save $X/week to reach by [date]" calculated correctly
  3. Goal card shows a visual warning when required weekly savings exceeds the savings budget allocation
  4. contextIsolation is true and nodeIntegration is false — renderer has no direct Node access
  5. Unhandled renderer errors show a user-readable message; main process errors log to the OS log path
**Plans**: TBD

### Phase 3: Packaging & Distribution
**Goal**: Cross-platform installers ship for Windows, macOS, and Linux with app icons set on all platforms, producible from a single build command.
**Depends on**: Phase 2
**Requirements**: ELEC-06, DIST-01, DIST-02, DIST-03, DIST-04, DIST-05
**Success Criteria** (what must be TRUE):
  1. Windows NSIS installer installs and launches the app without requiring Node.js or Python on the target machine
  2. macOS DMG presents drag-to-Applications UX and the app opens correctly after install
  3. Linux AppImage runs without system package installation on a clean machine
  4. A single build command produces all three platform installers in the dist/ directory
  5. App icon appears correctly on all three platforms (Windows .ico, macOS .icns, Linux .png)
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Electron Shell & Web UI Integration | 0/3 | Not started | - |
| 2. Native Electron Integration | 0/? | Not started | - |
| 3. Packaging & Distribution | 0/? | Not started | - |
