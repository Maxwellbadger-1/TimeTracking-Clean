# DB Setup Refactoring Plan: 2-Tier Architecture

**Created:** 2026-04-02
**Goal:** Simplify from chaotic 3-Tier (Dev→Green→Blue) to clean 2-Tier (Dev→Blue)
**Success Metric:** 5-10 min deployments instead of 2h
**Risk Level:** MEDIUM (touching production, but with safety measures)

---

## 📊 Executive Summary

**Current Problem:**
- 2 hours deployment time for 2-line code fixes
- Staging (Green) Server constantly crashing
- Multiple DB copies with no clear synchronization
- macOS Extended Attributes corrupting local DBs
- Unclear which DB is where

**Proposed Solution:**
- **Simplified 2-Tier:** Development (local) → Production (Blue)
- **Dev DB = Live DB Schema:** Automatic sync before testing
- **Green Server: Optional** (on-demand for critical changes)
- **Clear DB structure:** Symlinks, automated sync, documented locations

**Expected Benefits:**
- ✅ 80% reduction in deployment complexity
- ✅ 5-10 min deployments (vs 2h currently)
- ✅ Reliable local testing with production-like data
- ✅ Clear, documented DB management
- ✅ Flexibility: Green still available when needed

---

## 1. Current State Analysis

### 1.1 Database Locations (Current Chaos)

```bash
# Production Server (Oracle Cloud)
/home/ubuntu/
├── database-shared.db          # 812KB - Actual production? (unclear)
├── database-staging.db         # 492KB - Veraltet (Feb 2026)
├── database-production.db      # Exists? (mentioned in ENV.md)
├── TimeTracking-Clean/         # Blue Server (Production)
│   └── server/
│       └── database.db         # Symlink? Kopie? (unclear)
└── TimeTracking-Staging/       # Green Server (Staging)
    └── server/
        └── database.db         # Missing on fresh clone!

# Local (macOS)
/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/
├── database.db                 # Test data? Production copy? (unclear)
├── database_dev.db             # Development? (unclear)
└── database.green.db           # What is this? (unclear)
```

**Findings:**
- ❌ **No single source of truth** for DB locations
- ❌ **No documentation** which DB is which
- ❌ **Production DB name inconsistent** (database-shared.db vs database-production.db)
- ❌ **Staging DB outdated** (February 2026, not current)
- ❌ **Local DBs corrupted** by macOS Extended Attributes

### 1.2 Deployment Workflows (Current Setup)

```
Development (Local)          Staging (Green)              Production (Blue)
localhost:3000               129.159.8.19:3001            129.159.8.19:3000
??? (multiple DBs)           TimeTracking-Staging/         TimeTracking-Clean/
Manual git push              staging branch               main branch
No automated sync            deploy-staging.yml           deploy-server.yml
```

