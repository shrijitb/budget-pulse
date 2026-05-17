# Requirements: BudgetPulse

**Defined:** 2026-05-16
**Core Value:** Complete a weekly financial ritual in under 10 minutes and earn a 0–100 score — all data stays local, no accounts, no subscriptions.

---

## v1 Requirements — Electron Desktop Release

All web UI features are already validated in the v0 web build and carry over unchanged. v1 work is scoped to the Electron shell, packaging, and one net-new UI feature (goal savings calculator).

### Setup & Onboarding

- [ ] **SETUP-01**: First-run wizard prompts for weekly take-home income (numeric, required) before any other screen is shown.
- [ ] **SETUP-02**: Wizard presents 6 fixed budget categories (Housing, Food, Transport, Health, Entertainment, Savings) and allows the user to allocate a dollar amount to each; allocations must sum ≤ weekly income.
- [ ] **SETUP-03**: Wizard includes a "first goal" step where the user names a goal, sets a target amount, and optionally sets a target date.
- [ ] **SETUP-04**: Wizard can be completed in ≤ 3 steps and skipped back to from settings to update income or category allocations at any time.

### Dashboard

- [ ] **DASH-01**: Dashboard displays a weekly score ring showing the current 0–100 score prominently on load.
- [ ] **DASH-02**: Dashboard displays 6 category progress bars showing spent vs. budget for the current week.
- [ ] **DASH-03**: Dashboard displays a list of the 10 most recent transactions with date, description, amount, and category.
- [ ] **DASH-04**: Dashboard updates in real time when transactions are added or modified without requiring a page reload.

### Transaction Management

- [ ] **TXN-01**: User can manually add a transaction with fields: date (defaults to today), description (free text), amount (positive number), and category (one of 6 fixed categories).
- [ ] **TXN-02**: User can edit or delete any manually entered transaction.
- [ ] **TXN-03**: User can override the category of any transaction (including PDF-imported ones) via a dropdown.
- [ ] **TXN-04**: Transactions imported from PDF are visually distinguishable from manually entered ones (e.g., an import badge).

### PDF Import & Auto-Categorization

- [ ] **PDF-01**: User can open a file-picker dialog and select a bank statement PDF; the app parses it and presents a list of extracted transactions for review before committing.
- [ ] **PDF-02**: Parser applies a keyword ruleset of ≥ 100 rules across 6 categories to automatically assign a category to each extracted transaction.
- [ ] **PDF-03**: User can accept all auto-categorized transactions in one action or edit individual categories before importing.
- [ ] **PDF-04**: The `pdfjs-dist` worker file resolves correctly in both `vite dev` mode and the packaged Electron build (no silent failure in production).
- [ ] **PDF-05**: If a PDF cannot be parsed (password-protected, unsupported format), the app shows a clear error message explaining why — it does not crash or silently fail.

### Goal Management

- [ ] **GOAL-01**: User can create a savings goal with a name and a target dollar amount.
- [ ] **GOAL-02**: User can optionally set a target date on any goal; target date can be added or changed after creation.
- [ ] **GOAL-03**: User can add funds to a goal (manual contribution); goal shows current saved amount and remaining amount.
- [ ] **GOAL-04**: Each goal card with a target date displays "Save $X/week to reach by [date]" calculated as `(target − saved) / weeks_remaining`, updated each time the app loads.
- [ ] **GOAL-05**: Goal card displays a visual indicator (e.g., color change or warning icon) when the weekly savings required exceeds the weekly savings budget allocation.
- [ ] **GOAL-06**: User can delete a goal; deletion requires a single confirmation step.

### Weekly Ritual

- [ ] **RITUAL-01**: Weekly ritual is a sequential 5-step flow: (1) review last week's score, (2) review category spending, (3) categorize any uncategorized transactions, (4) update goal contributions, (5) set intention for next week.
- [ ] **RITUAL-02**: The full ritual can be completed in ≤ 10 minutes under normal use (≤ 50 transactions, ≤ 5 goals).
- [ ] **RITUAL-03**: Completing the ritual produces a 0–100 score based on: budget adherence per category, goal funding progress, and streak continuity.
- [ ] **RITUAL-04**: Streak counter increments by 1 each time the ritual is completed within the same calendar week; breaks if a week is missed.
- [ ] **RITUAL-05**: Score and streak are persisted and visible on the dashboard immediately after the ritual is submitted.

