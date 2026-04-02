---
phase: 03-local-dev-sync-script
plan: 02
subsystem: infra
tags: [bash, sqlite, ssh, scp, better-sqlite3, windows, git-bash, deprecation]

# Dependency graph
requires:
  - phase: 03-01
    provides: scripts/sync-dev-db.sh (created in plan 01)
provides:
  - Deprecated scripts/database/sync-prod.sh (points to npm run sync-dev-db)
  - Verified end-to-end sync on Windows Git Bash
  - server/database.db with production data (integrity_check: ok)

affects:
  - Any developer who used the old sync-prod.sh (now redirected)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cygpath -m for Windows Git Bash -> Node.js path conversion (C:/... mixed-mode, no escaping issues)"
    - "npm workspaces hoisting: check both server/node_modules and root node_modules for better-sqlite3"

key-files:
  created:
    - server/database.db (production data, 831488 bytes)
  modified:
    - scripts/database/sync-prod.sh (deprecated)
    - scripts/sync-dev-db.sh (Windows path fix)

key-decisions:
  - "cygpath -m (not -w) for node require() paths: -w produces backslash paths that break JS string escaping"
  - "npm workspaces hoists better-sqlite3 to root node_modules — check both locations in pre-flight"
  - "No timestamped backup on first run (no prior DB) — this is expected, not a failure"

requirements-completed:
  - SYNC-TEST
  - SYNC-DEPRECATE-OLD

# Metrics
duration: 4min
completed: 2026-04-02T13:46:00Z
---

# Phase 03 Plan 02: Run Sync Script + Deprecate Old Summary

**Deprecated sync-prod.sh (old 3-Tier path), ran npm run sync-dev-db end-to-end on Windows Git Bash, fixed two Windows path bugs, verified server/database.db with 16 users and integrity_check: ok.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-02T13:42:28Z
- **Completed:** 2026-04-02T13:46:00Z (partial — checkpoint at Task 3)
- **Tasks:** 2/3 (awaiting human verify at Task 3)
- **Files modified:** 2

## Accomplishments

### Task 1: Deprecate sync-prod.sh + verify better-sqlite3

1. Added DEPRECATED comment block to the top of `scripts/database/sync-prod.sh` (after shebang) pointing to `npm run sync-dev-db`. Original script body untouched.
2. Discovered better-sqlite3 is in root `node_modules` (npm workspaces hoisting, not `server/node_modules`). Fixed pre-flight check in `sync-dev-db.sh` to check both locations.

### Task 2: Run sync script and verify

Running `npm run sync-dev-db` revealed a Windows-specific path bug:

- `BASH_SOURCE[0]` in Git Bash gives `/c/Users/...` (POSIX) paths
- Node.js `require()` on Windows needs `C:/...` (drive-letter) paths
- `cygpath -w` gives `C:\...` with backslashes — these break JS string escaping
- `cygpath -m` gives `C:/...` with forward slashes — Node.js accepts these

Fixed all three Node.js path variables: `BSQ3_PATH_NODE`, `LOCAL_DB_NODE`, `TEMP_DB_NODE`.

After fix, full end-to-end run succeeded:
- SSH connectivity: OK
- SCP download: OK
- integrity_check: ok
- Summary: **Users: 16 | Latest time entry: 2026-04-01**
- server/database.db: 831488 bytes
- git status: no untracked .db files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] better-sqlite3 not found at server/node_modules — npm workspaces hoisting**
- **Found during:** Task 1 (pre-flight check)
- **Issue:** Plan assumed `server/node_modules/better-sqlite3` but npm workspaces hoists the module to root `node_modules/`
- **Fix:** Updated pre-flight check to try both `server/node_modules` and `node_modules`; resolved BSQ3_PATH variable used for all require() calls
- **Files modified:** scripts/sync-dev-db.sh
- **Commit:** 47d8657

**2. [Rule 1 - Bug] Node.js require() fails with POSIX paths on Windows Git Bash**
- **Found during:** Task 2 (first script run)
- **Issue:** `cygpath -w` produces backslash paths (`C:\Users\...`) that are treated as escape sequences in JS strings inside `node -e "..."`; `cygpath -m` produces forward-slash paths (`C:/Users/...`) that work correctly
- **Fix:** Changed all cygpath calls from `-w` to `-m` flag; added TEMP_DB path conversion before integrity check node call
- **Files modified:** scripts/sync-dev-db.sh
- **Commit:** 2bdfcac

## Known Stubs

None.

## Verification Results (Task 2 done criteria)

- SC-1: Script exit code 0. Output contained "Users: 16 | Latest time entry: 2026-04-01"
- SC-2: server/database.db exists, 831488 bytes, recent timestamp
- SC-3: No backup created — expected on first run (no prior DB existed)
- SC-4: Script printed "DATABASE_PATH=./database.db" instruction
- SC-5: git status shows no untracked *.db files

Integrity check (Task 2 verify):
`node -e ... integrity_check` returned: **ok**

## Status: Awaiting Checkpoint (Task 3)

Task 3 is a `checkpoint:human-verify` gate. Human sign-off required before plan can be marked complete.

## Self-Check: PASSED

- scripts/database/sync-prod.sh DEPRECATED: FOUND (line 4)
- scripts/sync-dev-db.sh Windows path fix: COMMITTED (2bdfcac)
- server/database.db: EXISTS (831488 bytes)
- integrity_check: ok
- Commits: 47d8657 (Task 1), 2bdfcac (Task 2)
