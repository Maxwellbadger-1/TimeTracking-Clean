# Roadmap: DB Setup Refactoring

**Project:** TimeTracking — DB Setup Refactoring
**Goal:** `git push main` deploys in under 10 minutes without manual intervention
**Granularity:** Standard
**Created:** 2026-04-02

---

## Milestone 1: 2-Tier DB Architecture

Consolidate from chaotic 3-Tier (Dev→Green→Blue) to clean 2-Tier (Dev→Production).
Production DB at `/home/ubuntu/database-shared.db` is live and must never be modified, moved, or deleted.

---

## Phases

- [ ] **Phase 1: Server DB Consolidation** - Create `/home/ubuntu/databases/` and copy production DB there
- [ ] **Phase 2: Symlink + PM2 Ecosystem** - Wire Blue Server to centralized DB via symlink and ecosystem file
- [ ] **Phase 3: Local Dev Sync Script** - Windows-compatible script to pull production DB for local development
- [ ] **Phase 4: Deploy Workflow + Documentation** - Harden CI/CD, fix Green Server PORT issue, update all docs

---

## Phase Details

### Phase 1: Server DB Consolidation

**Goal:** The production DB has a single, documented home at `/home/ubuntu/databases/production.db` with a timestamped backup — and the original DB is untouched.

**Why:** The current state has multiple DB files at `/home/ubuntu/*.db` with no documentation of which one is live. Every deployment is a guessing game. Before wiring up symlinks or scripts, we need to know exactly which DB Blue is using and get a clean copy into a permanent location.

**Depends on:** Nothing — zero changes to the running system in this phase.

**Plans:**
4/5 plans executed
2. **Identify live DB via lsof** — SSH to server, get Blue Server PID, run `lsof -p $PID | grep .db` to confirm the actual path in use (may be `database-shared.db` or `database-production.db`)
3. **Copy (not move) production DB to centralized location** — `cp <live-db> /home/ubuntu/databases/production.db` with `chmod 600`
4. **Create timestamped backup** — `cp <live-db> /home/ubuntu/databases/backups/production.YYYYMMDD_HHMMSS.db`
5. **Verify integrity** — `sqlite3 /home/ubuntu/databases/production.db "PRAGMA integrity_check;"` must return `ok`

Plans 3 and 4 can run in parallel (two independent copies from the same source).

**Success Criteria** (what must be TRUE):
1. `/home/ubuntu/databases/production.db` exists, is readable, and `PRAGMA integrity_check` returns `ok`
2. A timestamped backup exists in `/home/ubuntu/databases/backups/`
3. The original DB (e.g. `/home/ubuntu/database-shared.db`) is still present, byte-for-byte unchanged
4. There is a written record of which DB path Blue Server was actually using (lsof output saved)

**Rollback:** Nothing to roll back — no changes made to the running system. Original DB untouched.

**Plans:** 5 plans

Plans:
- [x] 01-01-PLAN.md — Create /home/ubuntu/databases/ directory structure via SSH
- [x] 01-02-PLAN.md — Identify live DB path via lsof, save to lsof-output.txt
- [x] 01-03-PLAN.md — Copy live DB to /home/ubuntu/databases/production.db (chmod 600)
- [x] 01-04-PLAN.md — Create timestamped backup in /home/ubuntu/databases/backups/
- [ ] 01-05-PLAN.md — PRAGMA integrity_check verification + human sign-off

---

### Phase 2: Symlink + PM2 Ecosystem

**Goal:** Blue Server reliably uses `/home/ubuntu/databases/production.db` — confirmed via lsof after restart — and has an ecosystem file that explicitly sets `DATABASE_PATH` and `TZ=Europe/Berlin`.

**Why:** Without explicit `DATABASE_PATH` in the PM2 ecosystem file, the server falls back to path resolution that has caused confusion. Without `TZ=Europe/Berlin`, overtime calculations drift to UTC. The symlink ensures the repo-relative path `server/database.db` always resolves to the canonical production DB regardless of how the server was started.

**Depends on:** Phase 1 (production DB must exist at `/home/ubuntu/databases/production.db`)

