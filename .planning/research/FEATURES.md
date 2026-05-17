# Feature Research

**Domain:** Local-first desktop budgeting app (Electron + React)
**Researched:** 2026-05-16
**Confidence:** HIGH (all validated features are already shipped in the v0 web UI; active features are well-scoped in PROJECT.md)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a desktop budgeting app must have. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Setup wizard (income + budget allocation) | Users need a guided first-run to configure spending plan | LOW | ✓ Validated in v0 web |
| Dashboard with spending overview | Users expect at-a-glance weekly status | LOW | ✓ Validated: score ring, category bars, recent transactions |
| Transaction log with category assignment | Core data entry — budgeting without transactions is meaningless | LOW | ✓ Validated: manual entry + category override |
| PDF bank statement import | Desktop-native data ingestion; replaces manual entry for power users | MEDIUM | ✓ Validated: pdfjs-dist, 100+ keyword rules, 6 categories |
| Goal tracking | Saving toward something specific is primary motivation to budget | MEDIUM | ✓ Validated: create, fund, ETA, optional target date |
| Spending history with trends | Users need to see improvement over time to stay motivated | MEDIUM | ✓ Validated: score/savings charts, projections |
| Data persistence (local, no account) | Core value prop — data must survive app restarts without a login | LOW | ✓ Validated: localStorage `budgetpulse_v1` |
| Native installer (no dev dependencies) | Desktop app expectation — double-click to install, not `npm start` | MEDIUM | Active: electron-builder targeting Win/Mac/Linux |

### Differentiators (Competitive Advantage)

Features that make BudgetPulse distinct from YNAB, Copilot, and spreadsheets.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Weekly ritual with 0–100 score | Turns budgeting into a short, repeatable ritual with a clear outcome — not open-ended anxiety | MEDIUM | ✓ Validated: 5-step flow, streak tracking; must complete in <10 min |
| Auto-categorization from PDF import | Eliminates the most tedious manual work (tagging 50 transactions) | MEDIUM | ✓ Validated: 100+ keyword rules across 6 categories |
| Streak tracking on weekly ritual | Behavioral trigger — streaks make users return even when numbers are bad | LOW | ✓ Validated; pairs with the score to create accountability |
| Folder watcher for auto PDF import | Zero-friction ingestion — drop PDF in folder, app handles the rest | MEDIUM | Active: chokidar-based; queues PDFs for review (user still approves) |
| Goal weekly savings calculator | Converts vague goals into concrete weekly actions ("save $47/week by Oct") | LOW | Active: target date + weekly amount shown on goal card |
| Native OS overspending notifications | Proactive mid-week alert before the week is ruined — not just a retroactive score | MEDIUM | Active: Electron Notification API (no browser permission prompt) |
| No accounts, no cloud, no subscription | Privacy + zero recurring cost — desktop app users are allergic to SaaS creep | LOW | Structural, maintained by keeping all data in localStorage |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cloud sync | "I want my data on multiple devices" | Changes product category from local-first to SaaS; adds auth, backend, GDPR surface, and subscription pressure | Offer manual export/import (JSON backup) as a v1.x feature instead |
| Bank API / Plaid integration | "PDF import is annoying" | OAuth scope liability, data broker concerns, recurring API cost, and breaks the privacy promise | Keep PDF import as intentional friction — it's a feature, not a bug |
| Mobile companion app | "I want to log transactions on my phone" | Entire UX is desktop-native; ritual and PDF import don't translate to mobile | Out of scope — separate product if ever |
| Multi-currency support | "I travel / have foreign accounts" | Complicates scoring, categorization, and history charts; not validated by any user | Defer until post-PMF; single currency is a constraint, not a bug |
| Shared / household budgets | "My partner needs access" | Single-user state model would need a full rewrite; multi-user = multi-conflict resolution | Out of scope; encourage separate instances per person |
| Real-time bank sync | "Manual import is friction" | Requires credentials, open banking API, recurring trust — antithetical to the product | PDF import is the correct friction level for a privacy-first tool |
| Custom category creation | "6 categories isn't enough" | More categories = more cognitive load during ritual; defeats the <10 min goal | Keep 6 fixed categories; allow keyword rule customization in v1.x if validated |

---

## Feature Dependencies

```
[Weekly Ritual Score]
    └──requires──> [Transaction Log]
                       └──requires──> [Budget Allocation (Setup Wizard)]
    └──requires──> [Budget Allocation (Setup Wizard)]

[PDF Import]
    └──requires──> [Transaction Log] (imports land as transactions)
    └──enhances──> [Auto-Categorization] (keyword rules applied at parse time)

[Folder Watcher]
    └──requires──> [PDF Import] (watches for PDFs, delegates to existing parser)
    └──requires──> [Electron Main Process] (chokidar runs in main, not renderer)
    └──requires──> [IPC Bridge (preload)] (main → renderer event channel)

[Native OS Notifications]
    └──requires──> [Electron Main Process]
    └──requires──> [IPC Bridge (preload)] (renderer triggers main to fire notification)
    └──requires──> [Transaction Log] (needs spend data to detect overage)

[Goal Weekly Savings Calculator]
    └──requires──> [Goal Management]
    └──requires──> [Budget Allocation] (weekly income is the baseline)

[History Charts / Projections]
    └──requires──> [Weekly Ritual Score] (needs score history)
    └──requires──> [Transaction Log] (needs spending history)

[Streak Tracking]
    └──requires──> [Weekly Ritual]

[Electron Installer]
    └──requires──> [Electron Main Process]
    └──requires──> [Vite Production Build] (renderer is compiled bundle)
    └──requires──> [PDF Worker Path Config] (pdfjs worker must resolve in packaged app)
```

