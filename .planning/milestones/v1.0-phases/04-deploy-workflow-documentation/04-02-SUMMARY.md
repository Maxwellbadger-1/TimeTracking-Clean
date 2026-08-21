---
phase: 04-deploy-workflow-documentation
plan: 02
subsystem: infra
tags: [github-actions, pm2, yaml, staging, green-server]

# Dependency graph
requires:
  - phase: 03-local-dev-sync-script
    provides: sync-dev-db.sh confirming 2-Tier workflow is established
provides:
  - deploy-staging.yml with on-demand comment block at top documenting Green Server is not part of standard 2-Tier flow
  - PORT=3001 passed as pm2 shell prefix so Green Server always binds to correct port regardless of .env loading
affects:
  - 04-03-PLAN
  - 04-04-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PM2 env variable pattern: pass PORT as shell prefix, not relying on .env file which PM2 does not load"
    - "On-demand workflow comment block: 12-line header at top of YAML before name: field"

key-files:
  created: []
  modified:
    - .github/workflows/deploy-staging.yml

key-decisions:
  - "PORT=3001 added to pm2 start shell prefix in deploy-staging.yml — PM2 does not load .env, .env creation block preserved as documentation/fallback for manual server starts"
  - "on-demand comment block documents 2-Tier standard flow (npm run sync-dev-db) and that staging branch is not maintained in that flow"

patterns-established:
  - "Pattern: PM2 must receive all runtime env vars as shell prefix, not through .env files"

requirements-completed:
  - "Green Server on-demand"

# Metrics
duration: 1min
completed: 2026-04-02
---

# Phase 4 Plan 02: Deploy Staging PORT Fix and On-Demand Documentation Summary

**PORT=3001 added to pm2 start shell prefix in deploy-staging.yml, fixing Green Server port binding; 12-line on-demand comment block added at file top documenting non-standard 2-Tier status**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-02T15:47:49Z
- **Completed:** 2026-04-02T15:48:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed root cause of Green Server PORT crashes: PORT=3001 now passed as pm2 shell prefix so PM2 gets the variable directly (PM2 does not load .env files)
- Added explanatory comment above pm2 start line referencing ENV.md for full explanation
- Documented Green Server as on-demand only with 12-line comment block at top of file, referencing the 2-Tier standard flow and sync-dev-db.sh
- Preserved existing .env creation block (serves as documentation and fallback for manual server starts outside PM2) and staging branch push trigger

## Task Commits

Each task was committed atomically:

1. **Task 1: Add on-demand comment block and fix PORT in deploy-staging.yml** - `3077117` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `.github/workflows/deploy-staging.yml` - Added 12-line on-demand comment block at top; added PORT=3001 to pm2 start shell prefix with explanatory comment

## Decisions Made
- PORT=3001 added to the existing pm2 shell prefix line alongside TZ, NODE_ENV, SESSION_SECRET, and ALLOWED_ORIGINS — consistent with how all other env vars are passed
- .env creation block (lines 115-122) kept intact: serves as documentation of required env vars and fallback for manual server starts via `node dist/server.js` outside PM2
- staging branch push trigger kept intact: comment block documents it is manually-triggered only, not a required CI step in 2-Tier flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- deploy-staging.yml is corrected and documented; Green Server will bind to port 3001 on next deploy-staging.yml run
- Phase 4 Plans 03 and 04 (ENV.md, WINDOWS_PC_SETUP.md, CLAUDE.md doc updates) can proceed independently

---
*Phase: 04-deploy-workflow-documentation*
*Completed: 2026-04-02*
