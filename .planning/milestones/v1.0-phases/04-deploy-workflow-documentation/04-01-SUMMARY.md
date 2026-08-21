---
phase: 04-deploy-workflow-documentation
plan: 01
subsystem: infra
tags: [github-actions, pm2, lsof, ssh, deploy, sqlite]

# Dependency graph
requires:
  - phase: 01-server-db-consolidation
    provides: PM2 process name (timetracking-server) and pm2 pid decision
  - phase: 02-symlink-pm2-ecosystem
    provides: Canonical DB path /home/ubuntu/databases/production.db confirmed live
provides:
  - Post-deploy DB path verification in deploy-server.yml using pm2 pid + lsof
affects:
  - 04-02-PLAN (deploy-staging.yml updates, same file neighborhood)
  - Any future deploy-server.yml edits must preserve the verification step

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-deploy SSH verification step as a separate appleboy/ssh-action block (not appended to deploy script)"
    - "pm2 pid <name> for reliable PID resolution (not pgrep -f)"
    - "lsof -p + grep '\\.db$' dollar-anchor to exclude WAL/SHM files"
    - "PID guard: check empty or 0 before calling lsof"

key-files:
  created: []
  modified:
    - .github/workflows/deploy-server.yml

key-decisions:
  - "Verification step added as a second separate appleboy/ssh-action block (not appended to existing deploy script) for distinct step identity in Actions logs"
  - "Uses pm2 pid timetracking-server (confirmed Phase 1 decision) not pgrep -f"
  - "grep '\\.db$' dollar-anchor prevents matching production.db-wal or production.db-shm"
  - "Reuses existing SSH secrets (ORACLE_HOST, ORACLE_USER, ORACLE_SSH_KEY) — no new secrets needed"

patterns-established:
  - "Pattern: Post-deploy verification as dedicated SSH step after deploy step, before notify steps"

requirements-completed:
  - "deploy-server.yml DB-Pfad-Verifikation nach Deployment"

# Metrics
duration: 1min
completed: 2026-04-02
---

# Phase 04 Plan 01: Deploy Server Workflow Documentation Summary

**Post-deploy DB path verification step added to deploy-server.yml using pm2 pid + lsof with .db$ anchor, fails CI if server is not using /home/ubuntu/databases/production.db**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-02T12:47:47Z
- **Completed:** 2026-04-02T12:48:37Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- New `Verify DB path post-deploy` step inserted between the existing deploy SSH step and the "Notify on success" step in deploy-server.yml
- Step SSHes to Oracle Cloud, resolves PM2 PID via `pm2 pid timetracking-server`, then checks `lsof` for the open .db file
- Workflow fails with a clear error message if PM2 process is not running (PID empty or 0) or if the DB path does not match /home/ubuntu/databases/production.db
- All Phase 1 decisions honored: pm2 pid approach, .db$ anchor, PID guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add post-deploy DB path verification step to deploy-server.yml** - `e29f422` (feat)

**Plan metadata:** (created below as docs commit)

## Files Created/Modified
- `.github/workflows/deploy-server.yml` - Added 25-line `Verify DB path post-deploy` SSH step (lines 166–189)

## Decisions Made
- Used a separate `appleboy/ssh-action` step (not appended to deploy script) so the verification step has its own identity in GitHub Actions logs and failure is immediately obvious
- Reused existing SSH secrets — no new GitHub secrets required

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- deploy-server.yml is complete for Phase 04 scope
- Phase 04 Plans 02-03 (deploy-staging.yml, ENV.md, CLAUDE.md) may proceed independently

---
*Phase: 04-deploy-workflow-documentation*
*Completed: 2026-04-02*
