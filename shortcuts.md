# TimeTracking - Command Reference

**Last Updated:** 2026-02-11
**3-Tier Workflow:** Development → Staging → Production

---

## 🎯 Code vs. Data Flow (KRITISCH!)

**⚠️ Code und Daten fließen in ENTGEGENGESETZTE Richtungen!**

### Code-Flow (Development → Production)
```
Development → Staging Branch → Main Branch
    ↓              ↓                ↓
localhost      Green:3001       Blue:3000
(git push)     (git push)       (git push)

Commands: git commit, git push
```

### Daten-Flow (Production → Development)
```
Blue:3000 → Green:3001 → Development
(Production)  (Staging)    (Local)

Commands: /sync-green, /sync-dev
```

**NIEMALS vermischen:**
- ❌ NIEMALS development.db zu Servern pushen!
- ❌ NIEMALS production.db überschreiben!
- ✅ Code deployen = Nur Schema-Änderungen, keine Daten!
- ✅ Daten syncen = Nur zum Testen, kein Code!

**Siehe auch:** `DEVELOPMENT_WORKFLOW.md` für Details

---

## 🚀 Production Deployment Commands

### Development → Staging → Production Workflow

```bash
# TIER 1: Development (Local)
cd server && npm run dev                # Start local server (localhost:3000)

# TIER 2: Staging (Green Server)
git checkout staging
git add . && git commit -m "feat: ..."
git push origin staging                 # Auto-Deploy zu Green Server (Port 3001)
/green && npm run dev                   # Desktop App → Green Server testen

# OPTIONAL: Production Daten für Tests
/sync-green                             # Kopiert Blue DB → Green DB

# TIER 3: Production (Blue Server)
/promote-to-prod                        # Deploy Staging → Production (SAFE!)
# → Merge staging → main
# → GitHub Actions Build & Deploy
# → Health Check Verification

# EMERGENCY: Production Rollback
/rollback-prod                          # Rollback bei kritischen Bugs
# → Git revert HEAD
# → Auto-Deploy Rollback
# → Optional DB Restore
```

---

## 🔄 Environment Switching (Desktop App)

```bash
/dev        # Desktop App → localhost:3000 (Development)
/green      # Desktop App → Green Server Port 3001 (Staging)

# Nach Command ausführen:
cd desktop && npm run dev
```

**Was passiert:**
- Checks für shell variable overrides
- Updated .env files automatisch
- Kills running Vite server
- Zeigt Verification Steps

---

## 🗄️ Database Commands

```bash
# Production → Staging Sync (DATA only!)
/sync-green                             # Blue DB → Green DB Sync
# → Backup von Green DB erstellt
# → Kopiert Production DB zu Staging
# → Restart Green Server
# → Health Check + Schema Verification

# Staging → Development Sync (DATA only!)
/sync-dev                               # Green DB → Development DB Sync (PLANNED)
# → Backup von development.db erstellt
# → Kopiert Staging DB zu Local
# → Schema Verification
# Manual Workaround: scp ubuntu@129.159.8.19:/home/ubuntu/database-staging.db server/database/development.db

# Manual DB queries (Production - Read Only!)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
sqlite3 /home/ubuntu/database-shared.db "SELECT * FROM users;"
```

---

## 🛠️ Development Shortcuts

```bash
# Server starten
cd server
npm run dev                             # Development server (Port 3000)

# Desktop App starten
cd desktop
npm run dev                             # Desktop App (Port 1420)

# Tests
npm run test:ui                         # Vitest UI
npm run test:run                        # Tests einmal ausführen
npm run test                            # Tests im Watch-Mode
npm run test:coverage                   # Coverage Report

# TypeScript Check
npx tsc --noEmit                        # Type checking ohne Build

# Build
npm run build                           # Production Build
```

---

## 🧪 Overtime Validation

```bash
cd server

# Detaillierte Validation (mit Day-by-Day Breakdown)
npm run validate:overtime:detailed -- --userId=3 --month=2026-01

# Quick Validation (alle Monate)
npm run validate:overtime -- --userId=3

# Unit Tests
npm test -- workingDays
```

---

## 📦 Desktop App Release

```bash
# Pre-Checks (PFLICHT!)
cd desktop
npx tsc --noEmit                        # MUSS ohne Fehler laufen!
git status                              # MUSS clean sein

# Version Bump (3 Files!)
# 1. desktop/package.json            → version: "1.X.Y"
# 2. desktop/src-tauri/Cargo.toml    → version = "1.X.Y"
# 3. desktop/src-tauri/tauri.conf.json → version: "1.X.Y"

# Release erstellen
git add .
git commit -m "chore: Bump version to v1.X.Y"
git push origin main
git tag v1.X.Y && git push origin v1.X.Y
gh release create v1.X.Y --title "Release v1.X.Y" --notes "..."

# Verification (nach 8-12 Min)
gh run list --workflow="release.yml" --limit 1
# Check: *.dmg, *.exe, *.msi, *.AppImage, *.deb vorhanden
# Check: latest.json enthält Windows + macOS + Linux!

# Documentation Updates
# - Update CHANGELOG.md
# - Update PROJECT_STATUS.md
```

---

## 🔧 Production Server Commands

