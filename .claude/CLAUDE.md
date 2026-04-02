# TimeTracking System - AI Development Guidelines

**Version:** 2.2
**Last Updated:** 2026-02-11
**Purpose:** AI-friendly development guidelines for efficient context loading

---

# 📚 CORE DOCS - Definition & Hierarchy

## Was sind "Core Docs"?

**"Core Docs" = Die 5 Haupt-Dokumentationen des Projekts:**

1. **PROJECT_STATUS.md** (~400 lines) - Aktueller Projektstatus
2. **ARCHITECTURE.md** (~850 lines) - WIE das System gebaut ist
3. **PROJECT_SPEC.md** (~1500 lines) - WAS das System tut
4. **CHANGELOG.md** (~300 lines) - Version History
5. **ENV.md** (~429 lines) - Environment Configuration

**Wenn User sagt "lies Core Docs" oder "Core Docs" erwähnt** → Er meint diese 5 Dateien!

## 🔍 Decision Tree: Welches Doc wann lesen?

```
START JEDER SESSION
└─ Read: PROJECT_STATUS.md (Quick Stats, Current Sprint)
└─ Read: CHANGELOG.md (Recent Changes)

FEATURE ENTWICKLUNG
└─ Read: PROJECT_SPEC.md (Requirements, API Spec, Data Model)
└─ Read: ARCHITECTURE.md (Tech Stack, Patterns, ADRs)

BUG FIX
└─ Read: PROJECT_STATUS.md (Known Issues)
└─ Read: CHANGELOG.md (When was it last working?)
└─ Read: ARCHITECTURE.md (System behavior)

DEPLOYMENT / SCRIPTS
└─ Read: ENV.md (Environment Config, SSH, Scripts)
└─ Read: ARCHITECTURE.md (Deployment View)
└─ IMPORTANT: SSH Keys sind im Projekt-Root: .ssh/oracle_server.key

ARCHITECTURE CHANGE
└─ Read: ARCHITECTURE.md (ADRs, Building Blocks)
└─ Update: ARCHITECTURE.md + PROJECT_SPEC.md (if API changed)

RELEASE
└─ Update: CHANGELOG.md (New version entry)
└─ Update: PROJECT_STATUS.md (Deployment status)
└─ Follow: Release Checklist (siehe unten)
```

## 🧠 AI Context Loading Strategy

**Best Practice:** Load docs in this order for optimal context:

1. **Quick Context** (30 sec): PROJECT_STATUS.md Sections 1-3
2. **Task Context** (2-5 min): Relevante Sections aus PROJECT_SPEC.md oder ARCHITECTURE.md
3. **Details On-Demand**: ENV.md, CHANGELOG.md nur wenn gebraucht

**Warum diese Struktur?**
- **Guidelines (CLAUDE.md)**: WIE entwickeln (Prozesse, Rules, Workflows)
- **Core Docs**: WAS/WIE gebaut ist (Specs, Architecture, Status)
- **Klare Trennung**: Keine Redundanz, effizientes Context Loading

---

# 🎯 KERN-PRINZIPIEN

## 0. ZERO HALLUCINATION POLICY (KRITISCH!)

**AI darf NIEMALS Annahmen treffen oder Code "interpretieren"!**

### Verbotene Verhaltensweisen:
- ❌ "Das sieht korrekt aus" ohne EXAKTEN Vergleich
- ❌ "Ab hier sollte es funktionieren" ohne vollständige Verifikation
- ❌ "Wahrscheinlich macht es X" ohne Code-Beweis
- ❌ Analyse stoppen weil "der Rest ähnlich aussieht"
- ❌ Funktionen erwähnen ohne sie gelesen zu haben

### Pflicht bei Code-Vergleichen:
1. ✅ **JEDE Zeile** der relevanten Source-Funktionen lesen
2. ✅ **JEDE SQL Query** exakt vergleichen (nicht nur "ähnlich")
3. ✅ **JEDE Berechnung** Schritt-für-Schritt nachvollziehen
4. ✅ **JEDE Abweichung** dokumentieren (auch kleine!)
5. ✅ **JEDEN Fix** mit echten Test-Daten verifizieren

### Beispiel - FALSCH:
```
"overtimeService nutzt getDailyTargetHours, validateScript auch → sollte passen ✅"
```

