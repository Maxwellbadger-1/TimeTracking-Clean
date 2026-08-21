---
phase: 04-deploy-workflow-documentation
plan: 03
subsystem: documentation
tags: [2-tier, db-consolidation, sync-dev-db, production-db, workflow]

# Dependency graph
requires:
  - phase: 01-server-db-consolidation
    provides: /home/ubuntu/databases/production.db as canonical production path
  - phase: 02-symlink-pm2-ecosystem
    provides: Blue Server confirmed running on production.db via symlink
  - phase: 03-local-dev-sync-script
    provides: npm run sync-dev-db script for local DB setup
provides:
  - ENV.md updated with 2-Tier architecture and correct DB paths
  - WINDOWS_PC_SETUP.md updated with sync-dev-db and correct DB paths
  - CLAUDE.md updated with 2-Tier workflow as standard, Green Server as optional
affects: [future development sessions, onboarding, deploy workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2-Tier: local develop on main -> git push -> Blue Server:3000"
    - "Standard local DB setup: npm run sync-dev-db (SCP from production)"
    - "Green Server: on-demand only, not required in standard flow"

key-files:
  created: []
  modified:
    - ENV.md
    - WINDOWS_PC_SETUP.md
    - .claude/CLAUDE.md

key-decisions:
  - "CLAUDE.md Verbote: replaced 'Auf main branch arbeiten' rule with 'Direkt auf Production server arbeiten' — main IS the deploy branch in 2-Tier, old rule was contradictory"
  - "Green Server references preserved in all docs as on-demand/optional — not removed, just de-emphasized"
  - "deploy-staging.yml PORT fix noted in ENV.md Green Server section with UPDATE timestamp"

patterns-established:
  - "Documentation update pattern: replace stale DB paths (database-production.db, database-staging.db) with /home/ubuntu/databases/production.db, note database-shared.db still exists as safety backup"
  - "2-Tier standard flow documented as: npm run sync-dev-db -> develop -> git push main"

requirements-completed:
  - "deploy-server.yml DB-Pfad-Verifikation nach Deployment"
  - "Green Server on-demand"

# Metrics
duration: 15min
completed: 2026-04-02
---

# Phase 4 Plan 03: Documentation Update Summary

**All three developer-facing docs updated to 2-Tier architecture: /home/ubuntu/databases/production.db as canonical path, npm run sync-dev-db as standard local DB setup, git push main as the standard deploy flow**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-02T15:47:00Z
- **Completed:** 2026-04-02T15:53:27Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- ENV.md: 3-Tier diagram replaced with 2-Tier overview; all stale DB paths updated; `npm run sync-dev-db` Local DB Setup section added; Green Server PORT fix update note added
- WINDOWS_PC_SETUP.md: DATABASE_PATH corrected to `./database.db`; PROD_DB_PATH updated to `/home/ubuntu/databases/production.db`; Datenbank Setup section added with `npm run sync-dev-db`
- CLAUDE.md: DB Rules updated with canonical paths; Feature Development and Production Deployment sections replaced with 2-Tier flow; "3-Tier Workflow" heading eliminated; Verbote rule updated to reflect main = deploy branch

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ENV.md and WINDOWS_PC_SETUP.md with 2-Tier architecture** - `1adb100` (docs)
2. **Task 2: Update CLAUDE.md with 2-Tier workflow and correct DB path** - `6d39e1b` (docs)

## Files Created/Modified

- `ENV.md` - 2-Tier overview, correct DB paths throughout, sync-dev-db section, Green Server UPDATE note
- `WINDOWS_PC_SETUP.md` - Fixed DATABASE_PATH, updated PROD_DB_PATH, added Datenbank Setup section
- `.claude/CLAUDE.md` - Updated DB Rules, Feature Development, Production Deployment (3-Tier -> 2-Tier), Verbote

## Decisions Made

- CLAUDE.md Verbote: replaced "Auf main branch arbeiten -> Feature-Branch nutzen" with "Direkt auf Production server arbeiten -> Immer lokal entwickeln und via git push deployen". The old rule contradicted the 2-Tier flow where `main` IS the deploy branch.
- All Green Server, /green, /sync-green, /promote-to-prod, /rollback-prod references preserved as on-demand/emergency tools — not removed per plan constraints.
- database-shared.db retained as-is on server; docs updated to clarify it is no longer the active path.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria met:
- 0 occurrences of `database-production.db` in any of the three files
- `2-Tier` heading in ENV.md and CLAUDE.md
- `/home/ubuntu/databases/production.db` in all three files
- `npm run sync-dev-db` documented in all three files
- CLAUDE.md Code-Flow line: `Local -> main branch -> Blue Server:3000`
- Emergency/optional tool references preserved: `/promote-to-prod`, `/rollback-prod`, `/green`, `/sync-green`

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. All changes are documentation-only.

## Next Phase Readiness

Phase 4 is the final phase. All 3 plans complete (04-01 deploy-server.yml verification, 04-02 deploy-staging.yml PORT fix, 04-03 documentation updates). The 2-Tier architecture is now fully documented and operational:

- Production DB: `/home/ubuntu/databases/production.db` (Blue Server via symlink)
- Standard deploy: `git push origin main` -> GitHub Actions -> PM2 restart
- Standard local setup: `npm run sync-dev-db`
- DB path verified on every deploy via post-deploy step in `deploy-server.yml`

---
*Phase: 04-deploy-workflow-documentation*
*Completed: 2026-04-02*
