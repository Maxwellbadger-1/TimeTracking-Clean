# Environment Variables - Complete Guide

**2-Tier Environment Configuration System for TimeTracking**

**Updated:** 2026-04-02 - Updated to 2-Tier Architecture (DB consolidation complete)

## 🎯 2-Tier Environment Overview

```
Development (Local)  →  Production (Blue:3000)
  server/database.db      /home/ubuntu/databases/production.db
  Synced via scp           Live customer data

Local DB setup: npm run sync-dev-db (pulls production DB via SCP)
Green Server (port 3001) is available on-demand but not part of the standard flow.
```

## 📂 File Structure (Updated 2026-02-10)

```
server/
├── .env.development         # Local development config
└── .env.production          # Production server config (not in repo)

desktop/
├── .env.development         # Desktop → localhost:3000
├── .env.staging             # Desktop → Green Server:3001
├── .env.production          # Desktop → Blue Server:3000
└── .env                     # Active config (gitignored, user switches)

.github/workflows/
├── deploy-server.yml        # Production deployment (main branch)
└── deploy-staging.yml       # Staging deployment (staging branch)
```

**Key Changes (2026-02-10):**
- ❌ No more single central `.env` file
- ✅ Separate configs per environment (development, staging, production)
- ✅ Desktop App can switch environments via `VITE_ENV` variable
- ✅ Server configs managed per deployment target

---

## 🚀 Quick Start

### 1. Desktop App - Environment Switching

**RECOMMENDED: Use Slash Commands (Automated Setup)**
```bash
cd desktop

# Development (localhost:3000 - small dataset)
/dev && npm run dev              # Slash command (checks for shell variable!)

# Staging (Green Server:3001 - real production data)
/green && npm run dev            # Slash command (tests connectivity!)

# Manual Sync Green DB with Production (when needed)
/sync-green                      # Creates backup, syncs, restarts server
```

**Alternative: Manual .env Management (NOT recommended)**
```bash
# Development
npm run dev                      # Uses .env.development (default)

# Staging (Green Server)
cp .env.staging .env && npm run dev

# ⚠️ WARNING: This approach is error-prone!
# Shell environment variables can override .env files!
# Use slash commands instead.
```

**Why Slash Commands?**
- ✅ Automatic check for shell variable overrides (prevents common bug!)
- ✅ Connectivity test (Green Server health check)
- ✅ Consistent setup (no manual .env editing)
- ✅ Documented in slash command files (`.claude/commands/`)

**Recent Improvements (2026-02-11):**
- `/green` command now includes mandatory shell variable check (exits with error if `VITE_API_URL` is set)
- `/dev` command also checks for shell variables before switching
- Both commands now test server connectivity before completing

**See also:** `.claude/commands/dev.md`, `.claude/commands/green.md`, `.claude/commands/sync-green.md`

### 2. Local DB Setup (Standard)

```bash
# Pull production DB for local development (Windows Git Bash compatible)
npm run sync-dev-db

# What it does:
# 1. Backs up existing server/database.db (timestamped)
# 2. SCPs production.db from /home/ubuntu/databases/production.db
# 3. Runs PRAGMA integrity_check
# 4. Prints user count and latest time entry date
```

### 3. Server Development

```bash
# Local development server
cd server
npm run dev                      # Uses .env.development automatically
# Runs on localhost:3000 with server/database.db
```

### 4. Production Server Setup (Oracle Cloud)

**Production (Blue Server - Port 3000):**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean/server

# Environment managed by PM2 ecosystem file:
NODE_ENV=production
PORT=3000
TZ=Europe/Berlin
DATABASE_PATH=/home/ubuntu/databases/production.db
SESSION_SECRET=<secure-random>
```

**Staging (Green Server - Port 3001, ON-DEMAND ONLY):**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Green/server

# Environment managed by PM2 (CRITICAL: Set as PREFIX, not via .env!)
NODE_ENV=staging
PORT=3001
TZ=Europe/Berlin
DATABASE_PATH=/home/ubuntu/databases/production.db  # Green uses COPY of production data, synced via /sync-green
SESSION_SECRET=<secure-random>
```

**⚠️ Green Server Critical Notes:**

> **UPDATE (2026-04-02):** The PORT=3001 fix has been applied in deploy-staging.yml. PORT is now passed as a shell prefix to pm2 start. Green Server is available on-demand but is NOT part of the standard 2-Tier development flow.