### Beispiel - RICHTIG:
```
"overtimeService.ts Line 467:
  const corrections = getTotalCorrectionsForUserInMonth(userId, month)
validateScript.ts Line 291-302:
  const corrections = db.prepare(SELECT...).all(...)
  const totalCorrections = corrections.reduce(...)
→ Beide laden Corrections, aber unterschiedliche Implementierung!
→ Muss prüfen ob getTotalCorrectionsForUserInMonth intern gleiche Query nutzt..."
[Liest getTotalCorrectionsForUserInMonth Code]
"Line 285-290: SELECT COALESCE(SUM(hours), 0)... WHERE userId = ? AND strftime...
→ UNTERSCHIED! Service nutzt SUM(), Script nutzt reduce()
→ ABER: Ergebnis mathematisch identisch ✅ (verifiziert mit Test)"
```

### Wann ist eine Analyse "komplett"?
**NUR wenn:**
- Alle relevanten Funktionen gelesen & verglichen ✅
- Alle SQL Queries verifiziert ✅
- Alle Berechnungen nachvollzogen ✅
- Alle Unterschiede dokumentiert ✅
- Alle Fixes getestet ✅

**User-Trigger-Phrase:**
Wenn User sagt "durchforste komplett" oder "keine Halluzinationen" → Diese Policy gilt ABSOLUT!

---

## 1. NO REGRESSION

**Funktionierende Features dürfen NIEMALS kaputt gehen!**

Vor JEDER Änderung:
1. ✅ Plan erstellen → User Review → Implementation
2. ✅ Tests schreiben & ausführen
3. ✅ Manuelle Prüfung (Happy Path + Edge Cases)

## 2. PLAN-FIRST APPROACH

- ❌ **NIEMALS** direkt coden ohne Plan
- ✅ **IMMER** Plan mit User reviewen
- ✅ Bei Komplexität: "think hard" nutzen

## 3. DOCUMENTATION-FIRST

- ✅ Core Docs VOR Arbeitsbeginn lesen
- ✅ Core Docs WÄHREND Arbeit aktualisieren
- ✅ Commit Message erklärt WARUM, nicht nur WAS

---

# ⚡ CRITICAL RULES (Must-Know!)

## 🔒 TypeScript Strict Mode (PFLICHT!)

```typescript
// ❌ NIEMALS
const data: any = response.data;

// ✅ IMMER
const data: unknown = response.data;
if (isValidData(data)) { /* Type Guard */ }
```

**Regel:** Null Type Guards verwenden, kein `any`, optional chaining überall!

## 🖥️ Tauri Session Management (KRITISCH!)

```typescript
// ❌ FALSCH - Session Cookies gehen verloren
await fetch('http://localhost:3000/api/...', { credentials: 'include' });

// ✅ RICHTIG - Nutze universalFetch
import { universalFetch } from '../lib/tauriHttpClient';
await universalFetch('http://localhost:3000/api/...', { credentials: 'include' });
```

**Warum?** Browser `fetch()` sendet keine Cookies bei Tauri Cross-Origin!
**Details:** ARCHITECTURE.md → Section "Tauri HTTP Client"

## 📊 Überstunden-Berechnung (BUSINESS-CRITICAL!)

```
Überstunden = Ist-Stunden - Soll-Stunden
```

**Grundregeln (HR-System-Kompatibel):**
1. **Referenz-Datum:** IMMER heute (nicht Ende Monat!)
2. **Krankheit/Urlaub:** Als gearbeitete Stunden zählen (Gutschrift!)
3. **Unbezahlter Urlaub:** Reduziert Soll-Stunden (keine Gutschrift)
4. **Live-Berechnung:** ON-DEMAND berechnen, NIE cachen!

**Details:** PROJECT_SPEC.md → Section 6.2, ARCHITECTURE.md → Section 6.3.9

### 🔍 Wichtigste Faktoren (Kurzversion)

**User-Daten:** workSchedule (höchste Priorität!), weeklyHours, hireDate, endDate
**Zeitraum:** Feiertage (überschreiben workSchedule!), Wochenenden, "heute" als Referenz
**Abwesenheiten:** vacation/sick/special (MIT Gutschrift), unpaid (OHNE Gutschrift, reduziert Soll)
**Berechnung:** time_entries + absence credits + corrections = Ist | workSchedule/weeklyHours = Soll

