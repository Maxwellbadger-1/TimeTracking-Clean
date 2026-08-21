---
phase: 03-local-dev-sync-script
plan: 01
subsystem: infra
tags: [bash, sqlite, ssh, scp, better-sqlite3, windows, gitignore]

# Dependency graph
requires:
  - phase: 02-symlink-pm2-ecosystem
    provides: Production DB at /home/ubuntu/databases/production.db (Phase 2 canonical path)
provides:
  - scripts/sync-dev-db.sh — Windows/Git Bash compatible script to pull production DB locally
  - npm run sync-dev-db — developer-facing command
  - .gitignore coverage for server/*.db.backup.* timestamped backup files

affects:
  - 03-02 (remaining plans in phase 3)
  - Any developer workflow that involves local DB setup

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BASH_SOURCE[0] for portable script path resolution (works from any cwd)"
    - "node -e + better-sqlite3 for SQLite integrity checks (replaces sqlite3 CLI which is absent on Windows)"
    - "Atomic DB write: SCP to /tmp, verify integrity, then mv to final location"
    - "trap EXIT for temp file cleanup"

key-files:
  created:
    - scripts/sync-dev-db.sh
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "Use node -e + better-sqlite3 require path for integrity check — sqlite3 CLI absent in Git Bash on Windows"
  - "Target path is server/database.db (not server/database/development.db) matching the one-DB convention"
  - "PROD_DB_PATH uses Phase 2 canonical /home/ubuntu/databases/production.db"
  - "SSH_KEY resolves from $PROJECT_ROOT/.ssh/oracle_server.key via BASH_SOURCE[0]"
  - "Backup naming: server/database.db.backup.YYYYMMDD_HHMMSS — covered by new .gitignore pattern"

patterns-established:
  - "All new scripts in scripts/ use BASH_SOURCE[0] for project root resolution"
  - "SQLite operations in bash scripts use node -e with explicit require path to server/node_modules/better-sqlite3"

requirements-completed:
  - SYNC-SCRIPT
  - SYNC-GITIGNORE
  - SYNC-NPM

# Metrics
duration: 15min
completed: 2026-04-02
---

# Phase 03 Plan 01: Local Dev Sync Script Summary

**Windows-compatible bash script that pulls the production SQLite DB from Oracle Cloud to server/database.db using SCP + better-sqlite3 integrity check, wired as `npm run sync-dev-db`.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-02T15:40:00Z
- **Completed:** 2026-04-02T15:55:00Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

### Task 1: Create scripts/sync-dev-db.sh

Created a Windows/Git Bash compatible script that:

1. Resolves project root via `BASH_SOURCE[0]` (works regardless of cwd when called via `npm run`)
2. Pre-flight checks: SSH key exists, `chmod 600` it, `better-sqlite3` installed, SSH connectivity test
3. Backs up existing `server/database.db` to `server/database.db.backup.YYYYMMDD_HHMMSS` if present
4. SCPs production DB from `ubuntu@129.159.8.19:/home/ubuntu/databases/production.db` to `/tmp` (atomic)
5. Runs `PRAGMA integrity_check` via `node -e + better-sqlite3` — aborts if result is not `ok`
6. Moves temp file to `server/database.db`
7. Prints summary (user count, latest time entry date) via `better-sqlite3`
8. Cleanup of temp file via `trap EXIT`

Key design decision: `sqlite3` CLI is absent in Git Bash on Windows. All SQLite operations use `node -e "require('$PROJECT_ROOT/server/node_modules/better-sqlite3')"` with an explicit require path.

### Task 2: Wire npm script and update .gitignore

- **package.json:** Added `"sync-dev-db": "bash ./scripts/sync-dev-db.sh"` after `test:coverage`
- **.gitignore:** Added `server/*.db.backup.*` pattern to cover timestamped backup files created by the sync script (format: `server/database.db.backup.20260402_143000`)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the script is fully functional. It does not hardcode empty values or contain placeholders.

## Verification Results

All 4 plan verification checks passed:
1. `bash -n scripts/sync-dev-db.sh` → exits 0 (valid syntax)
2. `node -e "require('./package.json').scripts['sync-dev-db']"` → returns `bash ./scripts/sync-dev-db.sh`
3. `grep 'server/*.db.backup.*' .gitignore` → pattern found
4. No `sqlite3` CLI invocations in script (the 5 grep hits are all comments referencing the module name `better-sqlite3`)

## Self-Check: PASSED

- scripts/sync-dev-db.sh: EXISTS
- package.json sync-dev-db entry: EXISTS
- .gitignore server/*.db.backup.* pattern: EXISTS
- Commits: a63436b (Task 1), f322545 (Task 2)
