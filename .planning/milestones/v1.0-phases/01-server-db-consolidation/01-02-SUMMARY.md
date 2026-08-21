---
phase: 01-server-db-consolidation
plan: 02
subsystem: database
tags: [sqlite, lsof, pm2, ssh, oracle-cloud]

# Dependency graph
requires: []
provides:
  - "Confirmed LIVE_DB_PATH: /home/ubuntu/database-shared.db"
  - "Written lsof record at .planning/phases/01-server-db-consolidation/lsof-output.txt"
  - "Full inventory of all .db files on server with sizes"
  - "Confirmed symlink: server/database.db -> /home/ubuntu/database-shared.db"
affects:
  - 01-03-PLAN
  - 01-04-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use pm2 pid <name> (not pgrep) to reliably get PM2-managed process PID"

key-files:
  created:
    - .planning/phases/01-server-db-consolidation/lsof-output.txt
  modified: []

key-decisions:
  - "LIVE_DB_PATH confirmed as /home/ubuntu/database-shared.db (812K, most recent writes)"
  - "database.db in server/ is already a symlink pointing to database-shared.db — symlink structure pre-exists"
  - "Used pm2 pid instead of pgrep -f to reliably resolve PM2 process PID"

patterns-established:
  - "pm2 pid <name> is reliable for getting PID; pgrep -f can return wrong PID (e.g. bash subprocess)"

requirements-completed:
  - "Production DB als Master: `/home/ubuntu/databases/production.db` (COPY, nie Move!)"

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 1 Plan 02: Live DB Identification via lsof Summary

**lsof confirmed /home/ubuntu/database-shared.db (812K) as the production DB open by PM2 process 2450340 — symlink server/database.db already points to it**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T12:11:31Z
- **Completed:** 2026-04-02T12:12:30Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Confirmed Blue Server (PM2 `timetracking-server`, PID 2450340) has `/home/ubuntu/database-shared.db` open via lsof
- Discovered that `server/database.db` is already a symlink to `/home/ubuntu/database-shared.db` (created 2026-02-09)
- Full DB file inventory captured: database-shared.db (812K live), database-staging.db (492K), database_OLD_BACKUP_20251109.db (4K), plus 13+ dated backup files
- LIVE_DB_PATH annotated at bottom of output file for Plans 03 and 04 to consume
- Blue Server health check confirmed undisturbed throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Identify live DB path via lsof and save output locally** - `b8be31a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `.planning/phases/01-server-db-consolidation/lsof-output.txt` - lsof output with LIVE_DB_PATH annotation, PM2 PID, full .db file inventory

## Decisions Made

- Used `pm2 pid timetracking-server` instead of `pgrep -f timetracking-server` to get the correct PID. pgrep returned a child bash subprocess PID (not the actual Node.js server), resulting in empty lsof output. `pm2 pid` returns exactly the node process ID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used pm2 pid instead of pgrep for PID resolution**
- **Found during:** Task 1
- **Issue:** Plan specified `pgrep -f 'timetracking-server' | head -1` but pgrep returned a bash subprocess PID, not the Node.js server PID. lsof on that PID returned empty output.
- **Fix:** Switched to `pm2 pid timetracking-server` which correctly returns PID 2450340 (the node process). lsof on this PID immediately shows the open .db files.
- **Files modified:** None (fix was in the SSH command, not in any committed file)
- **Verification:** lsof output shows 4 .db file descriptors including database-shared.db
- **Committed in:** b8be31a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — without it lsof would return empty results and LIVE_DB_PATH could not be determined. No scope creep.

## Issues Encountered

- pgrep -f returned PID of a bash subprocess rather than the Node.js process. First run produced empty lsof output. Resolved by using `pm2 pid <name>` which is the canonical way to get PM2 process PIDs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LIVE_DB_PATH `/home/ubuntu/database-shared.db` is confirmed and recorded in lsof-output.txt
- Plans 03 and 04 can use this path as the copy source
- Notable: symlink already exists (server/database.db -> database-shared.db) — Plans 03/04 should account for this in their approach

---
*Phase: 01-server-db-consolidation*
*Completed: 2026-04-02*
