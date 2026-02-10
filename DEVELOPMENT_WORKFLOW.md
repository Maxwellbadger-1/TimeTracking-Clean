# Development Workflow - 3-Tier Environment

**Version:** 1.0
**Last Updated:** 2026-02-10
**Status:** ✅ AKTIV

---

## 📋 Overview

Professional 3-tier development workflow für das TimeTracking System:

```
Development (Local)  →  Staging (Green Server)  →  Production (Blue Server)
     localhost:3000         129.159.8.19:3001         129.159.8.19:3000
   development.db             staging.db              production.db
   (Small dataset)      (Production snapshot)        (Live customer data)
```

**Ziel:** Bugs mit echten Production-Daten testen BEVOR sie live gehen!

---

## 🎯 Environment-Übersicht

### 1. Development (Lokal)

**Zweck:** Schnelle Feature-Entwicklung mit kleinem Dataset

```bash
# Server
cd server
npm run dev                    # Startet localhost:3000

# Desktop App
cd desktop
npm run dev                    # Nutzt .env.development (Standard)
# ODER explizit:
VITE_ENV=development npm run dev
```

**Database:** `server/database/development.db`
**Merkmale:**
- ✅ Kleines Test-Dataset (schnell zu resetten)
- ✅ Schnelle Iteration ohne Production-Impact
- ✅ Kann mit `npm run dev:reset` zurückgesetzt werden

**Wann nutzen?**
- Neue Features entwickeln
- UI/UX Experimente
- Schnelle Prototypen

---

### 2. Staging (Green Server)

**Zweck:** Pre-Production Testing mit echten Daten

```bash
# Desktop App
cd desktop
VITE_ENV=staging npm run dev   # Verbindet zu Green Server

# ODER .env switchen:
cp .env.staging .env
npm run dev
```

**Server:** http://129.159.8.19:3001
**Database:** `/home/ubuntu/database-staging.db`
**PM2 Process:** `timetracking-staging`

**Merkmale:**
- ✅ Production-Snapshot (echte Daten, wöchentlich aktualisiert)
- ✅ Separate Server-Instanz (kein Production-Impact)
- ✅ Migrations-Testing vor Production
- ⚠️ KEINE Anonymisierung (wie vom User gewünscht)

**Wann nutzen?**
- Bug-Reproduktion mit echten Daten
- Migration-Testing
- Performance-Tests mit realistischem Dataset
- Finale QA vor Production-Deployment

**Daten-Update:**
- 🔄 Automatisch: Jeden Sonntag 2:00 Uhr (Cron Job)
- 📁 Backup vor Sync: `/home/ubuntu/backups/staging.before-sync.*.db`

---

### 3. Production (Blue Server)

**Zweck:** Live System für Kunden

```bash
# Desktop App (NUR für Testing!)
cd desktop
VITE_ENV=production npm run dev

# ODER .env switchen:
cp .env.production .env
npm run dev
```

**Server:** http://129.159.8.19:3000
**Database:** `/home/ubuntu/database-production.db`
**PM2 Process:** `timetracking-server`

**Merkmale:**
- 🔴 Live customer data
- 🔴 NIEMALS für Entwicklung/Testing nutzen!
- 🔴 Blue Server bleibt UNBERÜHRT während Workflow-Changes

**Wann nutzen?**
- Production Builds erstellen
- Production Issues debuggen (read-only!)
- Health Checks

---

## 🔄 Git Workflow

### Branch Strategy

```
main           → Production (Blue Server, Port 3000)
staging        → Staging (Green Server, Port 3001)
feature/*      → Development (Lokal)
```

### Feature Development Flow

```bash
# 1. Neue Feature-Branch erstellen
git checkout main
git pull origin main
git checkout -b feature/my-new-feature

# 2. Development (Lokal mit development.db)
cd server && npm run dev
cd desktop && npm run dev          # Nutzt localhost:3000

# 3. Feature implementieren
git add .
git commit -m "feat: Implement my new feature"

# 4. Push zu Staging testen
git checkout staging
git merge feature/my-new-feature
git push origin staging

# 5. Desktop App auf Staging testen
cd desktop
VITE_ENV=staging npm run dev       # Nutzt Green Server:3001

# 6. QA auf Staging (echte Daten!)
# - Feature mit echten Production-Daten testen
# - Edge Cases prüfen
# - Performance checken

# 7. Wenn alles OK: Merge zu Main
git checkout main
git merge staging
git push origin main                # Deployment zu Blue Server (Production)

# 8. Production Health Check
curl http://129.159.8.19:3000/api/health
```

---

## 🗄️ Database Migration Workflow

**KRITISCH:** Migrations IMMER erst auf Staging testen!

### Sichere Migration-Durchführung

