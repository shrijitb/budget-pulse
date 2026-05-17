---
phase: 1
slug: electron-desktop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + `npm run build` (no unit test suite yet) |
| **Config file** | none |
| **Quick run command** | `npm run dev` (Electron window opens, no console errors) |
| **Full suite command** | `npm run build` (production build succeeds) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run dev` and verify Electron window opens with no blank screen
- **After every plan wave:** Run `npm run build` — zero errors
- **Before `/gsd-verify-work`:** Full build + Plan 03 human checkpoint
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | Manual Check | Status |
|---------|------|------|-------------|-------------------|--------------|--------|
| 01-01-T1 | 01-01 | 1 | ELEC-01–05, PDF-04 | `npm run dev` → window opens at 480px | Dashboard loads, no white screen | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | DATA-01–02 | `npm run build` → exits 0 | — | ⬜ pending |
| 01-02-T1 | 01-02 | 2 | GOAL-04–05 | grep `getWeeklyRequired` src/components/Goals.jsx | GoalCard shows "$X/week" text | ⬜ pending |
| 01-02-T2 | 01-02 | 2 | ELEC-03, PDF-04 | grep `electronAPI` src/components/AddTransaction.jsx | Notification fires on overspend | ⬜ pending |
| 01-03-T1 | 01-03 | 3 | All | `npm run build 2>&1 \| grep -c error` → 0 | — | ⬜ pending |
| 01-03-T2 | 01-03 | 3 | All | Human checkpoint (28-step checklist) | All tabs functional, localStorage persists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework install required. Existing infrastructure (Vite build + manual Electron launch) covers all phase verification needs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App launches on double-click | ELEC-01 | Requires packaged binary | Run `npm run build` then open `dist/` binary |
| localStorage survives restart | DATA-02 | Requires real app restart | Add a transaction, close Electron, reopen |
| PDF folder watcher auto-imports | WATCH-01 | Requires file system event | Drop PDF into configured watch folder |
| Native notification fires | NOTIF-01 | Requires OS notification daemon | Add transaction exceeding category budget |
| PDF import works in packaged build | PDF-04 | ASAR path only breaks in production | Test from the packaged binary, not dev mode |