1. **DATABASE_PATH is REQUIRED:**
   - Code does NOT auto-load .env files (no `import 'dotenv/config'`)
   - `getDatabasePath()` checks `NODE_ENV` but `staging` ≠ `production`
   - Without explicit `DATABASE_PATH`: Server loads `development.db` ❌
   - Result: 500 Errors "no such column: position" (old DB without migrations)

2. **Environment Variables MUST be PREFIX to PM2 command:**
   ```bash
   # ✅ CORRECT (works):
   TZ=Europe/Berlin NODE_ENV=staging DATABASE_PATH=/home/ubuntu/database-staging.db PORT=3001 \
     pm2 start dist/server.js --name timetracking-staging --time --update-env

   # ❌ WRONG (doesn't work):
   pm2 start dist/server.js --env staging  # Ignores .env files!
   ```

3. **Complete PM2 Start Template:**
   ```bash
   # Extract SESSION_SECRET from .env
   SESSION_SECRET=$(grep '^SESSION_SECRET=' .env | cut -d= -f2)

   # Start with ALL env vars as prefix
   TZ=Europe/Berlin \
   NODE_ENV=staging \
   DATABASE_PATH=/home/ubuntu/database-staging.db \
   PORT=3001 \
   SESSION_SECRET=$SESSION_SECRET \
     pm2 start dist/server.js \
     --name timetracking-staging \
     --cwd /home/ubuntu/TimeTracking-Staging/server \
     --time \
     --update-env

   pm2 save
   ```

4. **Troubleshooting Checklist:**
   ```bash
   # ☐ PM2 Status = "online" (not "errored")
   pm2 list

   # ☐ Correct Database loaded
   PM2_PID=$(pgrep -f 'timetracking-staging' | head -1)
   lsof -p $PM2_PID | grep '.db'
   # Expected: /home/ubuntu/database-staging.db (NOT development.db!)

   # ☐ Environment Variables set
   pm2 env <ID> | grep -E '(DATABASE_PATH|NODE_ENV|PORT)'
   # Expected: DATABASE_PATH=/home/ubuntu/database-staging.db

   # ☐ Logs show correct environment
   pm2 logs timetracking-staging --lines 20
   # Expected: "env":"staging", "Listening on http://0.0.0.0:3001"

   # ☐ Health Check passes
   curl http://localhost:3001/api/health
   # Expected: {"status":"ok", ...}
   ```

5. **Common Issues & Fixes:**
   - **500 Errors:** Wrong DB loaded → Set `DATABASE_PATH` explicitly
   - **Port Conflict (EADDRINUSE):** Server tries 3000 → Set `PORT=3001`
   - **Crash Loop:** Check `pm2 logs timetracking-staging --err --lines 100`

**See also:**
- CLAUDE.md → Section "Green Server (Staging) Deployment & Troubleshooting"
- ARCHITECTURE.md → Section 7.3 "Green Server (Staging) Architecture"
- `.claude/commands/green.md` - Desktop App switch to Green Server
- `.claude/commands/sync-green.md` - Sync Blue DB → Green DB

---

## 🔑 Configuration Sections

### 1. GitHub Credentials

**Purpose:** Automate releases, access GitHub API, use `gh` CLI

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=Maxwellbadger-1/TimeTracking-Clean
GITHUB_USER=Maxwellbadger-1
```

**How to create token:**
1. Go to https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` (full repository access)
   - ✅ `workflow` (update GitHub Actions)
   - ✅ `read:org` (read organization data)
4. Generate & copy token
5. Paste into `.env`

**Used by:**
- `gh` CLI commands
- GitHub Actions (via secrets)
- Release automation scripts

---

### 2. Server Configuration

```bash
PORT=3000                    # Server port
NODE_ENV=development         # development | production
SESSION_SECRET=xxxxx         # Cookie encryption (32+ chars)
ALLOWED_ORIGINS=tauri://localhost,https://tauri.localhost
DATABASE_PATH=./database.db
LOG_LEVEL=debug             # debug | info | warn | error
```

**SESSION_SECRET:**
- **CRITICAL for security!**
- Must be different in dev vs prod
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Production: 64+ characters recommended

**Used by:**
- `server/src/server.ts`
- All Express middleware
- Session management

---

### 3. Frontend Configuration

```bash
# Development (localhost)
VITE_API_URL=http://localhost:3000/api

# Production (Oracle Cloud)
VITE_API_URL_PRODUCTION=http://129.159.8.19:3000/api
```