```bash
# 1. Migration entwickeln (Lokal)
cd server
npm run migrate:create my_migration

# Edit: server/migrations/YYYYMMDDHHMMSS_my_migration.sql

# 2. Lokal testen
npm run migrate                    # Auf development.db

# 3. Staging Branch
git checkout staging
git add migrations/
git commit -m "db: Add my_migration"
git push origin staging

# 4. Staging Deployment wartet ab (GitHub Actions)
gh run watch

# 5. Staging Server prüfen (SSH)
ssh ubuntu@129.159.8.19
cd TimeTracking-Staging/server
sqlite3 ../database-staging.db ".schema"    # Migration angewandt?
pm2 logs timetracking-staging               # Errors?

# 6. Desktop App auf Staging testen
cd desktop
VITE_ENV=staging npm run dev
# Feature testen: Funktioniert Migration mit echten Daten?

# 7. Wenn OK: Production Deployment
git checkout main
git merge staging
git push origin main                # Auto-Deploy zu Blue Server
```

**Warum dieser Workflow?**
- ✅ Migrations werden mit echten Daten getestet (staging.db = production snapshot)
- ✅ Fehler werden BEVOR Production-Deployment gefunden
- ✅ Rollback möglich wenn Staging-Tests fehlschlagen

---

## 🔧 Troubleshooting

### Desktop App verbindet nicht zu Server

**Problem:** "Network error" oder "Failed to fetch"

```bash
# 1. Check welche Umgebung aktiv ist
cd desktop
cat .env | grep VITE_API_URL

# Development: http://localhost:3000/api
# Staging:     http://129.159.8.19:3001/api
# Production:  http://129.159.8.19:3000/api

# 2. Server läuft?
# Development:
curl http://localhost:3000/api/health

# Staging/Production:
curl http://129.159.8.19:3001/api/health    # Staging
curl http://129.159.8.19:3000/api/health    # Production

# 3. Desktop App neu starten mit korrekter Umgebung
npm run dev                         # Development
VITE_ENV=staging npm run dev        # Staging
VITE_ENV=production npm run dev     # Production
```

### Staging DB ist veraltet

**Problem:** Staging hat nicht die aktuellsten Production-Daten

```bash
# Manueller Sync (als ubuntu@129.159.8.19)
ssh ubuntu@129.159.8.19
bash /home/ubuntu/TimeTracking-Staging/server/scripts/sync-prod-to-staging.sh

# Check letzter automatischer Sync
cat /home/ubuntu/logs/db-sync.log | tail -20

# Cron Job Status
crontab -l | grep sync-prod-to-staging
```

### GitHub Actions Deployment failed

**Problem:** Staging oder Production Deployment schlägt fehl

```bash
# 1. Logs anschauen
gh run list --workflow="deploy-staging.yml" --limit 5
gh run view <run-id> --log-failed

# 2. TypeScript Errors lokal prüfen
cd server
npx tsc --noEmit

# 3. Migration Errors?
ssh ubuntu@129.159.8.19
pm2 logs timetracking-staging --lines 100 | grep -i error

# 4. Rollback falls nötig
git revert HEAD
git push origin staging
```

### Server läuft nicht nach Deployment

**Problem:** PM2 Prozess crashed

```bash
ssh ubuntu@129.159.8.19

# 1. Status prüfen
pm2 status

# 2. Logs checken
pm2 logs timetracking-staging       # Staging
pm2 logs timetracking-server        # Production

# 3. Manueller Restart
pm2 restart timetracking-staging
pm2 restart timetracking-server

# 4. Falls immer noch down: Database Permissions?
ls -la /home/ubuntu/database-*.db
# Sollte: -rw-r--r-- ubuntu ubuntu

# 5. Database Backup wiederherstellen (falls korrupt)
ls -la /home/ubuntu/backups/
cp /home/ubuntu/backups/database-staging.backup.*.db /home/ubuntu/database-staging.db
pm2 restart timetracking-staging
```

---

## 📊 Monitoring & Health Checks

### Development (Lokal)

```bash
# Server Health
curl http://localhost:3000/api/health | jq

# Database Check
cd server
sqlite3 database/development.db "SELECT COUNT(*) FROM users;"

# Desktop App Console
# F12 → Console (sollte keine Errors zeigen)
```

### Staging (Green Server)

```bash
# Health Check
curl http://129.159.8.19:3001/api/health | jq

# Server Logs
ssh ubuntu@129.159.8.19
pm2 logs timetracking-staging --lines 50

# Database Size
ssh ubuntu@129.159.8.19
du -h /home/ubuntu/database-staging.db

# Last Sync Timestamp
ssh ubuntu@129.159.8.19
stat /home/ubuntu/database-staging.db | grep Modify
```

### Production (Blue Server)

```bash
# Health Check
curl http://129.159.8.19:3000/api/health | jq

# Server Logs (READ ONLY!)
ssh ubuntu@129.159.8.19
pm2 logs timetracking-server --lines 50

# Database Size
ssh ubuntu@129.159.8.19
du -h /home/ubuntu/database-production.db

# Uptime
ssh ubuntu@129.159.8.19
pm2 info timetracking-server | grep uptime
```

