# Phase 3: Local Dev Sync Script - Research

**Researched:** 2026-04-02
**Domain:** Bash scripting, SCP/SSH, SQLite integrity verification, Windows/Git Bash compatibility
**Confidence:** HIGH

---

## Summary

Phase 3 creates a Windows-compatible bash script (`scripts/sync-dev-db.sh`) that pulls the production SQLite database from the Oracle Cloud server to `server/database.db` locally. The script must run cleanly in Git Bash on Windows — no `xattr`, no macOS-only tools. The SSH key already exists at `.ssh/oracle_server.key`. `scp` and `ssh` are confirmed available (OpenSSH 10.2). `sqlite3` CLI is NOT available in the current Git Bash environment, so integrity checking must use Node.js + `better-sqlite3` (which is already a project dependency in `server/package.json`).

A near-identical script already exists at `scripts/database/sync-prod.sh` but targets the old production DB path (`/home/ubuntu/TimeTracking-Clean/server/database.db`), which is the 3-Tier path. The new script must use the Phase 2 canonical path `/home/ubuntu/databases/production.db` and write to `server/database.db` (not `server/database/development.db`). The `.env.development` sets `DATABASE_PATH=./database/development.db`, so after the sync the local server must be run with `DATABASE_PATH=./database.db` — or the script should write to `server/database.db` and the developer should be advised to start the server accordingly.

**Primary recommendation:** Adapt the existing `scripts/database/sync-prod.sh` pattern for the new 2-Tier paths, replace `sqlite3` CLI calls with a one-liner `node -e` using `better-sqlite3` for the integrity check and summary query, and write the DB to `server/database.db`.

---

## Project Constraints (from CLAUDE.md)

- **No new npm dependencies** — sync script uses bash + scp + sqlite3 only (since `sqlite3` CLI is unavailable, use `node -e` with `better-sqlite3` which is already installed)
- **Windows-compatible** — every script must run in Git Bash; test on Windows before marking phase complete
- **One Database:** Only `server/database.db` (NEVER create additional DBs)
- **NEVER modify, move, or delete** `/home/ubuntu/database-shared.db` — the script only reads `/home/ubuntu/databases/production.db`
- **No `any` TypeScript types** — not applicable to bash scripts, but any helper Node scripts must comply
- **Plan-First Approach** — research before coding
- **DEPLOYMENT:** SSH key at `.ssh/oracle_server.key` relative to project root

---

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| bash | 5.2.37 (MSYS2) | Script runtime | Available in Git Bash on Windows — confirmed |
| ssh/scp | OpenSSH 10.2p1 | Remote file transfer | Already installed and used in other scripts |
| node (better-sqlite3) | ^12.4.1 | SQLite integrity check + summary query | `sqlite3` CLI absent; `better-sqlite3` already in `server/package.json` |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `$OSTYPE` check | — | Guard macOS-only calls | `[[ "$OSTYPE" == "darwin"* ]]` wraps any `xattr` usage |
| `chmod 600` | — | Fix key permissions | SSH rejects world-readable keys |
| `date +%Y%m%d_%H%M%S` | — | Timestamp for backup file names | POSIX `date` works in Git Bash |

### No Installation Needed
No `npm install` required. `better-sqlite3` is installed when the developer runs `cd server && npm install`.

---

## Architecture Patterns

### File Layout After Phase 3
```
project-root/
├── scripts/
│   ├── sync-dev-db.sh          # NEW — the sync script
│   └── database/
│       └── sync-prod.sh        # OLD — 3-Tier script (keep for reference, don't delete)
├── server/
│   └── database.db             # Written here by sync script (gitignored)
├── .ssh/
│   └── oracle_server.key       # SSH key (gitignored)
└── package.json                # Add "sync-dev-db" script here
```

### Script Flow Pattern (from existing sync-prod.sh, adapted)
```
1. Resolve project root (script may be called from any cwd)
2. Check SSH key exists at $PROJECT_ROOT/.ssh/oracle_server.key
3. chmod 600 $SSH_KEY (Git Bash may not preserve Unix perms)
4. Test SSH connectivity — fail fast with clear message
5. Backup existing server/database.db if it exists
   → path: server/database.db.backup.YYYYMMDD_HHMMSS
6. SCP production DB to a temp path first (atomic write)
   → source: ubuntu@129.159.8.19:/home/ubuntu/databases/production.db
   → temp:   /tmp/prod_sync_TIMESTAMP.db
7. PRAGMA integrity_check via node -e + better-sqlite3
   → open temp file readonly, run pragma, check result === 'ok'
8. Move temp file to server/database.db
9. Print summary: user count + latest time_entry date
   → via node -e + better-sqlite3 (sqlite3 CLI not available)
10. Print completion message
```

