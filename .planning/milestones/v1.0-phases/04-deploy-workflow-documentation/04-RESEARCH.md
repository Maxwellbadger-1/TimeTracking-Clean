# Phase 4: Deploy Workflow + Documentation — Research

**Researched:** 2026-04-02
**Domain:** GitHub Actions CI/CD, PM2 env handling, documentation updates
**Confidence:** HIGH

---

## Summary

Phase 4 is predominantly a **file-editing phase**: four clearly scoped tasks across two workflow YAML files and two documentation files. The technical groundwork (production DB at `/home/ubuntu/databases/production.db`, ecosystem file with explicit `DATABASE_PATH`, sync script) is complete from Phases 1–3. This phase locks in those results so they cannot silently regress.

The two highest-risk areas are: (1) the `deploy-server.yml` DB-path verification step — it must resolve the PM2 PID reliably before calling `lsof`, using the `pm2 pid` approach confirmed in Phase 1 decisions; (2) the `deploy-staging.yml` PORT fix — the current file passes `PORT=3001` correctly as a shell prefix, but the `.env` fallback path is still present and could silently activate if the prefix block is changed. Both issues have known, tested solutions from prior phases.

Documentation work is mechanical: find and replace old paths (`database-shared.db`, `database-production.db`, `database-staging.db`, old 3-Tier workflow references) with the 2-Tier equivalents, and document `npm run sync-dev-db` as the standard local DB setup command.

**Primary recommendation:** Follow the four plans in the ROADMAP verbatim. Plans 3 and 4 (doc updates) are safe to run in parallel.

---

## Project Constraints (from CLAUDE.md)

The following directives from `.claude/CLAUDE.md` apply to this phase:

- **ZERO HALLUCINATION:** Every file path, command, and variable value written into plans MUST be verified against source files — no interpolation.
- **PLAN-FIRST:** Each plan must be reviewed before execution.
- **Deployment Verification Rule:** After any change to `deploy-server.yml`, verify the GitHub Actions run completed (`gh run list --workflow="deploy-server.yml" --limit 1`) and the health check passes (`curl -s http://129.159.8.19:3000/api/health`).
- **NEVER** modify, move, or delete `/home/ubuntu/database-shared.db`.
- **DB Rules (from CLAUDE.md current state):** CLAUDE.md currently says `DATABASE_PATH=/home/ubuntu/database-production.db` — this is the stale 3-Tier path that Phase 4 Plan 4 must replace with `/home/ubuntu/databases/production.db`.
- **3-Tier Workflow in CLAUDE.md:** The "Production Deployment (3-Tier Workflow)" section (staging branch → Green Server → promote-to-prod) reflects the old flow. Phase 4 Plan 4 replaces this with the 2-Tier flow (`npm run sync-dev-db` → develop → `git push main`).

---

## Standard Stack

### What is already in place (no new installs needed)

| Component | Version/Path | Relevance |
|-----------|-------------|-----------|
| `appleboy/ssh-action` | v1.0.3 (in both workflows) | Used for SSH steps in GitHub Actions |
| `actions/checkout` | v4 (in both workflows) | Used for code checkout |
| PM2 | live on server | Process manager; `pm2 pid <name>` resolves PID |
| `lsof` | standard Linux utility | Verifies open file handles on server |
| `better-sqlite3` | in node_modules (server + root hoisted) | Used in sync script, NOT needed for workflow DB check |

**No new packages required for this phase.**

---

## Architecture Patterns

### Pattern 1: GitHub Actions post-deploy SSH verification step

The existing `deploy-server.yml` already uses `appleboy/ssh-action@v1.0.3` for its main deploy script. The DB verification step should be added as a **second `uses: appleboy/ssh-action` step** in the same job, named distinctly, running after the existing deploy step.

**Why a separate step (not appended to existing script):**
- Keeps the deploy script focused on deployment
- The verification step can be identified separately in GitHub Actions logs
- If verification fails, the step name makes the failure immediately obvious