---

## 🚀 Quick Reference

### Desktop App Environment Switching

```bash
# Option 1: Environment Variable (EMPFOHLEN)
npm run dev                         # Development (localhost)
VITE_ENV=staging npm run dev        # Staging (Green:3001)
VITE_ENV=production npm run dev     # Production (Blue:3000)

# Option 2: .env File switching
cp .env.development .env && npm run dev    # Development
cp .env.staging .env && npm run dev        # Staging
cp .env.production .env && npm run dev     # Production
```

### Git Commands

```bash
# Feature Development
git checkout -b feature/xyz
git commit -m "feat: ..."
git push origin feature/xyz

# Deploy to Staging
git checkout staging
git merge feature/xyz
git push origin staging              # Auto-Deploy zu Green Server

# Deploy to Production
git checkout main
git merge staging
git push origin main                 # Auto-Deploy zu Blue Server
```

### SSH Commands

```bash
# Connect
ssh ubuntu@129.159.8.19

# PM2
pm2 status
pm2 logs timetracking-staging
pm2 logs timetracking-server
pm2 restart timetracking-staging
pm2 restart timetracking-server

# Database Sync (manuell)
bash /home/ubuntu/TimeTracking-Staging/server/scripts/sync-prod-to-staging.sh

# Logs
tail -f /home/ubuntu/logs/db-sync.log
pm2 logs --lines 100
```

---

## ⚠️ WICHTIGE REGELN

### ❌ NIEMALS:
- Auf Production (Blue Server) entwickeln
- Production.db manuell editieren
- Migrations direkt auf Production ausführen ohne Staging-Test
- Staging Branch direkt zu Main mergen ohne Testing
- .env Files ins Git committen

### ✅ IMMER:
- Features lokal entwickeln (development.db)
- Migrations auf Staging testen (echte Daten!)
- Desktop App auf Staging testen vor Production-Deploy
- Git Workflow einhalten (feature → staging → main)
- Health Checks nach Deployment durchführen

---

## 📝 Checkliste: Bug Fix Workflow

```bash
☐ 1. Bug reproduzieren (Development)
☐ 2. Fix implementieren & lokal testen
☐ 3. Feature-Branch pushen
☐ 4. Staging Branch mergen
☐ 5. Desktop App auf Staging testen (VITE_ENV=staging)
☐ 6. Mit echten Daten verifizieren (staging.db)
☐ 7. Wenn OK: Main Branch mergen
☐ 8. Production Deployment abwarten
☐ 9. Health Check: curl http://129.159.8.19:3000/api/health
☐ 10. Desktop App auf Production testen (kurz!)
☐ 11. CHANGELOG.md aktualisieren
☐ 12. PROJECT_STATUS.md aktualisieren
```

---

## 🎓 Best Practices

### 1. Database-Snapshots

Staging DB wird wöchentlich aktualisiert (Sonntags 2 AM). Falls du SOFORT neueste Daten brauchst:

```bash
ssh ubuntu@129.159.8.19
bash /home/ubuntu/TimeTracking-Staging/server/scripts/sync-prod-to-staging.sh
```

### 2. Migration Testing

IMMER Migrations auf Staging testen:
- Staging hat echte Daten (production snapshot)
- Fehler werden gefunden BEVOR Production betroffen ist
- Rollback auf Staging hat keinen Customer-Impact

### 3. Desktop App Environment Management

Nutze Environment Variables statt .env switching:
```bash
# Gut:
VITE_ENV=staging npm run dev

# Weniger gut (vergisst man leicht zurückzusetzen):
cp .env.staging .env && npm run dev
```

### 4. Health Checks nach Deployment

Nach JEDEM Production-Deployment:
```bash
# 1. GitHub Actions Status
gh run list --workflow="deploy-server.yml" --limit 1

# 2. Server Health
curl http://129.159.8.19:3000/api/health

# 3. PM2 Status
ssh ubuntu@129.159.8.19 "pm2 status"

# 4. Desktop App Test (kurz!)
cd desktop && VITE_ENV=production npm run dev
# Login testen, Feature testen
```

---

## 📚 Weitere Dokumentation

- **ARCHITECTURE.md**: System Architecture & Tech Stack
- **PROJECT_SPEC.md**: API Specifications & Requirements
- **ENV.md**: Environment Variables & Server Setup
- **CHANGELOG.md**: Version History & Bug Fixes
- **.github/workflows/**: CI/CD Pipeline Definitions

---

**Fragen oder Probleme?**
- Check: ENV.md → Section "Troubleshooting"
- Check: ARCHITECTURE.md → Section "Deployment View"
- Check: Console logs (`pm2 logs` oder Desktop F12)