### History & Analytics

- [ ] **HIST-01**: History tab displays a line chart of weekly scores over at least 12 weeks (or all available history if less).
- [ ] **HIST-02**: History tab displays a savings trend chart (cumulative savings vs. time).
- [ ] **HIST-03**: History tab displays a projection of savings at the current rate extending 8 weeks forward.
- [ ] **HIST-04**: History data is readable even when only 1–2 weeks of history exist (charts handle sparse data gracefully).

### Data Persistence

- [ ] **DATA-01**: All user data (income, allocations, transactions, goals, scores, streaks) is stored in `localStorage` under the key `budgetpulse_v1`.
- [ ] **DATA-02**: Data survives app restarts — closing and reopening the Electron app shows the same state as before.
- [ ] **DATA-03**: No data is transmitted off-device; the app makes no outbound network requests at runtime (verifiable via network inspector with no network activity).
- [ ] **DATA-04**: Corrupted or missing localStorage data causes the app to fall back to the setup wizard — it does not crash with an unhandled error.

### Electron Shell & Security

- [ ] **ELEC-01**: App launches via a standard OS entry point (double-click `.exe`/`.dmg`/`.AppImage`) with no terminal or CLI step required.
- [ ] **ELEC-02**: Electron `BrowserWindow` is configured with `contextIsolation: true` and `nodeIntegration: false` in the renderer.
- [ ] **ELEC-03**: A preload script exposes a `contextBridge` API that is the only channel between the renderer and main process — no raw `ipcRenderer.invoke` calls are exposed directly.
- [ ] **ELEC-04**: The renderer loads the compiled Vite production bundle; no Vite dev server is required at runtime.
- [ ] **ELEC-05**: App window opens at a fixed width of 480px (matching the mobile-first UI design) and is resizable.
- [ ] **ELEC-06**: App icon is set for all three platforms (Windows `.ico`, macOS `.icns`, Linux `.png`).

### Distribution & Installer

- [ ] **DIST-01**: `electron-builder` produces a Windows NSIS installer (`.exe`) that installs the app without requiring Node.js or Python on the target machine.
- [ ] **DIST-02**: `electron-builder` produces a macOS DMG (`.dmg`) with a drag-to-Applications install UX.
- [ ] **DIST-03**: `electron-builder` produces a Linux AppImage (`.AppImage`) that runs without system package installation.
- [ ] **DIST-04**: A single `npm run build` (or equivalent) command produces all three platform artifacts in a `dist/` directory.
- [ ] **DIST-05**: Packaged app binary size does not exceed 200 MB per platform.

### Error Handling (Table Stakes)

- [ ] **ERR-01**: Unhandled renderer exceptions are caught by a global error boundary and display a user-readable message — the app does not show a blank white screen.
- [ ] **ERR-02**: Main process unhandled rejections are logged to a local log file (e.g., `app.getPath('logs')`) accessible without a debugger.
- [ ] **ERR-03**: All user-facing error messages describe what went wrong and what the user can do next — no raw stack traces are shown to the user.

---

## v1.x Requirements — Post-Core Validation

Add after the Electron build is stable and users are running it. Not in the initial roadmap phases.

### Folder Watcher

- **WATCH-01**: User can designate a local folder path in settings as the "PDF import folder."
- **WATCH-02**: `chokidar` watches the configured folder in the Electron main process; when a new `.pdf` file appears, it is automatically parsed using the existing PDF parser.
- **WATCH-03**: Detected PDFs are queued for review — auto-import does not commit transactions without user confirmation.
- **WATCH-04**: A notification or in-app badge alerts the user that new PDFs are pending review.
- **WATCH-05**: Folder watcher works cross-platform (Windows, macOS, Linux) including network-mounted drives common in home environments.

### Native OS Notifications