**Workflow Issues:**
1. **Green Server crashes** - PORT variable ignored (PM2 doesn't load .env)
2. **No DB sync** - Staging uses outdated data
3. **Repository confusion** - deploy-staging.yml referenced non-existent repo
4. **Manual intervention** - Every deployment requires SSH debugging
5. **2h debugging** - Port conflicts, missing DBs, xattr issues

### 1.3 Current Workflows Analysis

| File | Purpose | Issues |
|------|---------|--------|
| `deploy-server.yml` | Production (main → Blue) | Works, but assumes DB exists |
| `deploy-staging.yml` | Staging (staging → Green) | **Broken**: wrong repo, PORT issue, no DB sync |
| `migrate-blue-to-green.yml` | Manual DB sync | Exists but not automated |
| `manual-migration.yml` | Manual DB migrations | Works, but manual trigger only |

---

## 2. Target State: Simplified 2-Tier Architecture

### 2.1 New Structure (Clean & Documented)

```bash
# ═══════════════════════════════════════════════════════════
# PRODUCTION SERVER (Oracle Cloud)
# ═══════════════════════════════════════════════════════════

/home/ubuntu/
├── databases/                                    # ← NEW: Centralized DB storage
│   ├── production.db                             # ← Master DB (LIVE, never touch manually!)
│   ├── staging.db                                # ← Optional: For on-demand testing
│   └── backups/                                  # ← Automatic daily backups
│       ├── production.YYYYMMDD_HHMMSS.db
│       └── ...
│
├── TimeTracking-Clean/                           # Blue Server (Production)
│   └── server/
│       └── database.db → /home/ubuntu/databases/production.db  # ← Symlink (not copy!)
│
└── TimeTracking-Staging/                         # Green Server (Optional, on-demand)
    └── server/
        └── database.db → /home/ubuntu/databases/staging.db     # ← Symlink (not copy!)

# ═══════════════════════════════════════════════════════════
# LOCAL DEVELOPMENT (macOS)
# ═══════════════════════════════════════════════════════════

/Users/maximilianfegg/Desktop/TimeTracking-Clean/
└── server/
    ├── development.db                            # ← Main dev DB (synced from production)
    ├── development.db.backup                     # ← Local backup before sync
    └── .gitignore                                # ← Ignores all *.db files
```

### 2.2 DB Management Philosophy

**Single Source of Truth:**
```
Production DB (LIVE)
    ↓ (automated daily sync)
Development DB (LOCAL)
    ↓ (git push main)
Production DB (deployed code)
```

**Key Principles:**
1. ✅ **Production DB = Master** - Never manually edit
2. ✅ **Dev DB = Schema Clone** - Synced structure, safe test data
3. ✅ **Clear Locations** - Symlinks make repos portable
4. ✅ **Automated Sync** - No manual scp required
5. ✅ **Staging Optional** - Only for critical changes

### 2.3 Deployment Workflows (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│                    NORMAL WORKFLOW (90%)                     │
└─────────────────────────────────────────────────────────────┘

1. npm run sync-dev-db              # Pull latest production schema
   ↓
2. Develop & Test locally           # With realistic data
   ↓
3. git push origin main             # Triggers deploy-server.yml
   ↓
4. Automated Deployment             # Build, migrate, PM2 restart
   ↓
5. Health Check                     # Verify deployment success
   ↓
6. DONE! (5-10 min)                 # No manual intervention


┌─────────────────────────────────────────────────────────────┐
│              CRITICAL CHANGES WORKFLOW (10%)                 │
└─────────────────────────────────────────────────────────────┘

1. npm run sync-dev-db              # Pull latest production schema
   ↓
2. Develop & Test locally           # With realistic data
   ↓
3. /start-green                     # Optional: Start Green Server
   ↓
4. git push origin staging          # Triggers deploy-staging.yml
   ↓
5. Test on Green Server             # With production-like environment
   ↓
6. Approve → git push origin main   # Merge to production
   ↓
7. /stop-green                      # Optional: Stop Green Server
   ↓
8. DONE! (15-20 min)                # Extra safety for critical changes
```

---

## 3. Migration Strategy

### 3.1 Migration Approach: Incremental & Safe

**NOT a "big bang" migration!** We'll migrate in phases to minimize risk:

```
Phase 1: Server DB Consolidation (30 min)     → Zero risk, Blue stays running
Phase 2: Symlink Creation (15 min)            → Low risk, tested offline first
Phase 3: Local Dev DB Sync (30 min)           → Zero production impact
Phase 4: Workflow Updates (20 min)            → Blue unchanged, Green improved
Phase 5: Documentation (20 min)               → Knowledge capture
Phase 6: Validation & Rollback Test (15 min)  → Safety verification

Total: ~2h (one-time investment to save 2h per deployment!)
```

**Safety Measures:**
- ✅ **Backups before EVERY step**
- ✅ **Blue Server never stopped** (production always running)
- ✅ **Rollback plan for each phase**
- ✅ **Validation checkpoints**
- ✅ **No destructive operations** (copies, not moves)

### 3.2 Prerequisites (Verify Before Starting)

```bash
# ☐ SSH Access to Production Server
ssh ubuntu@129.159.8.19 "echo 'SSH OK'"

# ☐ Sufficient Disk Space (need ~2GB for backups)
ssh ubuntu@129.159.8.19 "df -h /home/ubuntu"

# ☐ Current Backups Exist
ssh ubuntu@129.159.8.19 "ls -lh /home/ubuntu/*.db"

# ☐ Blue Server Running
curl -s http://129.159.8.19:3000/api/health | jq

# ☐ PM2 Status
ssh ubuntu@129.159.8.19 "pm2 list"

# ☐ Git Working Directory Clean
git status  # Must be clean, commit any pending changes

# ☐ Local Development DB Backed Up
cp server/database.db server/database.db.backup.$(date +%Y%m%d)
```

---

## 4. Detailed Implementation Plan

### 4.1 Phase 1: Server DB Consolidation (30 min)

**Goal:** Create clean, centralized DB structure on server

**Steps:**

```bash
# ────────────────────────────────────────────────────────────
# Step 1.1: Create centralized DB directory
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Create structure
  mkdir -p /home/ubuntu/databases/backups

  # Verify
  ls -ld /home/ubuntu/databases
EOF

# ────────────────────────────────────────────────────────────
# Step 1.2: Identify current production DB
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # List all DB files with sizes
  ls -lh /home/ubuntu/*.db

  # Check which DB Blue Server uses
  PM2_PID=$(pgrep -f 'timetracking-server' | head -1)
  lsof -p $PM2_PID 2>/dev/null | grep '.db'

  # Expected output: Shows actual DB path Blue is using
EOF

# ────────────────────────────────────────────────────────────
# Step 1.3: Backup current production DB (CRITICAL!)
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Determine source (adjust based on Step 1.2 output)
  SOURCE_DB="/home/ubuntu/database-shared.db"  # Or database-production.db

  # Create timestamped backup
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  cp "$SOURCE_DB" "/home/ubuntu/databases/backups/production.$TIMESTAMP.db"

  # Verify backup
  ls -lh /home/ubuntu/databases/backups/

  # Test backup integrity
  sqlite3 "/home/ubuntu/databases/backups/production.$TIMESTAMP.db" "PRAGMA integrity_check;"
  # Expected: "ok"
EOF

# ────────────────────────────────────────────────────────────
# Step 1.4: Copy to centralized location
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Copy (not move!) to new location
  cp /home/ubuntu/database-shared.db /home/ubuntu/databases/production.db

  # Set permissions
  chmod 600 /home/ubuntu/databases/production.db
  chown ubuntu:ubuntu /home/ubuntu/databases/production.db

  # Verify
  ls -lh /home/ubuntu/databases/production.db
  sqlite3 /home/ubuntu/databases/production.db "PRAGMA integrity_check;"
EOF
```

**Validation Checklist:**
- [ ] `/home/ubuntu/databases/` directory created
- [ ] Backup in `/home/ubuntu/databases/backups/` exists
- [ ] `production.db` in new location
- [ ] PRAGMA integrity_check returns "ok"
- [ ] Original DB still exists (not moved, copied!)

**Rollback:** Nothing to rollback yet, no changes to running system

---

### 4.2 Phase 2: Symlink Creation (15 min)

**Goal:** Point Blue Server to centralized DB via symlink

**Steps:**

```bash
# ────────────────────────────────────────────────────────────
# Step 2.1: Backup Blue Server's current database.db
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  cd /home/ubuntu/TimeTracking-Clean/server

  # If database.db exists
  if [ -f database.db ]; then
    cp database.db database.db.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backed up existing database.db"
  else
    echo "No database.db found (expected if using DATABASE_PATH env var)"
  fi
EOF

# ────────────────────────────────────────────────────────────
# Step 2.2: Create symlink (OFFLINE TEST FIRST!)
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  cd /home/ubuntu/TimeTracking-Clean/server

  # Remove existing database.db (if not symlink)
  if [ -f database.db ] && [ ! -L database.db ]; then
    rm database.db
    echo "Removed old database.db (backup exists)"
  fi

  # Create symlink
  ln -sf /home/ubuntu/databases/production.db database.db

  # Verify symlink
  ls -l database.db
  # Expected: database.db -> /home/ubuntu/databases/production.db

  # Test symlink works
  sqlite3 database.db "SELECT COUNT(*) FROM users;"
  # Expected: Returns user count (e.g., "15")
EOF

# ────────────────────────────────────────────────────────────
# Step 2.3: Test Blue Server with new symlink (NO RESTART YET!)
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Blue Server is still running with old DB path
  # We'll test symlink works BEFORE restarting

  cd /home/ubuntu/TimeTracking-Clean/server

  # Test DB access via symlink
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('./database.db', { readonly: true });
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log('User count via symlink:', users.count);
    db.close();
  "

  # Expected: Shows user count without errors
EOF
```

**Validation Checklist:**
- [ ] Symlink created: `database.db -> /home/ubuntu/databases/production.db`
- [ ] SQLite can read via symlink
- [ ] Node.js can read via symlink
- [ ] Backup of old database.db exists
- [ ] Blue Server still running (not touched yet!)

**Rollback:**
```bash
ssh ubuntu@129.159.8.19 << 'EOF'
  cd /home/ubuntu/TimeTracking-Clean/server
  rm database.db  # Remove symlink
  cp database.db.backup.TIMESTAMP database.db  # Restore from backup
EOF
```

---

### 4.3 Phase 3: Blue Server Restart with New DB Path (10 min)

**Goal:** Point Blue Server to use centralized DB

**WARNING:** This step requires ~30s downtime for PM2 restart!

**Steps:**

```bash
# ────────────────────────────────────────────────────────────
# Step 3.1: Update PM2 environment (use Ecosystem File)
# ────────────────────────────────────────────────────────────

# First, create ecosystem file locally, then deploy it
cat > ecosystem.production.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'timetracking-server',
      script: './dist/server.js',
      cwd: '/home/ubuntu/TimeTracking-Clean/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'Europe/Berlin',
        DATABASE_PATH: '/home/ubuntu/databases/production.db',
        SESSION_SECRET: process.env.SESSION_SECRET || 'CHANGE_ME',
      },
      time: true,
    },
  ],
};
EOF

# Copy to server
scp -i .ssh/oracle_server.key ecosystem.production.js ubuntu@129.159.8.19:/home/ubuntu/

# ────────────────────────────────────────────────────────────
# Step 3.2: Restart Blue Server with new config
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  cd /home/ubuntu

  # Stop Blue Server
  pm2 stop timetracking-server

  # Start with ecosystem file (loads env vars correctly)
  pm2 start ecosystem.production.js

  # Save PM2 config
  pm2 save

  # Wait for startup
  sleep 5

  # Check status
  pm2 list

  # Check which DB is loaded
  PM2_PID=$(pgrep -f 'timetracking-server' | head -1)
  lsof -p $PM2_PID 2>/dev/null | grep '.db'
  # Expected: /home/ubuntu/databases/production.db
EOF

# ────────────────────────────────────────────────────────────
# Step 3.3: Verify Blue Server Health
# ────────────────────────────────────────────────────────────
curl -s http://129.159.8.19:3000/api/health | jq
# Expected: {"status":"ok", "database":"connected"}

# Test login (use Desktop App or curl)
# curl -X POST http://129.159.8.19:3000/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"test@example.com", "password":"..."}'
```

**Validation Checklist:**
- [ ] PM2 shows status "online" (not "errored")
- [ ] Health check returns `{"status":"ok"}`
- [ ] `lsof` shows correct DB path: `/home/ubuntu/databases/production.db`
- [ ] Desktop App can login & fetch data
- [ ] PM2 logs show no errors: `pm2 logs timetracking-server --lines 50`

**Rollback (if health check fails):**
```bash
ssh ubuntu@129.159.8.19 << 'EOF'
  # Stop current PM2 process
  pm2 stop timetracking-server
  pm2 delete timetracking-server

  # Restore old database.db (from backup)
  cd /home/ubuntu/TimeTracking-Clean/server
  rm database.db
  cp database.db.backup.TIMESTAMP database.db

  # Restart without ecosystem file (old env vars)
  cd /home/ubuntu/TimeTracking-Clean/server
  NODE_ENV=production PORT=3000 TZ=Europe/Berlin \
    pm2 start dist/server.js --name timetracking-server --time

  pm2 save
EOF

# Verify rollback worked
curl -s http://129.159.8.19:3000/api/health | jq
```

---

### 4.4 Phase 4: Local Dev DB Sync Script (30 min)

**Goal:** Automated sync Production → Development DB

**Steps:**

```bash
# ────────────────────────────────────────────────────────────
# Step 4.1: Create sync script
# ────────────────────────────────────────────────────────────
cat > scripts/sync-dev-db.sh << 'SCRIPT'
#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW} Syncing Production DB → Development DB${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Config
SERVER="ubuntu@129.159.8.19"
SSH_KEY=".ssh/oracle_server.key"
REMOTE_DB="/home/ubuntu/databases/production.db"
LOCAL_DB="server/development.db"
TEMP_DB="/tmp/production-sync-$(date +%s).db"

# Step 1: Check SSH access
echo -e "${YELLOW}[1/6]${NC} Checking SSH access..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 "$SERVER" "echo 'SSH OK'" > /dev/null 2>&1; then
  echo -e "${RED}✗ SSH connection failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ SSH access OK${NC}"
echo ""

# Step 2: Backup current dev DB
echo -e "${YELLOW}[2/6]${NC} Backing up current development.db..."
if [ -f "$LOCAL_DB" ]; then
  cp "$LOCAL_DB" "${LOCAL_DB}.backup.$(date +%Y%m%d_%H%M%S)"
  echo -e "${GREEN}✓ Backup created${NC}"
else
  echo -e "${YELLOW}  No existing development.db (first sync)${NC}"
fi
echo ""

# Step 3: Download production DB
echo -e "${YELLOW}[3/6]${NC} Downloading production DB..."
scp -i "$SSH_KEY" -q "$SERVER:$REMOTE_DB" "$TEMP_DB"
echo -e "${GREEN}✓ Downloaded ($(du -h "$TEMP_DB" | cut -f1))${NC}"
echo ""

# Step 4: Verify DB integrity
echo -e "${YELLOW}[4/6]${NC} Verifying DB integrity..."
if sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
  echo -e "${GREEN}✓ Integrity check passed${NC}"
else
  echo -e "${RED}✗ Integrity check failed!${NC}"
  rm "$TEMP_DB"
  exit 1
fi
echo ""

# Step 5: Fix macOS Extended Attributes (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo -e "${YELLOW}[5/6]${NC} Removing macOS Extended Attributes..."
  xattr -c "$TEMP_DB" 2>/dev/null || true
  echo -e "${GREEN}✓ Extended attributes removed${NC}"
else
  echo -e "${YELLOW}[5/6]${NC} Not on macOS, skipping xattr cleanup"
fi
echo ""

# Step 6: Move to development location
echo -e "${YELLOW}[6/6]${NC} Installing as development.db..."
mv "$TEMP_DB" "$LOCAL_DB"
echo -e "${GREEN}✓ Development DB updated${NC}"
echo ""

# Show DB info
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Sync Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "DB Info:"
sqlite3 "$LOCAL_DB" "
  SELECT
    'Users: ' || COUNT(*) FROM users;
  SELECT
    'Time Entries: ' || COUNT(*) FROM time_entries;
  SELECT
    'Latest Entry: ' || MAX(date) FROM time_entries;
"
echo ""
echo -e "${YELLOW}→ Run 'npm run dev' in server/ to start with synced DB${NC}"
SCRIPT

chmod +x scripts/sync-dev-db.sh

# ────────────────────────────────────────────────────────────
# Step 4.2: Add npm script
# ────────────────────────────────────────────────────────────
# Add to server/package.json:
#   "sync-dev-db": "../scripts/sync-dev-db.sh"

# Or add to root package.json:
#   "sync-dev-db": "./scripts/sync-dev-db.sh"
```

**Test the script:**
```bash
./scripts/sync-dev-db.sh

# Expected output:
# [1/6] ✓ SSH access OK
# [2/6] ✓ Backup created
# [3/6] ✓ Downloaded (812KB)
# [4/6] ✓ Integrity check passed
# [5/6] ✓ Extended attributes removed
# [6/6] ✓ Development DB updated
# ✓ Sync Complete!
```

**Validation Checklist:**
- [ ] Script downloads DB successfully
- [ ] macOS xattr cleanup works
- [ ] Integrity check passes
- [ ] Local dev DB updated
- [ ] Can start server with synced DB

**Rollback:** Restore from backup:
```bash
cp server/development.db.backup.TIMESTAMP server/development.db
```

---

### 4.5 Phase 5: Green Server Optional Setup (20 min)

**Goal:** Make Green Server on-demand, not always running

**Steps:**

```bash
# ────────────────────────────────────────────────────────────
# Step 5.1: Create staging DB (copy from production)
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Copy production DB to staging
  cp /home/ubuntu/databases/production.db /home/ubuntu/databases/staging.db

  # Verify
  ls -lh /home/ubuntu/databases/staging.db
  sqlite3 /home/ubuntu/databases/staging.db "PRAGMA integrity_check;"
EOF

# ────────────────────────────────────────────────────────────
# Step 5.2: Stop Green Server (will start on-demand)
# ────────────────────────────────────────────────────────────
ssh ubuntu@129.159.8.19 << 'EOF'
  # Check if Green Server is running
  if pm2 list | grep -q "timetracking-staging"; then
    pm2 stop timetracking-staging
    echo "Green Server stopped (now on-demand)"
  else
    echo "Green Server not running"
  fi

  pm2 save
EOF

# ────────────────────────────────────────────────────────────
# Step 5.3: Create ecosystem file for Green Server
# ────────────────────────────────────────────────────────────
cat > ecosystem.staging.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'timetracking-staging',
      script: './dist/server.js',
      cwd: '/home/ubuntu/TimeTracking-Staging/server',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
        TZ: 'Europe/Berlin',
        DATABASE_PATH: '/home/ubuntu/databases/staging.db',
        SESSION_SECRET: process.env.SESSION_SECRET || 'CHANGE_ME',
      },
      time: true,
    },
  ],
};
EOF

scp -i .ssh/oracle_server.key ecosystem.staging.js ubuntu@129.159.8.19:/home/ubuntu/

# ────────────────────────────────────────────────────────────
# Step 5.4: Create slash commands for on-demand Green Server
# ────────────────────────────────────────────────────────────
# /start-green - Start Green Server with latest production data
# /stop-green - Stop Green Server to save resources
# /sync-green - Sync production → staging DB (already exists?)
```

**Validation Checklist:**
- [ ] staging.db created in `/home/ubuntu/databases/`
- [ ] Green Server stopped (not errored, just stopped)
- [ ] ecosystem.staging.js uploaded
- [ ] Can manually start Green: `pm2 start ecosystem.staging.js`
- [ ] Green Server health check: `curl http://129.159.8.19:3001/api/health`
- [ ] Can stop Green: `pm2 stop timetracking-staging`

---

### 4.6 Phase 6: Update Workflows (20 min)

**Goal:** Update GitHub Actions to use new DB structure

**Changes Required:**

1. **deploy-server.yml** (Production)
   - ✅ Already uses centralized DB (via DATABASE_PATH env var)
   - ✅ Update to use ecosystem.production.js
   - ✅ Add health check retry logic

2. **deploy-staging.yml** (Staging - now optional)
   - ✅ Fix repository reference (use TimeTracking-Clean, staging branch)
   - ✅ Sync production → staging DB BEFORE build
   - ✅ Use ecosystem.staging.js
   - ✅ Fix PORT env var (set as PREFIX, not .env file)

3. **New workflow: sync-staging-db.yml** (Manual trigger)
   - ✅ Workflow to sync production → staging on-demand
   - ✅ Useful before testing critical changes on Green Server

**Implementation:**

```yaml
# ────────────────────────────────────────────────────────────
# .github/workflows/deploy-server.yml (Updated)
# ────────────────────────────────────────────────────────────
name: Deploy to Production (Blue Server)

on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - '.github/workflows/deploy-server.yml'
      - 'ecosystem.production.js'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Build Server
        run: |
          cd server
          npm ci
          npm run build

      - name: Deploy to Production Server
        env:
          SSH_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
        run: |
          # Setup SSH
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key

          # Deploy code
          rsync -avz -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
            server/dist/ ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/server/dist/

          # Copy ecosystem file
          scp -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
            ecosystem.production.js ubuntu@129.159.8.19:/home/ubuntu/

          # Run migrations
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 << 'EOF'
            cd /home/ubuntu/TimeTracking-Clean/server

            # Backup DB before migration
            TIMESTAMP=$(date +%Y%m%d_%H%M%S)
            cp /home/ubuntu/databases/production.db \
               /home/ubuntu/databases/backups/production.$TIMESTAMP.db

            # Run migrations
            node dist/migrations/run.js
          EOF

          # Restart PM2 with ecosystem file
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 << 'EOF'
            cd /home/ubuntu
            export SESSION_SECRET="${SESSION_SECRET}"
            pm2 restart timetracking-server --update-env
            pm2 save
          EOF

      - name: Health Check (with retry)
        run: |
          echo "Waiting for server restart..."
          sleep 10

          for i in {1..5}; do
            echo "Health check attempt $i/5..."
            if curl -f -s http://129.159.8.19:3000/api/health | grep -q "ok"; then
              echo "✓ Health check passed!"
              exit 0
            fi
            sleep 5
          done

          echo "✗ Health check failed after 5 attempts"
          exit 1
```

---

### 4.7 Phase 7: Documentation Updates (20 min)

**Goal:** Update all docs to reflect new DB structure

**Files to Update:**

1. **ENV.md**
   - Database Locations section (with new structure)
   - Deployment instructions (reference ecosystem files)
   - Troubleshooting section (new DB paths)

2. **CLAUDE.md**
   - Remove outdated Blue-Green complexity
   - Add simplified 2-Tier workflow
   - Update slash commands (/start-green, /stop-green)
   - Add sync-dev-db workflow

3. **ARCHITECTURE.md**
   - Update Deployment View (Section 7)
   - Add ADR for DB structure simplification
   - Update diagrams (if any)

4. **New Doc: .planning/DB-MANAGEMENT.md**
   - Complete guide to DB structure
   - When to use Green Server
   - Sync procedures
   - Backup/Restore procedures
   - Troubleshooting

**Template for DB-MANAGEMENT.md:**

```markdown
# Database Management Guide

## Overview

Simplified 2-Tier architecture with optional Staging:
- **Production (Blue):** Live customer data, never edit manually
- **Development (Local):** Synced copy for safe testing
- **Staging (Green):** Optional, on-demand for critical changes

## Database Locations

### Production Server
```
/home/ubuntu/databases/
├── production.db         # Master (LIVE)
├── staging.db            # Optional (synced from production)
└── backups/              # Automated daily backups
    ├── production.YYYYMMDD_HHMMSS.db
    └── ...
```

### Local Development
```
server/
├── development.db        # Synced from production
└── development.db.backup # Local backup
```

## Daily Workflows

### Normal Development (90% of cases)
```bash
# 1. Sync latest production schema
npm run sync-dev-db

# 2. Develop & test locally
cd server && npm run dev

# 3. Push to production
git push origin main

# 4. Verify deployment
curl http://129.159.8.19:3000/api/health
```

### Critical Changes (10% of cases)
```bash
# 1-2. Same as normal workflow
npm run sync-dev-db
# ... develop & test ...

# 3. Start Green Server (on-demand)
/start-green  # or manually: ssh + pm2 start ecosystem.staging.js

# 4. Deploy to staging
git push origin staging

# 5. Test on Green Server
# Use Desktop App with /green command

# 6. If OK, deploy to production
git push origin main

# 7. Stop Green Server (save resources)
/stop-green  # or manually: ssh + pm2 stop timetracking-staging
```

## Troubleshooting

### Problem: Local DB corrupted after scp
**Cause:** macOS Extended Attributes
**Fix:**
```bash
xattr -c server/development.db
```

### Problem: Blue Server can't find database
**Cause:** Symlink broken or DATABASE_PATH env var wrong
**Fix:**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean/server
ls -l database.db  # Check symlink
pm2 env 0 | grep DATABASE_PATH  # Check env var
```

### Problem: Green Server crashes with PORT error
**Cause:** PORT env var not set as PM2 prefix
**Fix:**
```bash
ssh ubuntu@129.159.8.19
pm2 delete timetracking-staging
pm2 start ecosystem.staging.js  # Uses correct PORT=3001
```
```

---

## 5. Risk Assessment & Mitigation

### 5.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Production downtime during migration** | LOW | HIGH | Incremental migration, Blue stays running until Phase 3 |
| **DB corruption during sync** | LOW | HIGH | Integrity checks, backups before every step |
| **Symlink breaks PM2 process** | MEDIUM | MEDIUM | Test symlink offline first (Phase 2), rollback plan ready |
| **macOS xattr corrupts local DB** | HIGH | LOW | Automated xattr cleanup in sync script |
| **ENV vars not loaded in PM2** | MEDIUM | MEDIUM | Use ecosystem files (explicit env vars) |
| **Deployment workflow breaks** | LOW | MEDIUM | Test workflows on staging first |
| **Loss of production data** | VERY LOW | CRITICAL | Multiple backups (automated + manual), tested restore |

### 5.2 Rollback Strategy

**Each phase has independent rollback:**

| Phase | Rollback Procedure | Time Required |
|-------|-------------------|---------------|
| Phase 1 | Delete `/home/ubuntu/databases/`, no impact | 1 min |
| Phase 2 | Restore `database.db` from backup, remove symlink | 2 min |
| Phase 3 | PM2 restart with old env vars, restore old DB | 5 min |
| Phase 4 | Delete sync script, restore dev DB from backup | 1 min |
| Phase 5 | N/A (Green Server optional, no production impact) | 0 min |
| Phase 6 | Revert workflow commits via `git revert` | 5 min |

**Emergency Production Rollback (if everything fails):**
```bash
ssh ubuntu@129.159.8.19 << 'EOF'
  # Stop Blue Server
  pm2 stop timetracking-server
  pm2 delete timetracking-server

  # Restore DB from latest backup
  LATEST_BACKUP=$(ls -t /home/ubuntu/databases/backups/production.*.db | head -1)
  cp "$LATEST_BACKUP" /home/ubuntu/databases/production.db

  # Restore old server directory (from git)
  cd /home/ubuntu/TimeTracking-Clean
  git stash  # Save any local changes
  git reset --hard LAST_KNOWN_GOOD_COMMIT

  # Rebuild
  cd server
  npm ci
  npm run build

  # Start with old method (no ecosystem file)
  NODE_ENV=production PORT=3000 TZ=Europe/Berlin \
    pm2 start dist/server.js --name timetracking-server --time

  pm2 save
EOF

# Verify
curl -s http://129.159.8.19:3000/api/health | jq
```

**Recovery Time Objective (RTO):** < 10 minutes

---

## 6. Validation & Acceptance Criteria

### 6.1 Technical Validation

**Post-Migration Checks:**

```bash
# ═══════════════════════════════════════════════════════════
# Production Server Validation
# ═══════════════════════════════════════════════════════════

ssh ubuntu@129.159.8.19 << 'EOF'
  echo "━━━━ DB Structure ━━━━"
  ls -lh /home/ubuntu/databases/
  # Expected: production.db, staging.db, backups/

  echo "━━━━ Symlinks ━━━━"
  ls -l /home/ubuntu/TimeTracking-Clean/server/database.db
  # Expected: -> /home/ubuntu/databases/production.db

  echo "━━━━ PM2 Status ━━━━"
  pm2 list
  # Expected: timetracking-server = online

  echo "━━━━ Database in Use ━━━━"
  PM2_PID=$(pgrep -f 'timetracking-server' | head -1)
  lsof -p $PM2_PID | grep '.db'
  # Expected: /home/ubuntu/databases/production.db

  echo "━━━━ DB Integrity ━━━━"
  sqlite3 /home/ubuntu/databases/production.db "PRAGMA integrity_check;"
  # Expected: ok

  echo "━━━━ Environment Variables ━━━━"
  pm2 env 0 | grep -E '(NODE_ENV|PORT|DATABASE_PATH)'
  # Expected: NODE_ENV=production, PORT=3000, DATABASE_PATH=/home/.../production.db
EOF

# ═══════════════════════════════════════════════════════════
# Local Development Validation
# ═══════════════════════════════════════════════════════════

echo "━━━━ Local DB ━━━━"
ls -lh server/development.db
# Expected: File exists, ~800KB

echo "━━━━ Sync Script ━━━━"
ls -lh scripts/sync-dev-db.sh
# Expected: Executable, ~5KB

echo "━━━━ DB Integrity ━━━━"
sqlite3 server/development.db "PRAGMA integrity_check;"
# Expected: ok

echo "━━━━ Schema Match ━━━━"
sqlite3 server/development.db ".schema users" | head -10
# Expected: Same schema as production

# ═══════════════════════════════════════════════════════════
# Functional Validation
# ═══════════════════════════════════════════════════════════

echo "━━━━ Health Check ━━━━"
curl -s http://129.159.8.19:3000/api/health | jq
# Expected: {"status":"ok", "database":"connected"}

echo "━━━━ Desktop App Test ━━━━"
# Open Desktop App, login, create time entry
# Expected: No errors, data syncs correctly

echo "━━━━ Deployment Time Test ━━━━"
# Make small code change, push to main, measure time
# Expected: <10 min from push to health check success
```

### 6.2 Success Criteria

**Migration is considered successful if:**

- [x] **Primary Goals:**
  - [ ] Blue Server (Production) running with centralized DB structure
  - [ ] Symlinks working correctly
  - [ ] Local dev DB can sync from production automatically
  - [ ] Deployment time reduced to <10 min (from 2h)

- [x] **Secondary Goals:**
  - [ ] Green Server can start on-demand when needed
  - [ ] Workflows updated and tested
  - [ ] Documentation complete and accurate
  - [ ] No production data loss
  - [ ] No extended downtime (>5 min)

- [x] **Quality Criteria:**
  - [ ] All automated checks passing
  - [ ] Desktop App functions normally
  - [ ] No errors in PM2 logs
  - [ ] Backups verified and restorable
  - [ ] Team understands new structure (via docs)

---

## 7. Timeline & Effort Estimation

### 7.1 Estimated Timeline

| Phase | Duration | Can Run In Parallel? | Requires Downtime? |
|-------|----------|----------------------|---------------------|
| Phase 1: Server DB Consolidation | 30 min | No | No (Blue keeps running) |
| Phase 2: Symlink Creation | 15 min | No | No (offline test first) |
| Phase 3: Blue Restart | 10 min | No | Yes (~30s) |
| Phase 4: Local Dev Sync | 30 min | Yes (independent) | No |
| Phase 5: Green Optional Setup | 20 min | Yes (independent) | No (Green off) |
| Phase 6: Workflow Updates | 20 min | Yes (independent) | No |
| Phase 7: Documentation | 20 min | Yes (independent) | No |
| **TOTAL (Sequential)** | **2h 25min** | - | **30 seconds** |
| **TOTAL (Optimized)** | **1h 15min** | Phases 4-7 parallel | **30 seconds** |

### 7.2 Recommended Schedule

**Option 1: Sequential (Safer, Easier)**
- Day 1 Evening: Phases 1-3 (Server changes, ~1h, 30s downtime)
- Day 2 Morning: Phases 4-7 (Local & Docs, ~1h, no downtime)

**Option 2: Optimized (Faster, Requires Focus)**
- Single session: All phases (1h 15min, 30s downtime)
- Best done during low-traffic hours (e.g., Sunday evening)

**Recommendation:** Option 1 (split across 2 sessions) for maximum safety

---

## 8. Post-Migration Monitoring

### 8.1 First 24 Hours

**Monitor:**
- [ ] PM2 status every 2 hours: `ssh ubuntu@129.159.8.19 "pm2 status"`
- [ ] Health check every hour: `curl http://129.159.8.19:3000/api/health`
- [ ] Error logs: `ssh ubuntu@129.159.8.19 "pm2 logs timetracking-server --err --lines 50"`
- [ ] Desktop App usage: Check for user-reported issues

**Metrics to Track:**
- API response times (should be <200ms p95)
- PM2 restart count (should be 0)
- Database size (should grow normally)
- Deployment time (next deployment should be <10 min)

### 8.2 First Week

**Validate:**
- [ ] Run at least 2 successful deployments (<10 min each)
- [ ] Test local dev DB sync (3+ times, verify no xattr issues)
- [ ] Optional: Test Green Server on-demand (if critical change needed)
- [ ] Verify automated backups in `/home/ubuntu/databases/backups/`

**Team Feedback:**
- [ ] Does the new workflow feel simpler?
- [ ] Any confusion about new structure?
- [ ] Documentation gaps identified?

---

## 9. Alternative Approaches Considered

### 9.1 Option A: Keep 3-Tier, Fix Issues (Rejected)

**Approach:** Keep Blue-Green-Dev, just fix PORT/ENV issues

**Pros:**
- Least disruptive
- No DB structure changes

**Cons:**
- ❌ Doesn't address root cause (complexity)
- ❌ Still 3 servers to maintain
- ❌ Still manual DB sync needed
- ❌ Doesn't save deployment time

**Verdict:** Rejected - Fixing symptoms, not root cause

---

### 9.2 Option B: Full 1-Tier (Development Only, No Server) (Rejected)

**Approach:** Remove both Blue and Green, local development only

**Pros:**
- Simplest possible setup
- No server maintenance

**Cons:**
- ❌ No real user testing before release
- ❌ No production monitoring
- ❌ Can't offer hosted service
- ❌ Not viable for multi-user app

**Verdict:** Rejected - Not feasible for production app

---

### 9.3 Option C: Hybrid 2-Tier (Selected!)

**Approach:** Development → Production (Blue), Green optional on-demand

**Pros:**
- ✅ 80% complexity reduction
- ✅ Fast deployments (5-10 min)
- ✅ Local testing with prod-like data
- ✅ Safety net available when needed
- ✅ Clear, documented structure

**Cons:**
- ⚠️ Slightly more risk than 3-Tier (mitigated by good local testing)
- ⚠️ One-time migration effort (~2h)

**Verdict:** Selected - Best balance of simplicity and safety

---

### 9.4 Option D: Docker + Kubernetes (Rejected)

**Approach:** Containerize everything, orchestrate with K8s

**Pros:**
- Industry standard
- Infinite scalability

**Cons:**
- ❌ Massive complexity increase
- ❌ Requires DevOps expertise
- ❌ Doesn't fit Oracle Cloud Free Tier
- ❌ Overkill for small app (< 200 users)

**Verdict:** Rejected - Over-engineering for our scale

---

## 10. Conclusion & Next Steps

### 10.1 Summary

**What We're Solving:**
- ✅ 2h deployment times → 5-10 min
- ✅ Chaotic DB structure → Clear, documented layout
- ✅ Constant Green Server crashes → Optional, only when needed
- ✅ Manual DB sync → Automated sync script
- ✅ macOS xattr issues → Automated cleanup

**What We're Keeping:**
- ✅ Production stability (Blue unchanged until Phase 3)
- ✅ Safety net (Green available on-demand)
- ✅ Data integrity (multiple backups, validation checks)

**Investment vs ROI:**
- One-time: 1-2h migration effort
- Ongoing savings: 2h per deployment → 5-10 min
- Break-even: After 1-2 deployments
- Long-term: 10+ hours saved per month

### 10.2 Decision Point

**Ready to proceed?**

<function_calls>
<invoke name="AskUserQuestion">
<parameter name="questions">[{"question": "Wie m\u00f6chtest du mit dem DB-Refactoring weitermachen?", "header": "Next Steps", "multiSelect": false, "options": [{"label": "Start Migration Now", "description": "Begin Phase 1 immediately. We'll migrate step-by-step with validation at each phase. Est. 1-2h total."}, {"label": "Schedule for Later", "description": "Plan approved, but schedule migration for specific date/time (e.g., Sunday evening low-traffic window)."}, {"label": "Revise Plan First", "description": "Plan needs adjustments. Let's discuss specific concerns or alternative approaches."}, {"label": "Test on Local First", "description": "Try Phases 4-7 (local changes) first, then decide on server migration (Phases 1-3)."}]}]