**How it works:**
- Vite reads `VITE_*` variables at build time
- Development: Uses `VITE_API_URL`
- Production Build: Uses `VITE_API_URL_PRODUCTION`

**Override for local testing:**
```bash
# Create .env.local (highest priority)
VITE_API_URL=http://192.168.1.100:3000/api
```

**Used by:**
- Desktop app (Tauri)
- `desktop/src/api/client.ts`
- All API calls

---

### 4. SSH / Production Server

```bash
SSH_HOST=129.159.8.19
SSH_USER=ubuntu
SSH_PORT=22
SSH_KEY_PATH=.ssh/oracle_server.key

PROD_DB_PATH=/home/ubuntu/databases/production.db
PROD_SERVER_PATH=/home/ubuntu/TimeTracking-Clean/server
PM2_SERVICE_NAME=timetracking-server
PROD_API_URL=http://129.159.8.19:3000
```

**Used by:**
- `scripts/production/deploy.sh`
- `scripts/production/connect.sh`
- `scripts/production/backup-db.sh`
- `scripts/production/query-db*.sh`
- `scripts/database/sync-prod.sh`

**SSH Key Setup:**
```bash
# Keys should be in .ssh/ directory
ls -la .ssh/oracle_server.key*

# Correct permissions
chmod 600 .ssh/oracle_server.key
chmod 644 .ssh/oracle_server.key.pub
```

---

### 5. Backup Configuration

```bash
BACKUP_SCHEDULE=0 2 * * *       # Cron: Daily at 2 AM
BACKUP_RETENTION_DAYS=30        # Delete backups older than 30 days
BACKUP_DIR=./backups

# GFS Rotation (Grandfather-Father-Son)
BACKUP_DAILY_RETENTION=7        # Keep 7 daily backups
BACKUP_WEEKLY_RETENTION=4       # Keep 4 weekly backups
BACKUP_MONTHLY_RETENTION=12     # Keep 12 monthly backups
```

**Used by:**
- `scripts/database/backup.sh`
- `scripts/database/setup-cron.sh`
- Automated backup cronjobs

---

### 6. Optional Services

**Email Notifications (Future):**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=your-app-password
SMTP_FROM=TimeTracking <noreply@example.com>
NOTIFICATION_EMAILS=admin@example.com,manager@example.com
```

**Holidays API (Optional):**
```bash
HOLIDAYS_API_KEY=your-api-key-here
HOLIDAYS_API_URL=https://api.example.com/holidays
```

**Monitoring (Future):**
```bash
SENTRY_DSN=https://xxx@sentry.io/project-id
ANALYTICS_TOKEN=UA-XXXXXXXXX-X
```

---

## 🔒 Security Best Practices

### DO ✅

1. **Use strong SESSION_SECRET**
   ```bash
   # Generate secure random string
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Different secrets per environment**
   ```bash
   # Development
   SESSION_SECRET=dev_secret_xxxxx

   # Production
   SESSION_SECRET=prod_secret_yyyyy_much_longer_and_more_secure
   ```

3. **Backup .env file** (encrypted!)
   ```bash
   # Store in password manager or encrypted vault
   # NOT in cloud storage unencrypted!
   ```

4. **Rotate secrets regularly**
   ```bash
   # Update SESSION_SECRET every 90 days
   # Update GITHUB_TOKEN when compromised
   ```

### DON'T ❌

1. **NEVER commit .env to git**
   ```bash
   # Already in .gitignore, but double-check:
   git status --ignored | grep ".env"
   ```

2. **NEVER share .env file**
   - No Slack/Email
   - No screenshots
   - No pastebin/gist

3. **NEVER use weak secrets**
   ```bash
   # BAD:
   SESSION_SECRET=mysecret

   # GOOD:
   SESSION_SECRET=7f8e9a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f
   ```

---

## 📝 File Priority (Override Order)

When multiple `.env` files exist, this is the loading order:

```
1. .env.local           (Highest priority - local overrides)
2. .env.production      (Production-specific)
3. .env                 (Main config)
4. .env.example         (Template only, not loaded)
```

**Example:**
```bash
# .env
VITE_API_URL=http://localhost:3000/api

# .env.local (overrides .env)
VITE_API_URL=http://192.168.1.100:3000/api

# Result: Uses 192.168.1.100
```

---

## 🛠️ Troubleshooting

### Problem: Server can't find SESSION_SECRET

