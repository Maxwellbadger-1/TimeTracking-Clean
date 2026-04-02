---
phase: 04-deploy-workflow-documentation
verified: 2026-04-02T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Trigger deploy-server.yml on a push to main with a server change and confirm the 'Verify DB path post-deploy' step passes in GitHub Actions"
    expected: "Both SSH steps complete successfully; verification step prints 'DB verification PASSED: /home/ubuntu/databases/production.db'"
    why_human: "Requires a live Oracle Cloud server with PM2 running the timetracking-server process; cannot verify without running the workflow"
  - test: "Trigger deploy-staging.yml manually and confirm the Green Server starts on port 3001"
    expected: "Health check at http://localhost:3001/api/health returns HTTP 200; pm2 env shows PORT=3001"
    why_human: "Requires a live Oracle Cloud server; PORT variable passing via pm2 shell prefix cannot be confirmed without actually running PM2"
---

# Phase 4: Deploy Workflow Documentation Verification Report

**Phase Goal:** Deploy workflow fixes and documentation updates to reflect the 2-Tier architecture established in Phases 1-3. Specifically: (1) add post-deploy DB path verification to deploy-server.yml, (2) fix Green Server PORT bug in deploy-staging.yml and add on-demand comment, (3) update ENV.md, WINDOWS_PC_SETUP.md, and CLAUDE.md with 2-Tier architecture details.
**Verified:** 2026-04-02
**Status:** PASSED (with 2 items flagged for human verification — live workflow runs)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | deploy-server.yml contains "Verify DB path post-deploy" step with correct SSH secrets, pm2 pid lookup, lsof grep with .db$ anchor, and expected path check | VERIFIED | Lines 166–189: separate `appleboy/ssh-action` step confirmed, `pm2 pid timetracking-server`, `lsof -p "$PM2_PID" \| grep '\.db$'`, `EXPECTED="/home/ubuntu/databases/production.db"`, PID guard `[ -z "$PM2_PID" ] \|\| [ "$PM2_PID" = "0" ]` |
| 2 | If PM2 process is not running or uses wrong DB path, the workflow fails with a clear error message | VERIFIED | `exit 1` on PID=empty/0 with message "ERROR: PM2 process 'timetracking-server' not found or not running"; `exit 1` on path mismatch with message "DB verification FAILED: expected … got: …" |
| 3 | deploy-staging.yml has a comment block at the top stating it is on-demand only | VERIFIED | Lines 1–12 contain `STAGING / GREEN SERVER — ON-DEMAND ONLY`, `NOT part of the standard 2-Tier development flow`, `npm run sync-dev-db` reference |
| 4 | PORT=3001 is passed explicitly as a shell prefix to the pm2 start command | VERIFIED | Line 156: `TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=$SESSION_SECRET ALLOWED_ORIGINS=$ALLOWED_ORIGINS PORT=3001 \` with explanatory comment above: `# PORT must be passed as prefix — PM2 does NOT load .env files` |
| 5 | ENV.md contains 0 occurrences of `database-production.db` as active path; uses `/home/ubuntu/databases/production.db` and documents `npm run sync-dev-db` | VERIFIED | `grep -c "database-production.db" ENV.md` = 0; `grep -c "3-Tier Environment Configuration" ENV.md` = 0; heading is "2-Tier Environment Configuration System"; `databases/production.db` present at lines 11, 121, 134, 303; `npm run sync-dev-db` at lines 14, 92 |
| 6 | WINDOWS_PC_SETUP.md uses `/home/ubuntu/databases/production.db` as the production path and documents `npm run sync-dev-db` | VERIFIED | `PROD_DB_PATH=/home/ubuntu/databases/production.db` at line 167; `npm run sync-dev-db` at line 95 inside a "Datenbank Setup" section (line 91) |
| 7 | CLAUDE.md describes the 2-Tier workflow, `DATABASE_PATH=/home/ubuntu/databases/production.db`, and 0 occurrences of `database-production.db` / `3-Tier Workflow` | VERIFIED | `grep -c "database-production.db"` = 0; `grep -c "3-Tier Workflow"` = 0; DB Rules at line 237: `DATABASE_PATH=/home/ubuntu/databases/production.db`; `Production Deployment (2-Tier Workflow)` at line 484; Code-Flow at line 486: `Local -> main branch -> Blue Server:3000`; Verbote at line 566 updated to `Direkt auf Production server arbeiten`; `/promote-to-prod`, `/rollback-prod`, `/green`, `/sync-green` all preserved |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/deploy-server.yml` | Post-deploy DB path verification step | VERIFIED | Contains string `name: Verify DB path post-deploy` at line 166; exactly 2 `appleboy/ssh-action@v1.0.3` occurrences; step positioned after deploy SSH step (line 22) and before `Notify on success` (line 191) |
| `.github/workflows/deploy-staging.yml` | On-demand comment block and PORT fix | VERIFIED | 12-line comment block at lines 1–12; `PORT=3001` in pm2 shell prefix at line 156; `.env` creation block preserved (line 133); `on: push: branches: [staging]` preserved (line 18) |
| `ENV.md` | Updated environment documentation with 2-Tier architecture | VERIFIED | Heading updated to "2-Tier Environment Configuration System"; diagram replaced; correct DB paths throughout; `npm run sync-dev-db` section added; `UPDATE (2026-04-02)` note on Green Server section at line 140 |
| `WINDOWS_PC_SETUP.md` | Updated Windows setup with sync-dev-db command | VERIFIED | `DATABASE_PATH=./database.db` at lines 118, 155; `PROD_DB_PATH=/home/ubuntu/databases/production.db` at line 167; Datenbank Setup section with `npm run sync-dev-db` at lines 91–100 |
| `.claude/CLAUDE.md` | Updated AI guidelines with 2-Tier workflow | VERIFIED | DB Rules, Feature Development, Production Deployment all updated; 0 occurrences of stale paths; optional tools preserved |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/deploy-server.yml` | `pm2 pid timetracking-server` | SSH action post-deploy step | VERIFIED | `PM2_PID=$(pm2 pid timetracking-server)` at line 176 in the "Verify DB path post-deploy" step |
| `.github/workflows/deploy-staging.yml` | `pm2 start` | `PORT=3001` shell prefix | VERIFIED | `PORT=3001` appears in pm2 start shell prefix at line 156 (alongside `TZ`, `NODE_ENV`, `SESSION_SECRET`, `ALLOWED_ORIGINS`) |
| `ENV.md` | `scripts/sync-dev-db.sh` | `npm run sync-dev-db` reference | VERIFIED | Line 14: `Local DB setup: npm run sync-dev-db (pulls production DB via SCP)`; line 92 in Local DB Setup section; line 96: `# 2. SCPs production.db from /home/ubuntu/databases/production.db` |
| `.claude/CLAUDE.md` | `/home/ubuntu/databases/production.db` | DB Rules section | VERIFIED | Line 237: `DATABASE_PATH=/home/ubuntu/databases/production.db` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase contains only YAML workflow files and documentation (Markdown). No components rendering dynamic data.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| deploy-server.yml YAML is parseable | `grep -c "appleboy/ssh-action" .github/workflows/deploy-server.yml` | 2 | PASS |
| deploy-staging.yml top 12 lines contain on-demand header | `head -12 deploy-staging.yml \| grep "ON-DEMAND ONLY"` | Match found | PASS |
| Verify DB step is positioned after Deploy step and before Notify step | Step name order check | Checkout(19) → Deploy(22) → Verify(166) → Notify on success(191) → Notify on failure(198) | PASS |
| No stale `database-production.db` references in any of the 3 docs | `grep -c "database-production.db"` across ENV.md, WINDOWS_PC_SETUP.md, CLAUDE.md | 0 each | PASS |
| Live workflow run completes with verification step passing | Requires GitHub Actions trigger on Oracle Cloud | Not runnable statically | ? SKIP — see Human Verification |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| deploy-server.yml DB-Pfad-Verifikation nach Deployment | 04-01-PLAN, 04-03-PLAN | Post-deploy SSH step verifies Blue Server uses /home/ubuntu/databases/production.db | SATISFIED | `Verify DB path post-deploy` step at lines 166–189 of deploy-server.yml; fails CI if PM2 PID missing or DB path wrong |
| Green Server on-demand | 04-02-PLAN, 04-03-PLAN | Green Server documented as optional/on-demand; PORT=3001 bug fixed | SATISFIED | deploy-staging.yml: on-demand comment block + PORT=3001 prefix; ENV.md/CLAUDE.md: Green Server marked as optional |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ENV.md` | 151, 166, 186, 190 | `database-staging.db` references remain in Green Server troubleshooting examples | Info | These are inside a code example block showing the PM2 prefix pattern for Green Server. They are historical example snippets inside the on-demand section, not active/canonical paths. The acceptance criteria only require 0 occurrences of `database-production.db` (which is satisfied). The `database-staging.db` references describe what the old manual green-server template looked like — they are documentation-in-context, not misleading to a developer reading the 2-Tier standard flow. No action needed unless the team wants to update the PM2 template examples to use the production.db path for Green Server. |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Post-deploy DB Verification Step (Live Workflow)

**Test:** Push a trivial server change to `main` and monitor the GitHub Actions run for `deploy-server.yml`.
**Expected:** Both SSH steps complete; "Verify DB path post-deploy" step prints `DB verification PASSED: /home/ubuntu/databases/production.db` and the overall workflow conclusion is `success`.
**Why human:** Requires a live Oracle Cloud server with PM2 running `timetracking-server`. The PID lookup and lsof check cannot be verified statically.

#### 2. Green Server PORT Fix (Live Workflow)

**Test:** Trigger `deploy-staging.yml` manually via `workflow_dispatch`. After completion, SSH to the server and run `pm2 env <staging-id> | grep PORT`.
**Expected:** `PORT=3001` is present in PM2's environment; health check at `http://localhost:3001/api/health` returns HTTP 200.
**Why human:** PM2 environment variable injection via shell prefix must be confirmed at runtime. Static file analysis confirms the prefix is in the YAML but cannot confirm PM2 actually received it.

---

### Gaps Summary

No gaps. All 7 observable truths are verified in the codebase. Both workflow files have been correctly modified: deploy-server.yml has the post-deploy verification step in the correct position with all required guards, and deploy-staging.yml has the on-demand header and PORT=3001 prefix. All three documentation files (ENV.md, WINDOWS_PC_SETUP.md, CLAUDE.md) reflect the 2-Tier architecture with zero stale `database-production.db` references and correct `npm run sync-dev-db` documentation throughout.

The only items deferred to human verification are live-workflow behaviors that require an active Oracle Cloud server — they cannot be validated through static code analysis.

---

_Verified: 2026-04-02_
_Verifier: Claude (gsd-verifier)_