**Pattern:**
```yaml
- name: Verify DB path post-deploy
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.ORACLE_HOST }}
    username: ${{ secrets.ORACLE_USER }}
    key: ${{ secrets.ORACLE_SSH_KEY }}
    port: 22
    script: |
      set -e
      PM2_PID=$(pm2 pid timetracking-server)
      if [ -z "$PM2_PID" ] || [ "$PM2_PID" = "0" ]; then
        echo "ERROR: PM2 process not found"
        exit 1
      fi
      DB_PATH=$(lsof -p "$PM2_PID" | grep '\.db' | awk '{print $NF}' | head -1)
      EXPECTED="/home/ubuntu/databases/production.db"
      if [ "$DB_PATH" = "$EXPECTED" ]; then
        echo "DB verification PASSED: $DB_PATH"
      else
        echo "DB verification FAILED: expected $EXPECTED, got: $DB_PATH"
        exit 1
      fi
```

**Key decisions from Phase 1 already locked:**
- Use `pm2 pid <name>` (not `pgrep -f`) — confirmed reliable in Phase 1
- Expected path: `/home/ubuntu/databases/production.db` — confirmed canonical in Phase 2

### Pattern 2: PM2 env variable passing (the PORT issue)

**Root cause (confirmed in ROADMAP and ENV.md):** PM2 does NOT auto-load `.env` files. Variables must be passed as shell prefixes or in the ecosystem file's `env` block.

The current `deploy-staging.yml` already does this correctly at line 142–147 (passes `TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=...` as prefix). However, `PORT=3001` is NOT in that prefix — it relies on the `.env` file created at line 115–122 of the deploy script.

**The actual bug path in staging:**
1. `.env` is created with `PORT=3001`
2. PM2 starts with the shell prefix (no `PORT=`)
3. PM2 does NOT load `.env` — so `PORT` is not set in the PM2 process env
4. Server defaults to `PORT=3000` or crashes with EADDRINUSE

**Fix:** Add `PORT=3001` to the pm2 start prefix in `deploy-staging.yml`, matching the pattern from the ecosystem file and ENV.md troubleshooting section.

**Corrected PM2 start for staging:**
```bash
TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=$SESSION_SECRET \
  ALLOWED_ORIGINS=$ALLOWED_ORIGINS PORT=3001 \
  pm2 start dist/server.js \
  --name timetracking-staging \
  --cwd /home/ubuntu/TimeTracking-Green/server \
  --time \
  --update-env
```

### Pattern 3: On-demand comment block at top of workflow file

The ROADMAP specifies: "mark Green as on-demand with a comment block at the top of the file."

Standard pattern for YAML workflow on-demand markers:
```yaml
# ============================================================
# STAGING / GREEN SERVER — ON-DEMAND ONLY
# ============================================================
# This workflow deploys to the Green Server (port 3001).
# It is NOT part of the standard 2-Tier development flow.
#
# Trigger: Manual only (workflow_dispatch) or staging branch push.
# The staging branch is not maintained in the 2-Tier workflow.
#
# Standard local DB setup: npm run sync-dev-db (see scripts/sync-dev-db.sh)
# ============================================================
```

### Recommended File Edit Order

1. `deploy-server.yml` — add post-deploy verification step (highest value, confirms DB path every push)
2. `deploy-staging.yml` — add on-demand comment block + fix PORT in pm2 start prefix
3. `ENV.md` — replace 3-Tier references, add sync-dev-db documentation
4. `WINDOWS_PC_SETUP.md` — replace old DB paths, add sync-dev-db step
5. `.claude/CLAUDE.md` — replace 3-Tier workflow section, update DB Rules

Plans 3+4 (ENV.md and WINDOWS_PC_SETUP.md) and Plan 4 (CLAUDE.md) can be parallelized as noted in the ROADMAP.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| DB path verification | Custom node script over SSH | `lsof -p $(pm2 pid ...) \| grep .db` — already proven in Phase 1 |
| PM2 process lookup | `pgrep -f` pattern matching | `pm2 pid <name>` — locked decision from Phase 1 |
| Port env passing | Create .env file during deploy | Pass `PORT=3001` as shell prefix to `pm2 start` |

---

## Common Pitfalls

### Pitfall 1: lsof returns multiple .db paths

**What goes wrong:** `lsof -p <pid> | grep .db` can return multiple lines (WAL shm/wal files, temp files). Taking `$NF` of the first `.db` line may grab `production.db-wal` instead of `production.db`.