```bash
# Check if .env exists
ls -la .env

# Check if server/.env symlink exists
ls -la server/.env

# Should show: server/.env -> ../.env

# If missing, recreate symlink:
cd server
ln -sf ../.env .env
```

---

### Problem: Scripts can't connect to production

```bash
# Check SSH config
cat .env | grep SSH_

# Test SSH connection
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "echo Success"

# Check SSH key permissions
ls -la .ssh/oracle_server.key
# Should show: -rw------- (600)

# Fix if wrong:
chmod 600 .ssh/oracle_server.key
```

---

### Problem: Desktop app can't reach API

```bash
# Check API URL in .env
cat .env | grep VITE_API_URL

# For development, should be:
VITE_API_URL=http://localhost:3000/api

# Test API manually:
curl http://localhost:3000/api/health

# If server not running:
./scripts/dev/start.sh
```

---

### Problem: Desktop app connects to wrong server (shell variable override)

**Symptom:** Desktop App connects to wrong API server despite correct .env files

**Root Cause:** Shell environment variable `VITE_API_URL` overrides ALL .env files!

**Vite's Priority (Highest → Lowest):**
```
Shell environment variables  (HIGHEST - overrides everything!)
  ↓
.env.[mode].local
  ↓
.env.[mode]
  ↓
.env.local
  ↓
.env  (LOWEST)
```

**Diagnosis:**
```bash
# Check for shell environment variable:
printenv | grep VITE_API_URL

# If output shows anything → That's the problem!
# Example problematic output:
# VITE_API_URL=http://localhost:3000/api
```

**Solution (AUTOMATIC - v2.5+):**

The `/dev` and `/restart-dev` commands now **automatically detect and clear** this variable!

```bash
# Just run the command - it handles everything:
/dev           # Auto-clears VITE_API_URL if set, then starts dev environment
/restart-dev   # Auto-clears VITE_API_URL if set, then restarts

# You'll see:
# ⚠️  WARNING: Shell variable VITE_API_URL detected!
#    Current value: http://localhost:3000/api
#    → Automatically clearing...
#    ✅ Cleared! Continuing...
```

**Manual Solution (if needed):**
```bash
# Option 1: Use utility command
/clean-env     # Diagnostic + cleanup

# Option 2: Manual unset (old way)
unset VITE_API_URL
printenv | grep VITE_API_URL  # Verify it's gone
```

**Prevention:**
- ❌ **NEVER** use: `export VITE_API_URL=...`
- ✅ **ALWAYS** use: `/dev` or `/green` slash commands
- ✅ **OR** manually edit `.env.development` file

**How it happened:**
- Previous manual `export VITE_API_URL=...` command
- Persists across terminal sessions (depending on shell config)
- Overrides all .env files due to Vite's priority system

---

### Problem: GitHub CLI not authenticated

```bash
# Check token in .env
cat .env | grep GITHUB_TOKEN

# Test gh CLI
gh auth status

# If invalid, re-login:
gh auth login
# Choose: "Paste an authentication token"
# Paste token from .env
```

---

## 📦 Deployment

### Development → Production

When deploying, make sure production server has:

```bash
# On production server (/home/ubuntu/TimeTracking-Clean/server/.env)
NODE_ENV=production
SESSION_SECRET=<different-from-dev>
LOG_LEVEL=warn
DISABLE_AUTH=false
```

**Deploy process** (automated via GitHub Actions):
1. Push to `main` branch
2. GitHub Actions builds & deploys
3. Server reads production `.env`
4. PM2 restarts with new config

**Manual deploy:**
```bash
./scripts/production/deploy.sh
```

---

## 🔗 Related Files

- **`.gitignore`** - Ensures `.env*` files never get committed
- **`.env.ssh`** - Separate SSH config (optional, can merge into `.env`)
- **`scripts/README.md`** - Script usage documentation
- **`CLAUDE.md`** - Development guidelines

---

## 📞 Need Help?

**Common Issues:**
1. Server won't start → Check `SESSION_SECRET`
2. Can't connect to production → Check SSH keys & permissions
3. API calls fail → Check `VITE_API_URL`
4. Scripts fail → Check `GITHUB_TOKEN`

**Quick Diagnostic:**
```bash
# Check all critical variables
cat .env | grep -E "(GITHUB_TOKEN|SESSION_SECRET|SSH_HOST|VITE_API_URL)"

# Should show all 4 variables with values
```

---

**Last Updated:** 2025-01-15