```bash
# Connect to Production
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19

# PM2 Management
pm2 status                              # Status aller Services
pm2 logs timetracking-server --lines 50  # Server Logs (Blue)
pm2 logs timetracking-staging --lines 50 # Server Logs (Green)
pm2 restart timetracking-server         # Restart Blue Server
pm2 restart timetracking-staging        # Restart Green Server

# Health Checks
curl http://localhost:3000/api/health   # Blue Server (Production)
curl http://localhost:3001/api/health   # Green Server (Staging)

# External Health Checks
curl http://129.159.8.19:3000/api/health  # Blue (von außen)
curl http://129.159.8.19:3001/api/health  # Green (von außen)

# Database Backups
ls -lth /home/ubuntu/TimeTracking-Clean/server/database.backup.*.db
ls -lht /home/ubuntu/database-staging.db.backup-*
```

---

## 📊 GitHub Actions

```bash
# Check Deployment Status
gh run list --workflow="deploy-server.yml" --limit 1
gh run list --workflow="deploy-staging.yml" --limit 1

# View Workflow Details
gh run view --branch main               # Production Deployment
gh run view --branch staging            # Staging Deployment

# Manual Trigger
gh workflow run deploy-server.yml       # Trigger Production Deploy
gh workflow run deploy-staging.yml      # Trigger Staging Deploy
```

---

## 📝 Quick Reference

### Command Locations
- **Slash Commands:** `.claude/commands/*.md`
- **Development Guidelines:** `.claude/CLAUDE.md`
- **Workflow Guide:** `DEVELOPMENT_WORKFLOW.md` (v2.0 - 2026-02-11)
- **Quick Cheat Sheet:** `WORKFLOW_QUICK_REF.md` (1-page)
- **Environment Config:** `ENV.md`
- **Architecture:** `ARCHITECTURE.md`

### Important Files
```
server/
├── database.db              → Local Development DB
├── .env.development         → Dev Server Config

desktop/
├── .env.development         → Desktop → localhost:3000
├── .env.staging             → Desktop → Green Server:3001
├── .env.production          → Desktop → Blue Server:3000

.ssh/
└── oracle_server.key        → SSH Key für Production Server

.claude/commands/
├── dev.md                   → /dev command
├── green.md                 → /green command
├── sync-green.md            → /sync-green command (Production → Staging)
├── sync-dev.md              → /sync-dev command (Staging → Development) 🚧 PLANNED
├── promote-to-prod.md       → /promote-to-prod command 🚧 PLANNED
└── rollback-prod.md         → /rollback-prod command 🚧 PLANNED
```

### Servers Overview
```
Blue Server (Production):
- URL: http://129.159.8.19:3000
- Database: /home/ubuntu/database-shared.db (492KB)
- PM2: timetracking-server
- Branch: main

Green Server (Staging):
- URL: http://129.159.8.19:3001
- Database: /home/ubuntu/database-staging.db (492KB)
- PM2: timetracking-staging
- Branch: staging

Local Development:
- URL: http://localhost:3000
- Database: server/database.db
- Branch: feature branches
```

---

## 🚨 Emergency Procedures

### Production is Down
```bash
# 1. Check Health
curl http://129.159.8.19:3000/api/health

# 2. SSH & Check PM2
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
pm2 status

# 3. Check Logs
pm2 logs timetracking-server --lines 100

# 4. Restart if needed
pm2 restart timetracking-server

# 5. If still broken → Rollback
/rollback-prod
```

### Deployment Failed
```bash
# 1. Check GitHub Actions
gh run list --branch main --limit 1
gh run view

# 2. If tests failed → Fix on staging
git checkout staging
# Fix issues
git push origin staging

# 3. Re-deploy when ready
/promote-to-prod
```

### Database Corruption
```bash
# 1. SSH to server
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19

# 2. List backups
ls -lth /home/ubuntu/TimeTracking-Clean/server/database.backup.*.db

# 3. Restore backup
cp /home/ubuntu/TimeTracking-Clean/server/database.backup.YYYYMMDD_HHMMSS.db \
   /home/ubuntu/database-shared.db

# 4. Restart server
pm2 restart timetracking-server

# 5. Verify
curl http://localhost:3000/api/health
```

---

## 📚 Documentation

### Core Documentation (⭐ Start here!)
- **Workflow Guide:** `DEVELOPMENT_WORKFLOW.md` v2.0 (330 lines) - Complete 3-Tier workflow
- **Quick Cheat Sheet:** `WORKFLOW_QUICK_REF.md` (1-page) - Daily commands reference
- **Development Guidelines:** `.claude/CLAUDE.md` (1250+ lines) - AI development rules
- **Environment Setup:** `ENV.md` (619 lines) - Environment configuration

### Technical Documentation
- **Architecture:** `ARCHITECTURE.md` (850 lines) - System design
- **Specifications:** `PROJECT_SPEC.md` (1500 lines) - API & Requirements
- **Project Status:** `PROJECT_STATUS.md` (400 lines) - Current sprint & health
- **Changelog:** `CHANGELOG.md` (750 lines) - Version history

### Key Concepts
- **Code-Flow:** Development → Staging → Production (git push)
- **Data-Flow:** Production → Staging → Development (database sync)
- **3-Tier Benefits:** Early bug detection, migration safety, zero customer impact

---

**Version:** 2.0 (2026-02-11)
**3-Tier System:** Development → Staging → Production ✅
**Code vs. Data Flow:** CLEARLY SEPARATED ✅
