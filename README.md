# BudgetPulse

A cross-platform native desktop budgeting app built with Electron, React, and Vite. Track weekly spending, set savings goals, and import credit card statements automatically — no browser, no backend, no cloud.

## Features

- **Weekly score (0–100)** — composite score across savings rate, category discipline, transaction logging, and streak
- **6 spending categories** — Food, Transport, Entertainment, Shopping, Big Purchases, Savings, each with a configurable weekly budget
- **Guided weekly ritual** — 5-step review flow that locks in your score and advances the week
- **Savings goals** — set a target amount and date; the app calculates how much you need to save per week to hit it on time
- **PDF statement import** — drag-drop a Chase, Amex, Citi, or generic bank PDF and transactions are parsed and auto-categorized
- **Folder watcher** — point the app at a downloads folder; any PDF that lands there is automatically parsed and imported
- **Native OS notifications** — get alerted when a spending category goes over budget
- **History charts** — weekly score and savings trends via Recharts line charts
- **100% local** — all data in `localStorage`, nothing leaves your machine

## Stack

| Layer | Choice |
|---|---|
| Shell | Electron 42 (bundles Chromium — zero system deps on any OS) |
| Build | electron-vite 5 + Vite 8 |
| UI | React 19 + Tailwind v4 + Framer Motion |
| Charts | Recharts |
| PDF parsing | pdfjs-dist (client-side, no server) |
| Folder watching | chokidar 5 (pure JS, no native addons) |
| Packaging | electron-builder (.exe / .dmg / .AppImage / .deb) |

## Install and run

### One-shot installer (no authentication needed)

Download and run the latest pre-built release (no GitHub account required):

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/shrijitb/budget-pulse/main/install-release.sh | bash
```

**Windows (Run as Administrator):**
```cmd
install-release.bat
```

Or download and run the installer scripts:
- **macOS/Linux:** `./install-release.sh`
- **Windows:** `install-release.bat`

### Manual installation (requires GitHub access)

If you have access to the private repo:

```bash
git clone https://github.com/shrijitb/budget-pulse.git && cd budget-pulse && npm install && npm run dev
```

> **Note for VS Code users:** VS Code sets `ELECTRON_RUN_AS_NODE=1` in child processes. The `dev` script already handles this with `env -u ELECTRON_RUN_AS_NODE`.

## Building distributables

```bash
npm run build:linux   # AppImage + .deb
npm run build:mac     # .dmg
npm run build:win     # NSIS installer
```

Output lands in `dist/`.

## Project structure

```
src/
  main/         Electron main process (IPC, folder watcher, notifications)
  preload/      contextBridge API surface exposed to renderer
  components/   React UI components
  store/        useStore — React Context + useReducer + localStorage
  utils/        scoring, categorizer, pdfParser, recommendations
```

## PDF import

Supports Chase (`MM/DD merchant amount`), Amex (`MM/DD/YYYY merchant $amount`), and a generic fallback pattern. Parsed transactions go through a review screen where you can toggle and re-categorize before importing.

## Scoring algorithm

| Component | Weight |
|---|---|
| Savings rate vs. income | 40 pts |
| Category discipline (under budget) | 30 pts |
| Transaction logging (≥5 txs) | 20 pts |
| Streak (consecutive ritual weeks) | 10 pts |

Tiers: **Elite** (90+) · **Strong** (75+) · **Steady** (60+) · **Building** (45+) · **Starting** (<45)

## Maintainer: Setting up release publishing

CI publishes release binaries to a separate public repo (`shrijitb/budget-pulse-releases`) so installers work without GitHub authentication.

**One-time setup (already done if releases are working):**

1. Create the public repo:
   ```bash
   gh repo create shrijitb/budget-pulse-releases --public --description "BudgetPulse release binaries"
   ```

2. Create a GitHub Personal Access Token (classic) with `public_repo` scope:
   https://github.com/settings/tokens/new

3. Add it as a secret named `RELEASES_PAT` on this private repo:
   ```bash
   gh secret set RELEASES_PAT --repo shrijitb/budget-pulse --body "ghp_..."
   ```

CI will then publish to both repos on every push to `main`. The public repo assets require no authentication to download.