**How to avoid:** Use `grep -v '\-wal\|-shm'` to filter out WAL ancillary files, or filter for the exact filename:
```bash
lsof -p "$PM2_PID" | grep '\.db$' | awk '{print $NF}' | head -1
```
The `$` anchors the grep to lines ending in `.db` exactly.

### Pitfall 2: pm2 pid returns empty or "0" if process is stopped

**What goes wrong:** If PM2 restarted the server but it's in an errored state, `pm2 pid timetracking-server` returns `0` or empty. `lsof -p 0` returns all processes on some systems.

**How to avoid:** Add an explicit check:
```bash
if [ -z "$PM2_PID" ] || [ "$PM2_PID" = "0" ]; then
  echo "ERROR: PM2 process not running"; exit 1
fi
```

### Pitfall 3: deploy-staging.yml PORT fix breaks existing .env creation

**What goes wrong:** The current staging script creates a `.env` with `PORT=3001`. If we add `PORT=3001` to the pm2 prefix but also leave the `.env` creation in place, the behavior is correct but confusing — future editors might remove the prefix `PORT` thinking the `.env` handles it.

**How to avoid:** Add a comment next to the pm2 start prefix explaining why `PORT` is explicitly set:
```bash
# PORT must be passed as prefix — PM2 does NOT load .env files
# (see ENV.md Green Server Critical Notes for full explanation)
TZ=Europe/Berlin NODE_ENV=staging ... PORT=3001 pm2 start ...
```

### Pitfall 4: Documentation contains old paths that are still valid filenames

**What goes wrong:** `database-shared.db` still exists on the server (it must not be deleted per constraints). Search-and-replace in docs must distinguish between "this path is now wrong/stale" vs. "this path still exists but is no longer the canonical one."

**How to avoid:** When updating ENV.md and CLAUDE.md, replace path references with explanatory text like: "Production DB is now at `/home/ubuntu/databases/production.db` (the original `/home/ubuntu/database-shared.db` is retained as a safety backup but is no longer the active DB)."

### Pitfall 5: CLAUDE.md 3-Tier workflow section references staging branch commands

**What goes wrong:** The current CLAUDE.md "Production Deployment (3-Tier Workflow)" section includes `/promote-to-prod`, `/sync-green`, and `git push origin staging`. If these commands are removed entirely, a developer who follows the old workflow will be confused.

**How to avoid:** Replace the 3-Tier section with the 2-Tier workflow, but add a brief note that Green Server and staging branch still exist as on-demand tools, not as a required deployment step. Don't delete the references to `/green` and `/sync-green` commands — they're still valid tools.

---

## Exact Current State of Files to Edit

This section documents what currently needs to change in each file, verified by reading the source files.

### `deploy-server.yml` (line 178 = end of file)

**Missing:** Post-deploy DB verification step. The existing file ends after "Notify on failure". Insert a new step between the existing SSH deploy step and the notify steps, or append after all steps (both work; after deploy + before notify is cleaner).

**Current PM2 start (lines 142–148):** Uses inline shell prefix without ecosystem file. The verification step must work against this — `pm2 pid timetracking-server` will return the correct PID.

### `deploy-staging.yml` (lines 142–148)

**Bug confirmed:** PM2 start at line 142 does NOT include `PORT=3001` in the prefix. The `.env` file (created at line 120) has `PORT=3001` but PM2 does not load it. This is the documented root cause of the Green Server PORT crashes.

**Fix:** Add `PORT=3001` to the prefix at line 142.

**On-demand comment:** Add comment block at top of file (before line 1 `name:`).

### `ENV.md`

**Stale content confirmed:**
- Line 9: "3-Tier Environment Overview" diagram
- Line 105: `DATABASE_PATH=/home/ubuntu/database-production.db` (old path)
- Line 118: `DATABASE_PATH=/home/ubuntu/database-staging.db` (old path, still valid for Green Server but should clarify this is the staging path, not the canonical production path)
- Line 285: `PROD_DB_PATH=/home/ubuntu/TimeTracking-Clean/server/database.db` (old pre-symlink path)
- Missing: `npm run sync-dev-db` documentation

