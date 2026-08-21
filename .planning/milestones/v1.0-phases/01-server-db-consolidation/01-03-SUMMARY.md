---
phase: 01-server-db-consolidation
plan: 03
subsystem: database
tags: [sqlite, ssh, server, production-db]

# Dependency graph
requires:
  - phase: 01-server-db-consolidation-01
    provides: /home/ubuntu/databases/ directory structure with correct permissions
  - phase: 01-server-db-consolidation-02
    provides: LIVE_DB_PATH confirmed as /home/ubuntu/database-shared.db
provides:
  - /home/ubuntu/databases/production.db — canonical centralized production database copy
  - mode 600, owned ubuntu:ubuntu, 831488 bytes matching source
affects:
  - 01-04 (symlink Blue Server to production.db)
  - 01-05 (PM2 ecosystem file DATABASE_PATH)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy-not-move: Production DB copied via cp, never mv — original always intact"
    - "Strict permissions: production.db mode 600 (not 644) for DB security"

key-files:
  created:
    - /home/ubuntu/databases/production.db (server-side, 831488 bytes)
  modified: []

key-decisions:
  - "Used cp (not mv) to copy /home/ubuntu/database-shared.db — original remains at original location, untouched"
  - "Set permissions to 600 (not 644) — DB file should not be world-readable"
  - "chown ubuntu:ubuntu ensures PM2 process (running as ubuntu) can read/write"

patterns-established:
  - "DB copy operations: always verify SIZE_MATCH after cp before proceeding"
  - "Always verify Blue Server health after any server-side DB operations"

requirements-completed:
  - "Production DB als Master: `/home/ubuntu/databases/production.db` (COPY, nie Move!)"

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 1 Plan 03: Copy Live DB to Centralized Location Summary

**Copied /home/ubuntu/database-shared.db (831488 bytes) to /home/ubuntu/databases/production.db with mode 600, ubuntu:ubuntu ownership — original DB untouched**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-02T12:15:42Z
- **Completed:** 2026-04-02T12:16:30Z
- **Tasks:** 1
- **Files modified:** 0 (server-side file operation only)

## Accomplishments

- `/home/ubuntu/databases/production.db` created as canonical centralized production database
- File permissions set to 600 (owner read/write only)
- Ownership set to ubuntu:ubuntu
- Source DB `/home/ubuntu/database-shared.db` verified untouched at same size (831488 bytes)
- Blue Server health check confirms no disruption (status: ok)

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy live DB to centralized location with safe permissions** - `bfec3d8` (chore)

**Plan metadata:** committed with SUMMARY.md below

## Files Created/Modified

- `/home/ubuntu/databases/production.db` (server-side) — canonical production DB copy, 812K, mode 600, owned ubuntu:ubuntu

## Decisions Made

- Used `cp` (not `mv`) per SAFETY RULE — original DB must remain intact for rollback
- Mode 600 chosen over 644 — DB files should not be world-readable, tighter than minimum required
- Verified size match (831488 bytes source == destination) before declaring success

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 5 acceptance checks passed on first attempt:
- FILE_EXISTS: OK
- PERMS_600: OK
- OWNER: OK
- SIZE_MATCH: OK
- ORIGINAL_INTACT: OK

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/home/ubuntu/databases/production.db` exists with correct permissions
- Ready for Plan 04: Point Blue Server symlink to `/home/ubuntu/databases/production.db`
- Ready for Plan 05: PM2 ecosystem file with explicit DATABASE_PATH
- Original DB at `/home/ubuntu/database-shared.db` still serving live traffic — no changes to server config yet

---
*Phase: 01-server-db-consolidation*
*Completed: 2026-04-02*