### Dependency Notes

- **Folder Watcher requires Electron Main Process:** chokidar uses Node.js fs APIs unavailable in a sandboxed renderer. Must run in main and forward events via IPC.
- **Native Notifications require IPC Bridge:** The renderer detects an overspend condition but cannot call `new Notification()` (Electron's) directly — it sends an IPC message and main fires the OS notification.
- **PDF Worker Path Config is a packaging prerequisite:** Without correct worker resolution, PDF import silently fails in production builds. This must be solved before the Electron installer is usable.
- **Goal Weekly Savings Calculator is self-contained:** Purely a UI/math feature on top of existing Goal Management — no new IPC or main-process work needed.

---

## MVP Definition

### Launch With (v1 — Electron Desktop)

The web UI is already feature-complete. The Electron v1 milestone is about making it a real desktop app.

- [x] **Setup wizard + dashboard + ritual + goals + history** — already shipped in v0 web; carry over unchanged
- [x] **PDF import with auto-categorization** — already shipped; validate pdfjs-dist worker path in Electron
- [ ] **Electron shell with correct security config** — contextIsolation, nodeIntegration: false, preload script
- [ ] **PDF worker path resolution** — must work in both `vite dev` and packaged `electron-builder` output
- [ ] **electron-builder installer** — Windows NSIS, macOS DMG, Linux AppImage; single binary, no runtime deps
- [ ] **Goal weekly savings calculator** — low-complexity UI feature; high user value; include in v1

### Add After Validation (v1.x)

Features to add once the Electron build is stable and users are running it.

- [ ] **Folder watcher for auto PDF import** — high value but requires IPC plumbing; add after core Electron is stable
- [ ] **Native OS overspending notifications** — also requires IPC; add alongside folder watcher
- [ ] **Manual JSON export/import** — addresses the "I want a backup" need without cloud sync
- [ ] **Keyword rule editor** — let users add categorization keywords without shipping a code change

### Future Consideration (v2+)

Defer until post-PMF with real user feedback.

- [ ] **Custom budget categories** — only add if 6-category model is consistently cited as a blocker
- [ ] **Multiple budget profiles** — for users with irregular income; validate need first
- [ ] **Dark/light theme toggle** — current dark glassmorphism is intentional; add only if users ask

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Electron shell + security config | HIGH | MEDIUM | P1 |
| PDF worker path fix for packaged app | HIGH | LOW | P1 |
| electron-builder cross-platform installer | HIGH | LOW | P1 |
| Goal weekly savings calculator | HIGH | LOW | P1 |
| Folder watcher (auto PDF import) | HIGH | MEDIUM | P2 |
| Native OS overspending notifications | MEDIUM | MEDIUM | P2 |
| Manual JSON export/import | MEDIUM | LOW | P2 |
| Keyword rule editor | LOW | MEDIUM | P3 |
| Custom categories | LOW | HIGH | P3 |
| Dark/light theme toggle | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v1 Electron release
- P2: Ship in v1.x after validating core Electron build
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | YNAB | Copilot | BudgetPulse Approach |
|---------|------|---------|----------------------|
| Data storage | Cloud (subscription) | Cloud (subscription) | Local only — no account |
| Bank connection | Plaid API | Plaid API | PDF import (intentional) |
| Budget model | Envelope / zero-based | Category-based | 6 fixed categories + weekly allocation |
| Mobile | iOS + Android | iOS only | Desktop-native; no mobile |
| Ritual / review flow | Monthly reports | Spending insights | Weekly 5-step ritual with score |
| Goal tracking | Yes (targets + timelines) | Basic | Yes (target date + weekly savings calc) |
| Notifications | Email/push | Push | Native OS system tray |
| Price | $109/yr | $99/yr | Free (self-contained installer) |
| Privacy | Data leaves device | Data leaves device | All data stays on device |

**Observation:** YNAB and Copilot are cloud-SaaS with subscription pricing. BudgetPulse's differentiator is not feature count — it's the privacy+ritual combination at zero recurring cost. Features should only be added if they serve that positioning.

---

## Sources

- PROJECT.md — primary source for validated and active features
- YNAB feature set: public knowledge (web app, subscription model)
- Copilot Money feature set: public knowledge (iOS app, subscription model)
- Electron security docs: contextIsolation and preload patterns (Electron 30+ best practice)
- chokidar: cross-platform file system watcher, widely used in Electron apps for folder watching
- pdfjs-dist: Mozilla PDF.js library, works in Electron renderer without modification

---
*Feature research for: BudgetPulse — local-first desktop budgeting app*
*Researched: 2026-05-16*