- **NOTIF-01**: When a transaction is added (manually or via import) that pushes any category over its weekly budget, a native OS notification fires.
- **NOTIF-02**: Notification content shows: category name, amount over budget, and remaining weekly budget for that category.
- **NOTIF-03**: Notifications use Electron's `Notification` API (main process), not the Web Notifications API, to avoid browser permission prompts.
- **NOTIF-04**: Notifications are non-blocking — they appear in the OS notification center and do not interrupt focus or require app to be in foreground.
- **NOTIF-05**: User can disable overspending notifications via a toggle in app settings.

### Data Portability

- **PORT-01**: User can export all app data as a single JSON file via a menu action.
- **PORT-02**: User can import a previously exported JSON file to restore data; import warns before overwriting existing data.
- **PORT-03**: Exported JSON format is documented (keys match the `budgetpulse_v1` localStorage schema) so it is human-readable.

---

## v2+ Considerations

Deferred until post-PMF with real user feedback. Not in any current roadmap phase.

- **KW-01**: User can add custom keyword-to-category mapping rules without modifying code (keyword rule editor UI).
- **THEME-01**: User can toggle between dark and light theme (current dark glassmorphism is intentional default).
- **INCOME-01**: App supports irregular income (multiple income entries per week, e.g., freelance).

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud sync / accounts | Changes product category from local-first to SaaS; entire value proposition is local data |
| Mobile app | Ritual UX and PDF import are desktop-native; mobile is a separate product |
| Bank API / Plaid / open banking | Requires OAuth, data liability, and recurring API cost; PDF import is intentional friction |
| Multi-currency | Not validated; complicates scoring and categorization before core is proven |
| Shared / household budgets | Single-user state model; multi-user requires conflict resolution rewrite |
| Custom budget categories | More categories increase cognitive load during ritual; defeats the <10 min completion goal |
| Real-time bank sync | Requires credentials and open banking trust; antithetical to privacy-first positioning |

---

## Traceability

Populated during roadmap phase assignment.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| DASH-01 | Phase 1 | Pending |
| DASH-02 | Phase 1 | Pending |
| DASH-03 | Phase 1 | Pending |
| DASH-04 | Phase 1 | Pending |
| TXN-01 | Phase 1 | Pending |
| TXN-02 | Phase 1 | Pending |
| TXN-03 | Phase 1 | Pending |
| TXN-04 | Phase 1 | Pending |
| PDF-01 | Phase 2 | Pending |
| PDF-02 | Phase 2 | Pending |
| PDF-03 | Phase 2 | Pending |
| PDF-04 | Phase 2 | Pending |
| PDF-05 | Phase 2 | Pending |
| GOAL-01 | Phase 1 | Pending |
| GOAL-02 | Phase 1 | Pending |
| GOAL-03 | Phase 1 | Pending |
| GOAL-04 | Phase 2 | Pending |
| GOAL-05 | Phase 2 | Pending |
| GOAL-06 | Phase 1 | Pending |
| RITUAL-01 | Phase 1 | Pending |
| RITUAL-02 | Phase 1 | Pending |
| RITUAL-03 | Phase 1 | Pending |
| RITUAL-04 | Phase 1 | Pending |
| RITUAL-05 | Phase 1 | Pending |
| HIST-01 | Phase 1 | Pending |
| HIST-02 | Phase 1 | Pending |
| HIST-03 | Phase 1 | Pending |
| HIST-04 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| ELEC-01 | Phase 2 | Pending |
| ELEC-02 | Phase 2 | Pending |
| ELEC-03 | Phase 2 | Pending |
| ELEC-04 | Phase 2 | Pending |
| ELEC-05 | Phase 2 | Pending |
| ELEC-06 | Phase 3 | Pending |
| DIST-01 | Phase 3 | Pending |
| DIST-02 | Phase 3 | Pending |
| DIST-03 | Phase 3 | Pending |
| DIST-04 | Phase 3 | Pending |
| DIST-05 | Phase 3 | Pending |
| ERR-01 | Phase 2 | Pending |
| ERR-02 | Phase 2 | Pending |
| ERR-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 after initial research phase*
