---
phase: 02-symlink-pm2-ecosystem
plan: all (5 tasks executed as single plan)
subsystem: infrastructure
tags: [pm2, symlink, database, production, ecosystem]

# Dependency graph
requires:
  - phase: 01-server-db-consolidation/01-03
    provides: /home/ubuntu/databases/production.db (mode 600, integrity verified)
  - phase: 01-server-db-consolidation/01-05
    provides: Phase 1 gate cleared
provides:
  - ecosystem.production.config.js in project root (committed)
  - server/database.db symlink -> /home/ubuntu/databases/production.db
  - PM2 timetracking-server running with DATABASE_PATH=/home/ubuntu/databases/production.db
  - PM2 dump saved (survives reboot)
affects:
  - 03-local-dev-sync-script
  - 04-deploy-workflow-documentation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PM2 ecosystem files must use .config.js extension (not .js) for PM2 v6 to treat them as config, not as app scripts"
    - "SESSION_SECRET passed via shell environment + --update-env; not committed to ecosystem file"
    - "DATABASE_PATH env var overrides path resolution in server/src/config/database.ts"

key-files:
  created:
    - ecosystem.production.config.js (project root)
    - .planning/phases/02-symlink-pm2-ecosystem/02-SUMMARY.md
  modified:
    - server/database.db (symlink target updated on server)

key-decisions:
  - "PM2 v6 treats plain .js files as app scripts — ecosystem file must use .config.js extension"
  - "SESSION_SECRET not embedded in ecosystem file — loaded from server/.env via shell env + --update-env at restart"
  - "Symlink backup created as server/database.db.backup.20260402_125311 before updating"
  - "Old symlink pointed to /home/ubuntu/database-shared.db; new symlink points to /home/ubuntu/databases/production.db"

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 2: Symlink + PM2 Ecosystem Summary

**Blue Server now uses `/home/ubuntu/databases/production.db` via explicit `DATABASE_PATH` in PM2 ecosystem config, with symlink `server/database.db -> /home/ubuntu/databases/production.db` confirming 2-Tier DB architecture**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T12:51:39Z
- **Completed:** 2026-04-02T12:56:30Z
- **Tasks:** 5 (create ecosystem file, update symlink, pre-restart validation, deploy + restart, post-restart health check)
- **Files created:** 1 (ecosystem.production.config.js)
- **Server downtime:** ~30 seconds (PM2 stop → start)

## Accomplishments

- Created `ecosystem.production.config.js` with `DATABASE_PATH=/home/ubuntu/databases/production.db`, `TZ=Europe/Berlin`, `PORT=3000`, `NODE_ENV=production`
- Backed up existing symlink as `server/database.db.backup.20260402_125311`
- Updated `server/database.db` symlink: `/home/ubuntu/database-shared.db` → `/home/ubuntu/databases/production.db`
- Pre-restart validation: better-sqlite3 opened `database.db` via new symlink, integrity_check=ok, 19 tables, Blue Server still healthy
- Deployed `ecosystem.production.config.js` to server via SCP
- Restarted Blue Server: `pm2 stop` + `pm2 delete` + `pm2 start ecosystem.production.config.js --update-env`
- PM2 dump saved (`pm2 save`) — configuration survives reboot

## Phase 2 Success Criteria — Verification Evidence

### SC-1: Symlink points to production.db

```
ls -la /home/ubuntu/TimeTracking-Clean/server/database.db
lrwxrwxrwx 1 ubuntu ubuntu 36 Apr  2 12:53 database.db -> /home/ubuntu/databases/production.db
```

**RESULT: PASS**

### SC-2: lsof shows /home/ubuntu/databases/production.db

```
lsof -p 2454066 | grep .db
node/ 2454066 ubuntu  19ur  REG  /home/ubuntu/databases/production.db
node/ 2454066 ubuntu  19ur  REG  /home/ubuntu/databases/production.db-wal
node/ 2454066 ubuntu  19ur  REG  /home/ubuntu/databases/production.db-shm
```

**RESULT: PASS — no references to /home/ubuntu/*.db**

### SC-3: Health check returns ok

```
curl -s http://129.159.8.19:3000/api/health
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"2026-04-02T12:56:24.854Z"}
```

**RESULT: PASS**

### SC-4: PM2 env shows DATABASE_PATH and TZ

```
pm2 env timetracking-server (id: 30)
DATABASE_PATH: /home/ubuntu/databases/production.db
TZ: Europe/Berlin
PORT: 3000
NODE_ENV: production
```

**RESULT: PASS**

### SC-5 (Desktop App): Not verified in this automated phase (requires Desktop App login)

Desktop App verification is deferred to the human sign-off checkpoint. All server-side criteria pass.

---

## Summary Table

| Criterion | Check | Result |
|-----------|-------|--------|
| SC-1: symlink target | `-> /home/ubuntu/databases/production.db` | PASS |
| SC-2: lsof DB path | `/home/ubuntu/databases/production.db` | PASS |
| SC-3: health check | HTTP 200, `{"status":"ok"}` | PASS |
| SC-4: PM2 env | DATABASE_PATH + TZ confirmed | PASS |
| SC-5: Desktop App | Not verified (needs manual test) | DEFERRED |

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create ecosystem.production.js | dd236e0 |
| 1-fix | Rename to .config.js (PM2 bug fix) | abe38d9 |
| 2-4 | Update symlink, pre-validation, restart | Server-side only |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PM2 v6 treats .js files as app scripts, not ecosystem configs**
- **Found during:** Task 4 (deploy + restart)
- **Issue:** `pm2 start ecosystem.production.js` ran the file as a Node.js app (it exports an object but does nothing when executed), creating a process named `ecosystem.production` instead of `timetracking-server`. No port was bound.
- **Fix:** Renamed file to `ecosystem.production.config.js` — PM2 v6 recognizes `.config.js` files as ecosystem configurations with the `apps[]` array. Previous wrongly-started `ecosystem.production` processes deleted before retry.
- **Files modified:** `ecosystem.production.js` → `ecosystem.production.config.js` (git rename)
- **Commit:** abe38d9

**Total deviations:** 1 auto-fixed (PM2 config file naming convention)
**Impact on plan:** No scope change. Ecosystem file works correctly with `.config.js` extension.

## Decisions Made

- PM2 ecosystem files must use `.config.js` extension on PM2 v6 (not plain `.js`)
- SESSION_SECRET not embedded in ecosystem file — it is loaded from `server/.env` via shell environment + `--update-env` when starting PM2
- Symlink backup preserved as `database.db.backup.20260402_125311`

## Next Phase Readiness

Phase 3 (Local Dev Sync Script) is now unblocked:
- Production DB is stable at `/home/ubuntu/databases/production.db`
- Blue Server confirmed using that path via lsof + PM2 env
- `npm run sync-dev-db` script can now SCP from `/home/ubuntu/databases/production.db`

---
*Phase: 02-symlink-pm2-ecosystem*
*Completed: 2026-04-02*

## Self-Check: PASSED

- ecosystem.production.config.js: FOUND at project root (committed dd236e0, abe38d9)
- 02-SUMMARY.md: FOUND at .planning/phases/02-symlink-pm2-ecosystem/02-SUMMARY.md
- server/database.db symlink: points to /home/ubuntu/databases/production.db (verified)
- PM2 process timetracking-server: running (id 30, pid 2454066)
- Health check: HTTP 200 {"status":"ok"}
- lsof: /home/ubuntu/databases/production.db confirmed
- pm2 save: saved
