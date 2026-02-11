# TimeTracking - Command Reference

**Last Updated:** 2026-02-11
**3-Tier Workflow:** Development → Staging → Production

---

 Du kannst jetzt sagen:

  1. "Wechseln wir auf den PC" → Ich mache automatisch alles für Windows Setup/Workflow
  2. "Zurück auf Mac" → Ich kümmere mich um den Rückwechsel
  3. "/cleanup" → Ich räume Speicherplatz auf (6.8 GB frei!)

  Alles ist dokumentiert, getestet und Production-Ready! 

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
/dev        # Full Stack: Startet Server + Desktop App (localhost:3000)
            # → Automatisch: Port 3000 freigeben, Server starten, Health Check, Desktop App starten
/green      # Desktop App → Green Server Port 3001 (Staging)

# /dev macht ALLES automatisch - kein npm run dev nötig!
```

**Was /dev macht:**
- ✅ Checks für shell variable overrides
- ✅ Freed port 3000 (kills old server)
- ✅ Starts Development Server (background)
- ✅ Waits for health check (30s timeout)
- ✅ Updates .env files
- ✅ Kills old Vite server
- ✅ Starts Desktop App (background)

**Was /green macht:**
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

## 💾 Git Workflow & Speicherplatz-Management

### Mac ↔ Windows Workflow (Modern & Professional)

**Problem gelöst:** Projekte werden RIESIG (7+ GB) durch Build-Artifacts!
**Lösung:** Git-basierter Workflow → NUR Source Code synchronisieren

#### Daily Workflow

```bash
# ════════════════════════════════════════
# AUF MAC (Ende Arbeitstag)
# ════════════════════════════════════════
git add .
git commit -m "feat: Implemented feature XYZ"
git push origin main
# → Dauer: ~10 Sekunden
# → Größe: Nur Änderungen (meist < 1 MB)

# ════════════════════════════════════════
# AUF WINDOWS PC (Start Arbeitstag)
# ════════════════════════════════════════
git pull origin main
# → Dauer: ~5 Sekunden
# → Lädt nur Änderungen!

# Falls package.json geändert wurde:
npm install  # Aktualisiert Dependencies
```

#### Erstmaliges Windows PC Setup

```bash
# 1. Projekt clonen (lädt NUR Source Code, ~90 MB!)
cd C:\Projects
git clone https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
cd TimeTracking-Clean

# 2. Dependencies installieren
npm install                  # Root
cd desktop && npm install    # Desktop App
cd ../server && npm install  # Server

# 3. Entwicklung starten
cd server && npm run dev     # Server (localhost:3000)
cd desktop && npm run dev    # Desktop App (baut Tauri target/, 5-10 Min beim ersten Mal)
```

### Speicherplatz-Optimierung (Bei Bedarf)

**Symptom:** Projekt ist > 2 GB? Wahrscheinlich Build-Artifacts!

```bash
# 1. Check Projektgröße
du -sh .

# 2. Finde große Ordner
du -sh ./* | sort -hr | head -10

# 3. Cleanup (SICHER - ist in .gitignore)
rm -rf desktop/src-tauri/target     # Rust Build-Cache (~6-8 GB!)
rm -rf node_modules                  # Node Dependencies (~500 MB)
rm -rf desktop/node_modules
rm -rf server/node_modules
rm -rf dist/                         # Build Output
rm -rf build/
rm -rf .next/                        # Next.js Cache (falls vorhanden)

# 4. Dependencies neu installieren (wenn du weiterarbeiten willst)
npm install
cd desktop && npm install
cd ../server && npm install

# 5. Verify
du -sh .  # Sollte ~100-500 MB sein (statt 5-8 GB!)
```

### Was wird NICHT synchronisiert? (in .gitignore)

Diese Ordner sind **LOKAL** und werden automatisch neu gebaut:
- ✅ `node_modules/` - NPM Dependencies (~500 MB)
- ✅ `desktop/src-tauri/target/` - Rust Build-Cache (~6-8 GB!)
- ✅ `dist/`, `build/` - Build Output
- ✅ `.env.local` - Lokale Secrets
- ❌ `server/database.db` - **IST in Git** (für Sync zwischen Systemen)

### Beste Praktiken

#### ✅ DO's
- Push **täglich** zu GitHub → Automatisches Backup!
- Lösche `target/` & `node_modules/` **regelmäßig** (monatlich)
- Nutze `.gitignore` für große Binärdateien
- Clone Projekt **neu** statt kopieren (zwischen Mac & Windows)

#### ❌ DON'Ts
- **NIEMALS** `node_modules/` oder `target/` manuell kopieren!
- **NIEMALS** komplettes Projekt auf Festplatte kopieren (nutze Git!)
- **NIEMALS** große Binärdateien zu Git hinzufügen (Videos, große DBs > 10 MB)
- **NIEMALS** `.env` Secrets committen

### Troubleshooting

**Problem:** Projekt zu groß auf Mac?
```bash
# Lösung: Cleanup (siehe oben)
rm -rf desktop/src-tauri/target node_modules desktop/node_modules server/node_modules
# Ergebnis: 7.3 GB → 100 MB! (98% Ersparnis)
```

**Problem:** Git sagt "Changes not staged"?
```bash
# Diese Dateien sollten in .gitignore sein:
git check-ignore -v desktop/src-tauri/target/
git check-ignore -v node_modules/
# Falls NICHT in .gitignore → zu .gitignore hinzufügen!
```

**Problem:** Zu viel Disk Space auf beiden Systemen?
```bash
# Strategie: Immer nur auf EINEM System voll gebaut
# Mac: Nur Source Code (~100 MB)
# Windows: Full Build mit target/ (~7 GB)
# → Spare 7 GB auf Mac!
```

### Projekt-Größen Übersicht

| Was | Größe | In Git? |
|-----|-------|---------|
| Source Code (ohne Builds) | ~90 MB | ✅ Ja |
| + node_modules | ~500 MB | ❌ Nein |
| + Rust target/ (Tauri) | ~7 GB | ❌ Nein |
| **Gesamt (Full Build)** | **~7.5 GB** | - |
| **Auf GitHub** | **~90 MB** | ✅ |

**Fazit:** Git synchronisiert nur 90 MB, Rest wird lokal gebaut!

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