**Plans:**
1. **Create `ecosystem.production.js`** — locally in project root, with `DATABASE_PATH=/home/ubuntu/databases/production.db`, `TZ=Europe/Berlin`, `PORT=3000`, `NODE_ENV=production`
2. **Create symlink on server** — SSH: back up any existing `server/database.db`, then `ln -sf /home/ubuntu/databases/production.db database.db`
3. **Pre-restart validation** — test symlink via `node -e "require('better-sqlite3')('./database.db', {readonly:true})"` before touching PM2
4. **Deploy ecosystem file and restart Blue Server** — `scp ecosystem.production.js` to server, `pm2 stop`, `pm2 start ecosystem.production.js`, `pm2 save` (~30s downtime)
5. **Post-restart health check** — `curl /api/health` returns `{"status":"ok"}`, `lsof` confirms DB path is `/home/ubuntu/databases/production.db`

Plans 1 and 2 can run in parallel (local file creation and SSH symlink work are independent).

**Success Criteria** (what must be TRUE):
1. `ls -l TimeTracking-Clean/server/database.db` shows `-> /home/ubuntu/databases/production.db`
2. `lsof -p <pm2-pid> | grep .db` shows `/home/ubuntu/databases/production.db` (not any path under `/home/ubuntu/*.db`)
3. `curl -s http://129.159.8.19:3000/api/health` returns `{"status":"ok","database":"connected",...}`
4. `pm2 env timetracking-server` shows `DATABASE_PATH=/home/ubuntu/databases/production.db` and `TZ=Europe/Berlin`
5. Desktop App can log in and fetch data after the restart

**Rollback (if health check fails after restart):**
```bash
pm2 stop timetracking-server && pm2 delete timetracking-server
cd /home/ubuntu/TimeTracking-Clean/server
rm database.db
cp database.db.backup.TIMESTAMP database.db   # restore pre-symlink file
pm2 start dist/server.js --name timetracking-server \
  --env NODE_ENV=production PORT=3000 TZ=Europe/Berlin --time
pm2 save
```
Then verify: `curl -s http://129.159.8.19:3000/api/health`

**Plans:** TBD

**UI hint**: no

---

### Phase 3: Local Dev Sync Script

**Goal:** A developer on Windows can run `npm run sync-dev-db` in Git Bash and get a fresh copy of the production DB installed as `server/database.db` in under 2 minutes.

**Why:** The macOS Extended Attributes bug corrupted local DBs. The move to Windows removes that specific issue, but there is still no documented, automated way to pull the production DB for local development. Without this, developers work against stale or missing local data. No new npm dependencies — only bash + scp + sqlite3 (already available in Git Bash / WSL).

**Depends on:** Phase 2 (production DB path must be stable at `/home/ubuntu/databases/production.db`)

**Plans:**
1. **Create `scripts/sync-dev-db.sh`** — SSH check → backup existing local `server/database.db` → SCP download to temp path → `PRAGMA integrity_check` → move to `server/database.db`. Windows/Git Bash compatible: no `xattr` calls, no macOS-only commands (guard with `[[ "$OSTYPE" == "darwin"* ]]` for xattr only)
2. **Add `sync-dev-db` to root `package.json` scripts** — `"sync-dev-db": "bash ./scripts/sync-dev-db.sh"`
3. **Update `.gitignore`** — ensure `server/database.db`, `server/*.db.backup.*`, and `server/development.db` are all ignored
4. **Test on Windows (Git Bash)** — run `npm run sync-dev-db` from project root, verify DB downloads, integrity check passes, and `server/database.db` is replaced

Plans 2 and 3 can run in parallel (package.json edit and .gitignore edit are independent).

**Success Criteria** (what must be TRUE):
1. `npm run sync-dev-db` completes without errors on Windows (Git Bash) and prints a summary showing user count and latest time entry date
2. `server/database.db` is replaced with a fresh copy from production after the script runs
3. A timestamped backup of the previous local DB is created before overwriting (e.g. `server/database.db.backup.20260402_143000`)
4. Running `npm run dev` in `server/` after the sync connects to the new local DB without errors
5. `git status` shows no untracked `*.db` files (`.gitignore` covers them)

**Rollback:** Script only writes to `server/database.db` locally — no server changes. If something goes wrong, the timestamped backup created in step 2 of the script can be restored manually.

**Plans:** TBD