**Häufige Fehler:**
- workSchedule existiert → weeklyHours wird IGNORIERT!
- Feiertag ÜBERSCHREIBT workSchedule → 0h (auch wenn workSchedule > 0!)
- Unbezahlter Urlaub: REDUZIERT Soll, gibt KEINE Ist-Gutschrift!

### ⚠️ DUAL CALCULATION SYSTEM (CRITICAL!)

**GEFAHR:** System hat ZWEI unabhängige Berechnungswege!
- Backend: overtimeService.ts → overtime_balance (Source of Truth)
- Frontend: reportService.ts → API response (kann abweichen!)

**Timezone Bugs:**
```typescript
// ❌ NIEMALS:
date.toISOString().split('T')[0]  // UTC shift → falsches Datum!

// ✅ IMMER:
formatDate(date, 'yyyy-MM-dd')  // Timezone-safe
```

**Details:** ARCHITECTURE.md → Section 6.3.9

### 🛠️ Validation Tools

```bash
# Detailed Analysis (empfohlen!)
npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM

# Quick Check
npm run validate:overtime -- --userId=X

# Unit Tests
npm test -- workingDays

# Backend vs Frontend Compare
sqlite3 server/database.db "SELECT * FROM overtime_balance WHERE userId=X"
curl http://localhost:3000/api/reports/overtime/user/X?year=YYYY&month=MM
```

## 🗄️ Database Rules

1. **One Database:** Production at `/home/ubuntu/databases/production.db`, locally `server/database.db` (symlinked on server to production.db)
   - `DATABASE_PATH=/home/ubuntu/databases/production.db` (server PM2 config)
   - Local: `DATABASE_PATH=./database.db` (server/.env.development)
2. **WAL Mode:** `db.pragma('journal_mode = WAL')` für Multi-User
3. **Prepared Statements:** SQL Injection Schutz (PFLICHT!)
4. **Soft Delete:** `UPDATE ... SET deletedAt = NOW()` statt `DELETE`

**Details:** ARCHITECTURE.md → Section "Data Layer"

## 🚀 CI/CD & Production

### Environment Variables (CRITICAL!)

Server benötigt diese Variables für korrekten Betrieb:

```bash
TZ=Europe/Berlin                  # Deutsche Zeitzone (Überstunden!)
NODE_ENV=production               # Production Mode
SESSION_SECRET=<secure-random>    # Cookie Encryption
```

**Warum kritisch?**
- ❌ Ohne `TZ=Europe/Berlin`: Zeitberechnungen nutzen UTC → falsche Überstunden!
- ❌ Ohne `NODE_ENV=production`: Future-date time entries erlaubt (Dev-Mode)
- ❌ Ohne `SESSION_SECRET`: Server startet nicht

**Details:** ENV.md → Section "Production Server Setup"

### Deployment Workflow

**Auto-Deploy:** `git push origin main` (wenn `server/**` geändert)

```bash
# Workflow triggered automatisch:
1. TypeScript Type Check
2. Security Audit
3. SSH zu Oracle Cloud
4. Database Backup
5. Build & PM2 Restart
6. Health Check
```

**Monitor:** http://129.159.8.19:3000/api/health

### Deployment Verification Rules (CRITICAL!)

**User Request (2026-02-08):** "du checkst in zukunft bitte immer ab ob die deployments und releases auch wirklich durchgegangen sind. und wenn nicht was die fehler sind. schreibe das als regel"

**PFLICHT nach JEDEM Deployment oder Release:**

```bash
# 1. GitHub Actions Status prüfen (SOFORT nach Push)
gh run list --workflow="deploy-server.yml" --limit 1
# Erwartung: Status = "completed" + Conclusion = "success"
# Bei "failure": Logs analysieren mit gh run view <run-id>

# 2. Health Check ausführen (nach 2-3 Min Wartezeit)
curl -s http://129.159.8.19:3000/api/health | jq
# Erwartung: {"status":"ok","database":"connected","timestamp":"..."}
# Bei Fehler: pm2 logs timetracking-server prüfen

# 3. Funktionstest durchführen
# Test 1: Login testen (Production App oder localhost:1420)
# Test 2: Zeiterfassung erstellen
# Test 3: Überstunden prüfen
# Bei 500 Errors: Server logs analysieren

# 4. Bei Fehler: Rollback-Plan
# - Database Backup vorhanden? (database.backup.TIMESTAMP.db)
# - Letzter funktionierender Commit bekannt?
# - Server Logs gesichert?
```

