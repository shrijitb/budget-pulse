---
phase: quick-260516-r2l
plan: "01"
subsystem: ci-release
tags: [ci, github-actions, installer, public-repo, auth-free]
dependency_graph:
  requires: []
  provides: [auth-free-install, public-releases-repo-ci]
  affects: [install-release.sh, install-release.bat, README.md, .github/workflows/build-release.yml]
tech_stack:
  added: []
  patterns: [gh-release-dual-publish, secrets.RELEASES_PAT]
key_files:
  created: []
  modified:
    - .github/workflows/build-release.yml
    - install-release.sh
    - install-release.bat
    - README.md
decisions:
  - "Tag `latest` on public repo is always force-replaced (delete + create) to keep a single stable install target"
  - "install-release.sh curl calls already had no auth headers — no curl changes needed beyond URL"
  - "README curl command unchanged — raw.githubusercontent.com script URL remains in private repo (correct: that's the script source, not an asset)"
metrics:
  duration: "~10 minutes"
  completed: 2026-05-16
  tasks_completed: 2
  tasks_total: 3
---

# Quick Plan 260516-r2l: Public Releases Repo for Auth-Free One-Shot Installs — Summary

**One-liner:** CI now dual-publishes release binaries to `shrijitb/budget-pulse-releases` (public) via `RELEASES_PAT`, and install scripts fetch from that public repo with no GitHub credentials.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 2 | Update CI workflow to publish to public releases repo | 6ceb9cc | .github/workflows/build-release.yml |
| 3 | Update install scripts and README to use public repo | a1834f7 | install-release.sh, install-release.bat, README.md |

Task 1 (create public repo + PAT secret) was skipped — manual prerequisite handled by the user.

## What Was Built

### Task 2 — CI Workflow

Added two steps to the existing `release` job in `.github/workflows/build-release.yml`, after the existing softprops/action-gh-release step:

- **Delete old public release:** `gh release delete latest --repo shrijitb/budget-pulse-releases --yes || true` (idempotent)
- **Create public release:** `gh release create latest ./release-assets/* --repo shrijitb/budget-pulse-releases` with RELEASES_PAT

All existing steps (matrix build, artifact download, private repo release) are unchanged.

### Task 3 — Install Scripts and README

**install-release.sh:**
- Comment updated: `# BudgetPulse installer — downloads from public releases repo (no auth required)`
- Banner updated: `One-Shot Installer` (removed "(Private Repo)")
- `RELEASES_URL` updated to `https://api.github.com/repos/shrijitb/budget-pulse-releases/releases/latest`
- curl calls already had no auth headers — confirmed and left as-is

**install-release.bat:**
- Banner updated: `BudgetPulse Installer` (removed "(Private Repo)")
- PowerShell URI updated to `https://api.github.com/repos/shrijitb/budget-pulse-releases/releases/latest`

**README.md:**
- Replaced "Since the repo is private, download the latest pre-built release:" with "Download and run the latest pre-built release (no GitHub account required):"
- Added `## Maintainer: Setting up release publishing` section at bottom with full RELEASES_PAT setup instructions

## Deviations from Plan

None — plan executed exactly as written. The install scripts' curl calls were already auth-free as expected; only the URL and banner text needed updating.

## Known Stubs

None.

## Threat Flags

None. The RELEASES_PAT threat mitigations (T-r2l-01, T-r2l-04) are satisfied by construction: PAT is referenced via `${{ secrets.RELEASES_PAT }}` (GitHub Actions masks it in logs), and scoping to `public_repo` is documented in the README maintainer section as a setup requirement.

## Self-Check

Files created/modified:
- .github/workflows/build-release.yml — exists, contains "budget-pulse-releases" and "RELEASES_PAT"
- install-release.sh — exists, targets budget-pulse-releases URL, passes bash -n
- install-release.bat — exists, targets budget-pulse-releases URL
- README.md — exists, contains RELEASES_PAT and Maintainer section

Commits:
- 6ceb9cc — Task 2 commit
- a1834f7 — Task 3 commit

## Self-Check: PASSED