### Key Path Resolution Pattern
The script is invoked as `bash ./scripts/sync-dev-db.sh` from the project root via npm. To support both direct invocation and npm-invoked contexts, resolve the project root relative to the script file:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_KEY="$PROJECT_ROOT/.ssh/oracle_server.key"
LOCAL_DB="$PROJECT_ROOT/server/database.db"
```

This pattern is robust regardless of the caller's working directory.

### Integrity Check via Node.js (no sqlite3 CLI)
Since `sqlite3` is not available in the Git Bash environment:

```bash
# Integrity check (returns 'ok' if valid)
INTEGRITY=$(node -e "
  const Database = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
  const db = new Database('$TEMP_DB', {readonly: true});
  const result = db.pragma('integrity_check');
  db.close();
  console.log(result[0].integrity_check);
" 2>&1)

if [[ "$INTEGRITY" != "ok" ]]; then
  echo "ERROR: integrity_check failed: $INTEGRITY"
  rm -f "$TEMP_DB"
  exit 1
fi
```

Note: `better-sqlite3` `pragma()` returns an array of row objects. `result[0].integrity_check` extracts the string value.

### Summary Query via Node.js
```bash
node -e "
  const Database = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
  const db = new Database('$LOCAL_DB', {readonly: true});
  const users = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE deletedAt IS NULL').get();
  const latest = db.prepare('SELECT MAX(date) as d FROM time_entries').get();
  db.close();
  console.log('Users: ' + users.cnt + ' | Latest entry: ' + (latest.d || 'none'));
"
```

### package.json Entry
```json
"sync-dev-db": "bash ./scripts/sync-dev-db.sh"
```

This is how `npm run sync-dev-db` works from the project root — consistent with how `scripts/database/sync-prod.sh` was wired before.

### .gitignore Updates Required
The current `.gitignore` already covers `*.db` globally, `server/database.db`, and `*.backup.db`. However it does NOT cover the specific backup naming convention planned for this phase (`server/database.db.backup.YYYYMMDD_HHMMSS`). The file extension is `.db.backup.TIMESTAMP` — not `.backup.db` — so the existing `*.backup.db` pattern does NOT match.

Need to add:
```
server/*.db.backup.*
server/database.db
server/development.db
```

`server/database.db` is already listed, so confirm it's present. `server/*.db.backup.*` is the new line needed for timestamped backups.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite integrity check | Custom binary reader | `better-sqlite3` PRAGMA via node -e | WAL files, page checksums, etc. — complex to validate correctly |
| Atomic file write | Write direct to destination | Write to `/tmp/`, then `mv` | Prevents partial writes corrupting the local DB |
| SSH connectivity check | Parse `scp` exit codes | `ssh -o ConnectTimeout=5 ... echo ok` | Fast failure, clear message before long SCP |

---

## Common Pitfalls

### Pitfall 1: SSH Key Permissions (Windows/MSYS2)
**What goes wrong:** `ssh` rejects the key with "Permissions 0644 for ... are too open" or similar.
**Why it happens:** Git on Windows does not preserve Unix file permissions. When the repo is cloned, `.ssh/oracle_server.key` gets broad permissions.
**How to avoid:** Run `chmod 600 "$SSH_KEY"` at the top of the script before any SSH/SCP call. The existing `scripts/database/sync-prod.sh` already does this with `|| true` to suppress errors on systems where chmod behaves differently.
**Warning signs:** `ssh` exits with `Permission denied` or `bad permissions` in the error output.

### Pitfall 2: `better-sqlite3` not installed
**What goes wrong:** `node -e "require('...better-sqlite3')"` throws `MODULE_NOT_FOUND`.
**Why it happens:** Developer cloned the repo but never ran `npm install` in `server/`.
**How to avoid:** Check if the module exists before attempting the integrity check. If not found, print a clear message: "Run 'cd server && npm install' first."
**Detection:**
```bash
if [ ! -d "$PROJECT_ROOT/server/node_modules/better-sqlite3" ]; then
  echo "ERROR: better-sqlite3 not installed. Run: cd server && npm install"
  exit 1
fi
```

### Pitfall 3: Temp file left behind on failure
**What goes wrong:** If SCP succeeds but the integrity check fails, `/tmp/prod_sync_*.db` is left behind.
**Why it happens:** Script exits early without cleanup.
**How to avoid:** Use a `trap` for cleanup, or explicitly `rm -f "$TEMP_DB"` in the failure paths.
```bash
TEMP_DB="/tmp/prod_sync_${TIMESTAMP}.db"
trap 'rm -f "$TEMP_DB"' EXIT
```

### Pitfall 4: Script run from wrong directory breaks relative paths
**What goes wrong:** If a developer runs `bash scripts/sync-dev-db.sh` from `server/`, relative paths break.
**Why it happens:** Relative paths resolve from the caller's CWD, not the script location.
**How to avoid:** Use `BASH_SOURCE[0]`-based project root resolution (shown in Architecture Patterns above).

### Pitfall 5: DATABASE_PATH in .env.development points to development.db, not database.db
**What goes wrong:** After syncing, the developer runs `npm run dev` in `server/` — but `.env.development` sets `DATABASE_PATH=./database/development.db`, which is a different file than `server/database.db`.
**Why it happens:** The sync script writes to `server/database.db`, but local dev uses `server/database/development.db` by default.
**How to avoid:** The script's README/output should clearly state: "Start the server with `DATABASE_PATH=./database.db npm run dev` or set `DATABASE_PATH=./database.db` in `.env.development` to use the synced production copy."
**Alternative:** Write the DB to `server/database/development.db` instead, which is where `.env.development` already points. This is the cleaner choice — the developer can immediately run `npm run dev` without extra steps.

**Decision needed for planner:** The ROADMAP says the script writes to `server/database.db`. The `.env.development` points to `./database/development.db`. These are two different paths. The planner should decide which is canonical — writing to `server/database.db` (per ROADMAP success criteria) requires the developer to know to override DATABASE_PATH, while writing to `server/database/development.db` "just works" with the existing dev setup.

The ROADMAP success criteria SC-4 states: "Running `npm run dev` in `server/` after the sync connects to the new local DB without errors." For this to pass automatically, the script should write to `server/database/development.db`, which is what `DATABASE_PATH=./database/development.db` resolves to. However SC-2 says "`server/database.db` is replaced." There is a contradiction. The planner should write to `server/database.db` (per SC-2) AND ensure the developer instruction is included in the script output (for SC-4).

### Pitfall 6: `BASH_SOURCE[0]` not set in some invocation modes
**What goes wrong:** In some edge cases (`bash -c` or sourced scripts), `BASH_SOURCE[0]` may not be set.
**Why it happens:** BASH_SOURCE is only set in bash scripts invoked as files.
**How to avoid:** When called via `npm run sync-dev-db` (i.e., `bash ./scripts/sync-dev-db.sh`), BASH_SOURCE[0] is always the script path. This is the only supported invocation.

---

## Code Examples

Verified patterns from existing project scripts:

### Project Root Resolution (from scripts/database/sync-prod.sh pattern, improved)
```bash
# Source: scripts/database/sync-prod.sh (adapted)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_KEY="$PROJECT_ROOT/.ssh/oracle_server.key"
PROD_HOST="ubuntu@129.159.8.19"
PROD_DB_PATH="/home/ubuntu/databases/production.db"
LOCAL_DB="$PROJECT_ROOT/server/database.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DB="/tmp/prod_sync_${TIMESTAMP}.db"
```

### SSH Connectivity Test
```bash
# Source: scripts/database/sync-prod.sh pattern
chmod 600 "$SSH_KEY" 2>/dev/null || true
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
    "$PROD_HOST" "echo ok" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to $PROD_HOST"
  exit 1
fi
```

### Backup Existing DB
```bash
if [ -f "$LOCAL_DB" ]; then
  BACKUP="$PROJECT_ROOT/server/database.db.backup.${TIMESTAMP}"
  cp "$LOCAL_DB" "$BACKUP"
  echo "Backed up to: $BACKUP"
fi
```

### SCP Download
```bash
# Source: scripts/database/sync-prod.sh pattern
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
    "$PROD_HOST:$PROD_DB_PATH" "$TEMP_DB"
```

### Integrity Check via better-sqlite3
```bash
# No sqlite3 CLI — use node + better-sqlite3 (already installed)
INTEGRITY=$(node -e "
  try {
    const D = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
    const db = new D('$TEMP_DB', {readonly: true});
    const r = db.pragma('integrity_check');
    db.close();
    process.stdout.write(r[0].integrity_check);
  } catch(e) {
    process.stderr.write(e.message);
    process.exit(1);
  }
" 2>&1)

if [[ "$INTEGRITY" != "ok" ]]; then
  echo "ERROR: integrity_check returned: $INTEGRITY"
  rm -f "$TEMP_DB"
  exit 1
fi
```

### Summary Output
```bash
node -e "
  const D = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
  const db = new D('$LOCAL_DB', {readonly: true});
  const u = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE deletedAt IS NULL').get();
  const e = db.prepare('SELECT MAX(date) as d FROM time_entries').get();
  db.close();
  console.log('Users: ' + u.cnt + ' | Latest time entry: ' + (e.d || 'none'));
"
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bash | Script runtime | Yes | 5.2.37 MSYS2 | — |
| ssh | SSH connectivity check | Yes | OpenSSH 10.2p1 | — |
| scp | DB download | Yes | OpenSSH 10.2p1 | — |
| sqlite3 CLI | Integrity check / summary | No | — | node -e + better-sqlite3 |
| node | Integrity check / summary | Yes | (npm >= 20 required per package.json) | — |
| better-sqlite3 | Integrity check / summary | After `cd server && npm install` | ^12.4.1 | Script must check and error if missing |
| .ssh/oracle_server.key | All SSH/SCP calls | Yes | — | — |

**Missing dependencies with no fallback:**
- None — `sqlite3` CLI absence is fully covered by the `node -e + better-sqlite3` fallback.

**Missing dependencies with fallback:**
- `better-sqlite3`: must be installed via `cd server && npm install`. Script should detect absence and print clear install instruction.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `scripts/database/sync-prod.sh` — targets 3-Tier DB path `/home/ubuntu/TimeTracking-Clean/server/database.db` | `scripts/sync-dev-db.sh` — targets 2-Tier path `/home/ubuntu/databases/production.db` | Old script is stale after Phase 2 |
| Old script writes to `./database/development.db` | New script writes to `server/database.db` per ROADMAP SC-2 | Impacts which DATABASE_PATH the server dev uses |
| Used `sqlite3` CLI for integrity check | Must use `node -e + better-sqlite3` on Windows | sqlite3 not in Git Bash PATH |

**Deprecated/outdated:**
- `scripts/database/sync-prod.sh`: References the old 3-Tier DB path. Should be kept as historical reference but not maintained going forward. A comment at the top noting it's superseded by `scripts/sync-dev-db.sh` would be appropriate.

---

## Open Questions

1. **`server/database.db` vs `server/database/development.db` as sync target**
   - What we know: ROADMAP SC-2 says write to `server/database.db`. SC-4 says `npm run dev` works after sync. `.env.development` sets `DATABASE_PATH=./database/development.db`.
   - What's unclear: SC-4 cannot pass automatically if `npm run dev` uses `./database/development.db` but the synced file is at `./database.db`.
   - Recommendation: Write to `server/database.db` (per SC-2). Add a clear `echo` at the end of the script: "To use this DB with npm run dev: set DATABASE_PATH=./database.db in server/.env.development". The planner can include this in the script and in the success criteria verification notes.

2. **`/tmp/` availability in Git Bash**
   - What we know: MSYS2 bash maps `/tmp/` to `C:\Users\<user>\AppData\Local\Temp\` or `C:\msys64\tmp\`. `/tmp/` is writable in Git Bash.
   - What's unclear: If the user's Windows temp path has spaces, `mv` may fail. Using `"$TEMP_DB"` with double-quotes throughout avoids this.
   - Recommendation: Always quote path variables in the script. Consider using `$PROJECT_ROOT/server/` as the temp location instead of `/tmp/` to avoid Windows temp directory quirks.

---

## Sources

### Primary (HIGH confidence)
- Existing project file: `scripts/database/sync-prod.sh` — established SSH/SCP/backup pattern used in this project
- Existing project file: `server/src/config/database.ts` — canonical DATABASE_PATH resolution logic
- Existing project file: `server/.env.development` — confirmed `DATABASE_PATH=./database/development.db`
- Existing project file: `ecosystem.production.config.js` — confirmed `DATABASE_PATH=/home/ubuntu/databases/production.db`
- Environment probe: `ssh -V` → OpenSSH 10.2p1 confirmed available
- Environment probe: `bash --version` → GNU bash 5.2.37 MSYS2 confirmed
- Environment probe: `which sqlite3` → not found — fallback to node required
- Project file: `server/package.json` → `better-sqlite3: ^12.4.1` confirmed dependency
- `.gitignore` — current patterns verified; `server/*.db.backup.*` pattern is missing

### Secondary (MEDIUM confidence)
- ROADMAP.md Phase 3 section — defines exact success criteria and plans
- STATE.md — confirms Phase 2 complete, production DB at `/home/ubuntu/databases/production.db`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools probed directly in the environment
- Script pattern: HIGH — adapted from existing `sync-prod.sh` in the same repo
- Integrity check approach: HIGH — `better-sqlite3` is the established project dependency, used by the server
- .gitignore gap: HIGH — verified by reading current `.gitignore`
- DATABASE_PATH conflict (SC-2 vs SC-4): HIGH confidence the conflict exists, LOW confidence on which resolution the user prefers

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (SSH key and server setup are stable; only changes if server is moved)