**Häufige Fehlerquellen:**
- ❌ Deployment failed wegen TypeScript Errors → `npx tsc --noEmit` lokal prüfen
- ❌ Migration failed → Manuell via `manual-migration.yml` ausführen
- ❌ PM2 restart failed → SSH + `pm2 status` + `pm2 logs` prüfen
- ❌ Health Check 502/503 → Server ist down, PM2 restart nötig
- ❌ 500 Errors bei API Calls → Server logs analysieren, CHECK constraints prüfen

**Dokumentation:**
- Jedes fehlgeschlagene Deployment in console.md dokumentieren
- Fix in CHANGELOG.md unter [Unreleased] eintragen
- Bei Production Issues: Sofortiges Rollback erwägen

---

# 🔄 WORKFLOWS (Kompakt)

## Session Start (3 Steps)

```bash
1. Read: PROJECT_STATUS.md (Current Sprint, Health)
2. Read: CHANGELOG.md (Recent Changes)
3. Read: Relevante Section aus ARCHITECTURE.md oder PROJECT_SPEC.md
```

## Feature Development

```bash
1. Read: PROJECT_SPEC.md (Requirements für Feature)
2. Read: ARCHITECTURE.md (Tech Patterns, ADRs)
3. Plan erstellen → User Review
4. Implementieren & Lokal testen (localhost:3000 + server/database.db)
5. Push zu main branch → Auto-Deploy Blue Server (Production)
6. Verify: curl http://129.159.8.19:3000/api/health
7. Optional: Use Green Server (/green) for isolated testing before main push
8. Update: PROJECT_STATUS.md (Sprint Items completed)
```

**Standard Flow:** Development (local) -> git push main -> Auto-Deploy Blue Server
**Optional:** Use staging branch + Green Server for isolated testing (on-demand only)
Siehe "Production Deployment (2-Tier Workflow)" für Details.

## Bug Fix

```bash
1. Read: CHANGELOG.md (Wann funktionierte es?)
2. Read: ARCHITECTURE.md (System Behavior)
3. Reproduzieren → Root Cause finden
4. Fix implementieren (mit Test!)
5. Update: CHANGELOG.md (Fixed section im Unreleased)
```

### Overtime Bug Fix (Special Case)

```bash
# Wenn Überstunden falsch berechnet werden:
1. Read: ARCHITECTURE.md Section 6.3.9 (Dual Calculation System)
2. Run: npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM
3. Compare: Backend (overtime_balance) vs Frontend (reportService API)
4. Check: Timezone bugs (toISOString() usage)
5. Verify: workSchedule vs weeklyHours priority
6. Test: All 19 calculation factors (siehe Validation Checklist)
```

## PC Wechsel (Mac ↔ Windows)

**WICHTIG:** Wenn User sagt "wechseln wir auf den PC" → Kontext ist Windows PC, nicht Mac!

### Erstes Mal Setup (Windows PC)

**User Intent:** "Setup auf Windows PC" oder "Projekt auf Windows einrichten"

```bash
# 1. Check Prerequisites
# - Git installiert? (git --version)
# - Node.js installiert? (node --version)
# - Falls nicht: Installationsanleitung geben

# 2. Projekt clonen (lädt NUR Source Code, ~90 MB!)
cd C:\Projects
git clone https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
cd TimeTracking-Clean

# 3. Dependencies installieren
npm install                          # Root (~1-2 Min)
cd desktop && npm install            # Desktop (~1 Min)
cd ../server && npm install          # Server (~30 Sek)

# 4. Verify Setup
git status                           # Sollte clean sein
du -sh . 2>/dev/null || echo "Windows: Check mit 'dir' command"

# 5. Entwicklung starten
# Option A: Server + Desktop separat
cd server && npm run dev             # Terminal 1 (Server)
cd desktop && npm run dev            # Terminal 2 (Desktop, ~5-10 Min beim ersten Mal)

# Option B: /dev Command (wenn auf Windows)
/dev                                 # Startet Server + Desktop automatisch
```

**Dauer:** ~15 Minuten Setup (einmalig), davon ~5-10 Min Tauri Build beim ersten Mal