**Keep intact:** Green Server PORT troubleshooting section (lines 123–181) — this documents the known issue and fix; it should be updated to say the fix is now applied in `deploy-staging.yml`.

### `WINDOWS_PC_SETUP.md`

**Stale content confirmed:**
- Line 105: `DATABASE_PATH=./database/development.db` (minor: path differs from actual server config which uses `./database.db`)
- Line 154: `PROD_DB_PATH=/home/ubuntu/TimeTracking-Clean/server/database.db` (old path, should be `/home/ubuntu/databases/production.db`)
- Missing: `npm run sync-dev-db` as standard local DB setup step (currently only shows manual dev server start)

### `.claude/CLAUDE.md`

**Stale content confirmed:**
- Line 106 (DB Rules): `DATABASE_PATH=/home/ubuntu/database-production.db` — stale path
- Line 208 (Feature Development workflow): References "Push zu staging branch → Auto-Deploy Green Server" as a required step
- Lines 228–254 (Production Deployment 3-Tier Workflow section): Entire section describes staging branch → Green → promote-to-prod as the standard flow
- Missing: 2-Tier flow description (`npm run sync-dev-db` → develop on main → `git push main`)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely file-editing (YAML workflows, markdown docs). No external tools, services, or runtimes are installed or invoked during this phase itself. The verification of the DB path check runs in GitHub Actions on the server, using tools (`pm2`, `lsof`) confirmed present since Phase 1.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. This section is skipped.

---

## Open Questions

1. **Should the on-demand comment in `deploy-staging.yml` disable the `on: push: branches: [staging]` trigger?**
   - What we know: The ROADMAP says "mark Green as on-demand" and add a comment block; it does not say to remove the `push` trigger.
   - What's unclear: Whether "on-demand only" means only `workflow_dispatch`, or just that the team should not push to `staging` routinely.
   - Recommendation: Keep the `push` trigger (removing it would be a behavior change beyond what the phase specifies), but add a comment in the `on:` block saying the `staging` branch should only be pushed manually.

2. **Does the `deploy-server.yml` post-deploy verification need its own GitHub secret for SSH?**
   - What we know: The existing deploy step already uses `secrets.ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY` — all are present.
   - Recommendation: Reuse the same secrets. No new secrets needed.

3. **CLAUDE.md: How much of the 3-Tier workflow section to preserve?**
   - What we know: `/promote-to-prod`, `/rollback-prod`, and `/sync-green` commands still exist in `.claude/commands/`. They're valid tools even in 2-Tier.
   - Recommendation: Replace the "Production Deployment (3-Tier Workflow)" heading and description with "Production Deployment (2-Tier Workflow)", keep the emergency rollback block, add a note that `/green` and `/sync-green` exist as optional tools for investigation but are not required in the standard flow.

---

## Sources

### Primary (HIGH confidence)
- `.github/workflows/deploy-server.yml` — full file read, lines 1–178
- `.github/workflows/deploy-staging.yml` — full file read, lines 1–178
- `ENV.md` — full file read, lines 1–631
- `WINDOWS_PC_SETUP.md` — full file read, lines 1–379
- `.claude/CLAUDE.md` — full file loaded via system context
- `ecosystem.production.config.js` — full file read (Phase 2 output)
- `scripts/sync-dev-db.sh` — full file read (Phase 3 output)
- `.planning/STATE.md` — decision log, all prior phase decisions
- `.planning/ROADMAP.md` — Phase 4 plan descriptions and success criteria

### Secondary (MEDIUM confidence)
- PM2 docs pattern: `pm2 pid <name>` reliable PID resolution — confirmed in Phase 1 STATE.md decision log

---

## Metadata

**Confidence breakdown:**
- Current file state (what to change): HIGH — all files read directly
- Workflow patterns (appleboy/ssh-action, lsof, pm2 pid): HIGH — confirmed from existing working code
- PM2 .env loading behavior: HIGH — confirmed from ENV.md troubleshooting + ROADMAP documentation of the bug
- Doc update scope: HIGH — exact stale paths identified per file

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain — GitHub Actions YAML, PM2 behavior, markdown)
