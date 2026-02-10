# Environment Variables - Complete Guide

**3-Tier Environment Configuration System for TimeTracking**

**Updated:** 2026-02-10 - Professional Development Workflow

## 🎯 3-Tier Environment Overview

```
Development (Local)  →  Staging (Green:3001)  →  Production (Blue:3000)
  development.db          staging.db (prod copy)    production.db
  Small dataset           Real production data       Live customer data
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

```bash
# Development (localhost:3000 - small dataset)
cd desktop
npm run dev                      # Uses .env.development (default)
# OR explicitly:
VITE_ENV=development npm run dev

# Staging (Green Server:3001 - real production data)
VITE_ENV=staging npm run dev

# Production (Blue Server:3000 - live customer data)
VITE_ENV=production npm run dev

# Manual switching (alternative):
cp .env.staging .env && npm run dev
```

### 2. Server Development

```bash
# Local development server
cd server
npm run dev                      # Uses .env.development automatically
# Runs on localhost:3000 with development.db
```

### 3. Production Server Setup (Oracle Cloud)

**Production (Blue Server - Port 3000):**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean/server

# Environment managed by PM2:
NODE_ENV=production
PORT=3000
TZ=Europe/Berlin
DATABASE_PATH=/home/ubuntu/database-production.db
SESSION_SECRET=<secure-random>
```

**Staging (Green Server - Port 3001):**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Staging/server

# Environment managed by PM2:
NODE_ENV=staging
PORT=3001
TZ=Europe/Berlin
DATABASE_PATH=/home/ubuntu/database-staging.db
SESSION_SECRET=<secure-random>
```

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

PROD_DB_PATH=/home/ubuntu/TimeTracking-Clean/server/database.db
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