**Erwartete Ergebnisse:**
- ✅ Projekt-Größe: ~500 MB (mit node_modules)
- ✅ Server läuft auf localhost:3000
- ✅ Desktop App öffnet sich automatisch
- ✅ Beim ersten Build: `desktop/src-tauri/target/` wird erstellt (~6-8 GB)

### Täglicher Wechsel (Windows PC)

**User Intent:** "Wechseln wir auf den PC" oder "Arbeite jetzt auf Windows"

```bash
# 1. Hole neueste Änderungen
cd C:\Projects\TimeTracking-Clean
git pull origin main                 # ~5 Sekunden

# 2. Check ob Dependencies aktualisiert wurden
git log -1 --name-only | grep package.json
# Falls package.json geändert → npm install

# 3. Entwicklung starten
cd server && npm run dev             # Server
cd desktop && npm run dev            # Desktop App
```

**Dauer:** ~5-10 Sekunden (nur `git pull`, kein Rebuild nötig!)

### Zurück zu Mac

**User Intent:** "Zurück auf Mac" oder "Wechseln wir zurück auf Mac"

```bash
# AUF WINDOWS (vor Wechsel):
git add .
git commit -m "feat: Changes from Windows PC"
git push origin main                 # ~10 Sekunden

# AUF MAC (nach Wechsel):
cd ~/Desktop/TimeTracking-Clean
git pull origin main                 # ~5 Sekunden
# Optional: npm install (falls package.json geändert)
```

### Troubleshooting (Windows)

**Problem: Git nicht installiert**
```bash
# Download & Install: https://git-scm.com/download/win
# Verify: git --version
```

**Problem: Node.js nicht installiert**
```bash
# Download & Install: https://nodejs.org/
# Verify: node --version && npm --version
```

**Problem: Projekt zu groß (> 2 GB)?**
```bash
# Cleanup: Lösche Build-Artifacts
rm -rf desktop/src-tauri/target node_modules desktop/node_modules server/node_modules
# Dann: npm install (Dependencies neu installieren)
```

**Problem: Tauri Build schlägt fehl**
```bash
# Install Rust & dependencies (Windows):
# 1. Rust: https://rustup.rs/
# 2. Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
# 3. WebView2: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

**Details:** shortcuts.md → "Git Workflow & Speicherplatz-Management"

## Production Deployment (2-Tier Workflow)

**Code-Flow:** Local -> `main` branch -> Blue Server:3000 (auto-deploy via deploy-server.yml)
**Data-Flow:** Production DB -> `npm run sync-dev-db` -> Local `server/database.db`

### Deployment Steps

```bash
# 1. Development (Local)
npm run sync-dev-db              # Pull fresh production DB
npm run dev                      # Develop & test locally

# 2. Deploy to Production
git add . && git commit -m "feat: ..."
git push origin main             # Auto-Deploy -> Blue Server:3000

# 3. Verify
curl -s http://129.159.8.19:3000/api/health
# GitHub Actions also runs DB path verification automatically

# 4. EMERGENCY Rollback
/rollback-prod                   # Git revert + Auto-Deploy
```

**Best Practices:**
- Standard flow: develop on main, push to deploy
- Green Server (/green, /sync-green) available for isolated testing but NOT required
- /promote-to-prod and /rollback-prod commands still work as emergency tools
- Database migrations must be backward-compatible
- After deployment: check CHANGELOG.md

**Details:** `.claude/commands/promote-to-prod.md`, `.claude/commands/rollback-prod.md`

## Release (Desktop App)

```bash
# Pre-Checks (PFLICHT!)
1. cd desktop && npx tsc --noEmit  # MUSS ohne Fehler laufen!
2. git status                       # MUSS clean sein

# Version Bump (3 Files!)
3. desktop/package.json            → version: "1.X.Y"
4. desktop/src-tauri/Cargo.toml    → version = "1.X.Y"
5. desktop/src-tauri/tauri.conf.json → version: "1.X.Y"

# Release erstellen
6. git commit -m "chore: Bump version to v1.X.Y"
7. git push origin main
8. git tag v1.X.Y && git push origin v1.X.Y
9. gh release create v1.X.Y --title "..." --notes "..."

# Verification (nach 8-12 Min)
10. Check: *.dmg, *.exe, *.msi, *.AppImage, *.deb vorhanden
11. Check: latest.json enthält Windows + macOS + Linux!

