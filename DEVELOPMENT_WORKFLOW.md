# Development Workflow Guide

**TimeTracking 3-Tier Development System**

**Version:** 2.0
**Last Updated:** 2026-02-11
**Status:** Production-Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Strategy: Code vs. Data Flow](#database-strategy-code-vs-data-flow)
3. [Daily Development Workflow](#daily-development-workflow)
4. [Database Sync Commands](#database-sync-commands)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## 🎯 Overview

### 3-Tier Architecture

```
Development (Local)  →  Staging (Green Server)  →  Production (Blue Server)
  localhost:3000          129.159.8.19:3001         129.159.8.19:3000
  development.db          staging.db                production.db
  Test Data               Production Snapshot       Live Customer Data
```

### Key Principles

1. **Code flows forward:** Development → Staging → Production
2. **Data flows backward:** Production → Staging → Development
3. **Never mix directions:** Code and Data are separate flows!

---

## 🗄️ Database Strategy: Code vs. Data Flow

### ⚠️ CRITICAL: Code-Flow vs. Daten-Flow

#### **Daten-Flow (nur Database, KEIN Code!)**

```
Blue Server (Production)  →  Green Server (Staging)  →  Development (Local)
  492KB echte Kundendaten      492KB Prod-Kopie            Kleinere Test-Version
  production.db                staging.db                  development.db
  (NIEMALS ändern!)            (/sync-green)               (/sync-dev - planned)

  Richtung: Production → Development (COPY only!)
  Zweck: Testing mit realistischen Daten
```

#### **Code-Flow (nur Code, KEINE Daten!)**

```
Development (local)  →  Staging Branch  →  Main Branch
      ↓                      ↓                   ↓
localhost:3000        Green Server:3001   Blue Server:3000
development.db        staging.db          production.db
(Test-Daten!)         (Prod-Kopie!)       (LIVE Kunden!)

  Richtung: Development → Production (DEPLOY only!)
  Zweck: Code & Migrations deployen, Datenbank-Struktur bleibt erhalten!
```

### ⚠️ WARNINGS

- ❌ **NIEMALS** development.db Daten zu Green/Blue Server übertragen!
- ❌ **NIEMALS** production.db Daten überschreiben!
- ✅ **NUR** Code (Features, Bugfixes) wird deployed!
- ✅ **NUR** Migrations (Database-Schema) wird deployed, NICHT Daten!
- ✅ Daten fließen **NUR** von Production → Development (für Tests)!

**Warum diese Trennung:**
- Development.db hat **Test-User & Test-Daten** (nicht echt!)
- Production.db hat **echte Kundendaten** (DSGVO-geschützt!)
- Wenn du Code deployest: Database bleibt auf Server, nur Schema ändert sich!

---

## 🚀 Daily Development Workflow

### Step 1: Setup & Branch erstellen

```bash
# Pull latest code
cd ~/Desktop/TimeTracking-Clean
git checkout staging
git pull origin staging
git checkout -b feature/my-new-feature
```

### Step 2: Lokal entwickeln

```bash
# Start local server
cd server
npm run dev  # Runs on localhost:3000 mit development.db

# Start Desktop App
cd desktop
/dev              # Slash command: Switch to localhost:3000
npm run dev       # Desktop App on localhost:1420
```

**Was du jetzt hast:**
- ✅ Localhost Server mit development.db (kleine Testdaten)
- ✅ Desktop App connected to localhost
- ✅ Schnelle Entwicklung & Testing

### Step 3: Code schreiben & committen

```bash
# Make changes...

# Commit
git add .
git commit -m "feat: Implement new feature

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Push zu Staging Branch

```bash
# Merge to staging
git checkout staging
git merge feature/my-new-feature
git push origin staging
```

**Was passiert:**
- ✅ GitHub Actions deployed automatisch zu Green Server (Port 3001)
- ✅ Migrations laufen automatisch
- ✅ PM2 restartet `timetracking-staging`
- ✅ Health check verifiziert Deployment
- ⏱️ Dauer: ~2-3 Minuten

### Step 5: Testen auf Green Server

```bash
# Desktop App → Green Server
cd desktop
/green            # Slash command: Switch to Green Server:3001
npm run dev       # Restart Desktop App

# Jetzt testest du mit ECHTEN Production-Daten! (staging.db snapshot)
```

**Wichtig:** Green Server hat:
- ✅ Gleiches Schema wie Production
- ✅ Echte Production-Daten (snapshot)
- ✅ Isoliert von Production (keine Kundenauswirkung)

### Step 6: Deploy zu Production

```bash
# Wenn alle Tests auf Green Server OK:
git checkout main
git merge staging
git push origin main
```

**Was passiert:**
- ✅ GitHub Actions deployed automatisch zu Blue Server (Port 3000)
- ✅ Database Backup wird erstellt
- ✅ Migrations laufen automatisch
- ✅ PM2 restartet `timetracking-server`
- ✅ Health check verifiziert Deployment
- ⏱️ Dauer: ~2-3 Minuten, ~30s Downtime

### Step 7: Verify Production

```bash
# Health check
curl http://129.159.8.19:3000/api/health

# Monitor logs
ssh ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 50'
```

---

## 💾 Database Sync Commands

### `/sync-green` - Production → Staging

**Wann nutzen:**
- Vor Testing von Migrations auf Green Server
- Wenn du frische Production-Daten brauchst
- Nach signifikanten Production-Datenänderungen

**Was es tut:**
1. SSH to Oracle Cloud
2. Backup staging.db → `database-staging.backup.TIMESTAMP.db`
3. Copy production.db → staging.db
4. Restart Green Server
5. Verify health

**Usage:**
```bash
/sync-green
```

⚠️ **WARNING:** Überschreibt staging.db komplett!

### `/sync-dev` - Staging → Development (Planned)

**Wann nutzen:**
- Vor Start von Development mit Schema-Änderungen
- Wenn development.db veraltet ist (Schema-Mismatch)
- Um mit realistischen Daten lokal zu testen

**Manual Workaround** (bis implementiert):
```bash
scp ubuntu@129.159.8.19:/home/ubuntu/database-staging.db server/database/development.db
```

⚠️ **WARNING:** Überschreibt development.db komplett!

---

## 🔧 Troubleshooting

### Problem: Desktop App connects to wrong server

**Symptom:** Desktop App zeigt falsche Daten trotz `/dev` oder `/green`

**Diagnosis:**
```bash
printenv | grep VITE_API_URL
# Wenn output → Shell variable override!
```

**Solution:**
```bash
unset VITE_API_URL
/dev  # oder /green
cd desktop && npm run dev
```

---

### Problem: "no such column" error

**Symptom:** 500 errors, logs zeigen "no such column: X"

**Root Cause:** Database hat veraltetes Schema (Migrations fehlen)

**Solution:**
```bash
# Green Server:
/sync-green  # Sync Production DB → Staging DB

# Development:
/sync-dev    # Sync Staging DB → Development DB (oder manual scp)
```

---

### Problem: Green Server has old data

**Symptom:** Green Server doesn't have latest production changes

**Root Cause:** staging.db ist stale (nicht kürzlich gesynced)

**Solution:**
```bash
/sync-green  # Manual sync Production → Staging
```

**Note:** Dies ist EXPECTED! Green Server nutzt Snapshot, nicht live data.

---

## ✅ Best Practices

### Git Workflow
- ✅ IMMER feature branches nutzen (`feature/*`)
- ✅ IMMER zu `staging` mergen, testen auf Green Server
- ✅ IMMER `staging` → `main` nach Green verification
- ❌ NIEMALS direkt zu `main` pushen
- ❌ NIEMALS Green Server überspringen

### Database
- ✅ IMMER Migrations auf Green testen (mit echten Daten!)
- ✅ IMMER idempotente Migrations schreiben (`IF NOT EXISTS`)
- ❌ NIEMALS production.db manuell editieren
- ❌ NIEMALS development.db Daten zu Servern pushen

### Testing
- ✅ IMMER lokal testen (development.db) zuerst
- ✅ IMMER auf Green Server testen (echte Daten) vor Production
- ✅ IMMER Health Checks nach Deployment
- ❌ NIEMALS Green Server Testing überspringen

### Environment Switching
- ✅ IMMER `/dev` und `/green` slash commands nutzen
- ❌ NIEMALS `export VITE_API_URL=...` verwenden
- ❌ NIEMALS manual .env editing

---

## 🔗 Quick Reference

| Command | Purpose |
|---------|---------|
| `/dev` | Desktop App → localhost:3000 (Development) |
| `/green` | Desktop App → Green Server:3001 (Staging) |
| `/sync-green` | Sync Production → Staging Database |
| `/sync-dev` (planned) | Sync Staging → Development Database |

---

## 📚 Related Documentation

- **ENV.md** - Environment configuration
- **CLAUDE.md** - AI development guidelines
- **PROJECT_STATUS.md** - Current status
- **WORKFLOW_QUICK_REF.md** - Quick reference cheat sheet

---

**Version:** 2.0
**Last Updated:** 2026-02-11
**Maintained by:** Claude Code AI + Max Fegg