---

### Phase 4: Deploy Workflow + Documentation

**Goal:** CI/CD pipelines verify the DB path after every deployment, the Green Server PORT issue is documented and fixed, and all developer-facing docs reflect the 2-Tier architecture.

**Why:** Even with the new DB structure in place, the next deployment could silently use the wrong DB if `deploy-server.yml` doesn't verify it. The Green Server PORT bug (PM2 not loading `.env` → PORT variable ignored → crashes) was the root cause of 2-hour debugging sessions and needs a documented fix so it doesn't regress. Documentation that still describes the old 3-Tier flow will confuse future development sessions.

**Depends on:** Phase 2 (ecosystem file exists), Phase 3 (sync script exists)

**Plans:**
1. **Harden `deploy-server.yml`** — add a post-deploy step that SSHes to the server and verifies `lsof -p <pm2-pid> | grep .db` contains `/home/ubuntu/databases/production.db`; fail the workflow if not
2. **Fix `deploy-staging.yml`** — document the PORT env issue (PM2 ignores `.env`; fix is to pass `PORT=3001` via the ecosystem/inline env), mark Green as on-demand with a comment block at the top of the file
3. **Update `ENV.md` and `WINDOWS_PC_SETUP.md`** — replace all references to old DB paths with the new 2-Tier structure; document `npm run sync-dev-db` as the standard local DB setup step
4. **Update `.claude/CLAUDE.md`** — replace the 3-Tier "Production Deployment" workflow section with the 2-Tier flow (`npm run sync-dev-db` → develop → `git push main`); update DB Rules section to reflect single production DB path

Plans 3 and 4 can run in parallel (independent doc files).

**Success Criteria** (what must be TRUE):
1. A `git push main` with a server-side code change triggers `deploy-server.yml`, completes in under 10 minutes, and the post-deploy DB verification step passes (green checkmark in GitHub Actions)
2. `deploy-staging.yml` has a comment at the top stating it is on-demand only, and the PORT variable is passed explicitly (not relying on `.env` loading)
3. `ENV.md` contains no references to `database-shared.db`, `database-production.db`, or the old 3-Tier flow
4. `CLAUDE.md` DB Rules section states `DATABASE_PATH=/home/ubuntu/databases/production.db` as the canonical production path and describes the 2-Tier workflow

**Rollback:** Doc and workflow changes are git-reversible. The `deploy-server.yml` change only adds a verification step — if it causes a false failure, the step can be temporarily disabled or the condition tightened.

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server DB Consolidation | 4/5 | In Progress|  |
| 2. Symlink + PM2 Ecosystem | 0/5 | Not started | - |
| 3. Local Dev Sync Script | 0/4 | Not started | - |
| 4. Deploy Workflow + Documentation | 0/4 | Not started | - |

---

## Coverage

### Requirements Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| Zentralisiertes DB-Verzeichnis `/home/ubuntu/databases/` | Phase 1 | Complete (01-01) |
| Production DB als Master: `production.db` (COPY, nie Move!) | Phase 1 | Pending |
| Blue Server zeigt via Symlink auf zentrales production.db | Phase 2 | Pending |
| PM2 Ecosystem File mit explizitem `DATABASE_PATH` ENV | Phase 2 | Pending |
| `npm run sync-dev-db` Script (Windows-kompatibel) | Phase 3 | Pending |
| Lokale Dev DB heißt `server/database.db` (konfigurierbar) | Phase 3 | Pending |
| `deploy-server.yml` prüft DB-Pfad nach Deployment | Phase 4 | Pending |
| Green Server on-demand: startet/stoppt manuell | Phase 4 | Pending |

**Coverage:** 8/8 requirements mapped (100%)

---

## Key Constraints (Non-Negotiable)

- **NEVER** modify, move, or delete `/home/ubuntu/database-shared.db` (or whatever lsof reveals as live) — copy only
- **30s downtime window** for PM2 restart in Phase 2 — communicate before executing
- **No new npm dependencies** — sync script uses bash + scp + sqlite3 only
- **Windows-compatible** — every script must run in Git Bash; test on Windows before marking phase complete
- **Rollback documented per phase** — each phase has a concrete rollback procedure

---

*Last updated: 2026-04-02*