# Documentation Updates
12. Update: CHANGELOG.md (neue Version mit Changes)
13. Update: PROJECT_STATUS.md (Recent Deployments)
```

**KRITISCH:** `latest.json` MUSS alle Plattformen enthalten, sonst Auto-Update kaputt!

**Details & Troubleshooting:** Siehe CLAUDE.md.backup (alte Version) oder frag User

---

# 🚫 VERBOTE (Never Do!)

## Code Quality
- ❌ `any` Type verwenden → `unknown` + Type Guards nutzen
- ❌ Code duplizieren → DRY Principle
- ❌ Business Logic in mehreren Services → Extract to shared service
- ❌ `console.log` in Production → Entfernen vor Commit

## Database & Date Handling
- ❌ Neue DB-Files erstellen → Nur `server/database.db`!
- ❌ SQL Injection → IMMER Prepared Statements
- ❌ Hard Delete → Soft Delete (`deletedAt`)
- ❌ `toISOString().split('T')[0]` → Timezone bugs! Use `formatDate(date, 'yyyy-MM-dd')`

## Workflow
- ❌ Direkt coden ohne Plan → IMMER Plan-First!
- ❌ Direkt auf Production server arbeiten → Immer lokal entwickeln und via git push deployen
- ❌ Mergen ohne Testing → Tests & Manual Check

## Security
- ❌ Passwörter Klartext → bcrypt Hashing
- ❌ Input nicht validieren → XSS/SQL Injection Gefahr
- ❌ Session-Secrets hardcoden → .env nutzen

## Tauri/Desktop
- ❌ Browser `fetch()` direkt → `universalFetch` nutzen!
- ❌ localStorage für sensible Daten → Tauri Secure Storage

## Environment Switching
- ❌ **NIEMALS** `export VITE_API_URL=...` → Shell vars override ALL .env files!
- ✅ **IMMER** `/dev` (localhost:3000), `/green` (staging), `/promote-to-prod` (production) Commands nutzen
- **Troubleshooting:** `printenv | grep VITE_API_URL` → Falls gesetzt: `unset VITE_API_URL`

**Details:** ENV.md → "Desktop app connects to wrong server"

## Overtime Calculation
- ❌ Neue Calculation Logic erstellen → Use UnifiedOvertimeService!
- ❌ Ohne Validation Tool testen → `npm run validate:overtime:detailed` nutzen
- ❌ Nur Backend ODER Frontend prüfen → Beide vergleichen!

## Green Server Troubleshooting
**Wenn Green Server Probleme:** `pm2 list` → `pm2 env <ID>` → `pm2 logs timetracking-staging`
**Häufig:** DATABASE_PATH falsch, Port 3000/3001 conflict, ENV vars nicht als PREFIX gesetzt
**Details:** ENV.md → "Green Server Deployment"

---

# ✅ QUALITY GATES

## Pre-Commit Checklist

```bash
# TypeScript & Code Quality
☐ npx tsc --noEmit                # Keine TypeScript Fehler
☐ Keine `any` Types               # unknown + Type Guards
☐ Error Handling implementiert    # try/catch, null checks
☐ Optional Chaining genutzt       # obj?.prop, arr?.[0]

# UI/UX
☐ Dark Mode Styles                # dark:bg-gray-800
☐ Responsive Design               # sm:, md:, lg: breakpoints
☐ Loading/Error States            # isLoading, error handling

# Security & Best Practices
☐ Debug console.logs entfernt     # Keine Logs in Production
☐ Keine hardcoded Secrets         # .env nutzen
☐ Prepared Statements             # SQL Injection Schutz
☐ Input Validation (BE + FE)      # XSS Schutz

# Testing
☐ Manuell getestet               # Happy Path + Edge Cases
☐ Browser Console: Keine Errors  # F12 → Console leer
```

## Release Checklist (Desktop App)

```bash
☐ TypeScript kompiliert (npx tsc --noEmit)
☐ Version in 3 Files gebumpt
☐ Commit & Tag erstellt
☐ Release auf GitHub erstellt
☐ Build Status geprüft (8-12 Min)
☐ Binaries vorhanden (*.dmg, *.exe, *.msi, *.AppImage, *.deb)
☐ latest.json enthält ALLE Plattformen (Windows!)
☐ CHANGELOG.md aktualisiert
☐ PROJECT_STATUS.md aktualisiert
```

---

# 🔗 QUICK REFERENCE

**Core Docs:** PROJECT_STATUS.md, ARCHITECTURE.md, PROJECT_SPEC.md, CHANGELOG.md, ENV.md
**Codebase:** `server/` (Backend), `desktop/` (Tauri), `.github/workflows/` (CI/CD)

## Essential Commands

```bash
# Development
npm run dev                                      # Server/Desktop
/dev | /green | /sync-green | /promote-to-prod  # Environment switching

# Validation & Testing
npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM
npx tsc --noEmit                                 # TypeScript check

# Database
sqlite3 database.db "SELECT * FROM overtime_balance WHERE userId=X"

# Production
ssh ubuntu@129.159.8.19
pm2 logs timetracking-server
curl http://129.159.8.19:3000/api/health

# Release
gh release create v1.X.Y --title "..." --notes "..."
```

---

# 🏗️ PROJEKT-ÜBERSICHT

## Tech Stack

- **Frontend:** Tauri 2.x, React 18, TypeScript, TanStack Query, Zustand, Tailwind CSS
- **Backend:** Node.js 20, Express, TypeScript, SQLite (WAL Mode)
- **Desktop:** Tauri (Rust) - 15 MB App Size
- **Deployment:** Oracle Cloud Frankfurt (Free Tier)
- **CI/CD:** GitHub Actions (Auto-Deploy)

**Details:** ARCHITECTURE.md → Section 1 "Technology Stack"

## Database Schema (11 Tabellen)

users, time_entries, absence_requests, vacation_balance, overtime_balance, departments, projects, activities, holidays, notifications, audit_log

**Details:** ARCHITECTURE.md → Section "Data Model"

## Key Features

- Multi-User Time Tracking
- Overtime Calculation (German Labor Law compliant)
- Absence Management (Vacation, Sick Leave, Overtime Comp)
- Real-time Sync (WebSocket)
- Auto-Update System (Desktop Apps)
- Dark Mode Support
- German Public Holidays
- CSV Export (DATEV format)

**Details:** PROJECT_SPEC.md → Section 3 "Functional Requirements"

---

# 📞 SUPPORT & LINKS

## GitHub

- **Repository:** https://github.com/Maxwellbadger-1/TimeTracking-Clean
- **Latest Release:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/latest
- **Issues:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/issues
- **Actions:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions

## Production

- **Health Check:** http://129.159.8.19:3000/api/health
- **Server:** Oracle Cloud (Frankfurt, Germany)
- **SSH:** ubuntu@129.159.8.19

## Backup & Restore

Falls diese neue CLAUDE.md Probleme verursacht:

```bash
# Restore alte Version (1093 lines)
cp .claude/CLAUDE.md.backup .claude/CLAUDE.md

# Backup liegt auch in Git:
git show HEAD~1:.claude/CLAUDE.md > .claude/CLAUDE.md
```

---

**Version:** 2.4 (Mac ↔ Windows Workflow)
**Lines:** ~750 (+107 lines for PC Wechsel Workflow)
**Last Updated:** 2026-02-11
**Status:** ✅ AKTIV

**Changelog:**
- v2.4 (2026-02-11): Mac ↔ Windows Workflow & Speicherplatz-Management
  - **NEW:** Complete "PC Wechsel (Mac ↔ Windows)" workflow section in CLAUDE.md
  - Added: Erstes Mal Setup (Windows PC) - ~15 Min initial setup guide
  - Added: Täglicher Wechsel - Fast git pull workflow (~5 sec)
  - Added: Zurück zu Mac - Bidirectional workflow
  - Added: Windows-specific troubleshooting (Git, Node.js, Rust, Tauri)
  - **NEW:** `/cleanup` command for build-artifact removal (saves 6.8 GB)
  - **NEW:** Pre-commit hook to prevent large files (> 10 MB)
  - shortcuts.md: Added complete Git workflow & best practices
  - **RESULT:** 7.3 GB → 458 MB project size (93.7% reduction)
  - User can now seamlessly switch between Mac & Windows PC
- v2.3 (2026-02-11): Streamlined & Optimized (-48.5% reduction)
- v2.2 (2026-02-11): Production Deployment Workflow (3-Tier System)
- v2.1 (2026-01-24): Overtime System Architecture & Debugging Tools
- v2.0 (2026-01-15): AI-freundliche Neustrukturierung, Core Docs Integration
- v1.0 (2025-11-01): Initial Version
