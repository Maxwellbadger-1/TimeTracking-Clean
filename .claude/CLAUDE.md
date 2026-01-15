# TimeTracking System - AI Development Guidelines

**Version:** 2.0
**Last Updated:** 2026-01-15
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

**Details:** PROJECT_SPEC.md → Section 6.2 "Overtime Calculation"

## 🗄️ Database Rules

1. **One Database:** Nur `server/database.db` (NIEMALS weitere DBs!)
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
4. Implementieren (Tests + Docs)
5. Update: PROJECT_STATUS.md (Sprint Items completed)
```

## Bug Fix

```bash
1. Read: CHANGELOG.md (Wann funktionierte es?)
2. Read: ARCHITECTURE.md (System Behavior)
3. Reproduzieren → Root Cause finden
4. Fix implementieren (mit Test!)
5. Update: CHANGELOG.md (Fixed section im Unreleased)
```

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
- ❌ Inline Styles → Tailwind CSS nutzen
- ❌ `console.log` in Production → Entfernen vor Commit
- ❌ Hardcoded Values → Environment Variables oder Config

## Database
- ❌ Neue DB-Files erstellen → Nur `server/database.db`!
- ❌ SQL Injection → IMMER Prepared Statements
- ❌ Hard Delete → Soft Delete (`deletedAt`)
- ❌ WAL Mode vergessen → Multi-User funktioniert nicht

## Workflow
- ❌ Direkt coden ohne Plan → IMMER Plan-First!
- ❌ Auf `main` branch arbeiten → Feature-Branch nutzen
- ❌ Commits ohne Message → Beschreibung PFLICHT
- ❌ Mergen ohne Testing → Tests & Manual Check

## Security
- ❌ Passwörter Klartext → bcrypt Hashing
- ❌ Input nicht validieren → XSS/SQL Injection Gefahr
- ❌ Auth/Authorization vergessen → Unauthorized Access
- ❌ Session-Secrets hardcoden → .env nutzen

## Tauri/Desktop
- ❌ Browser APIs nutzen → Tauri APIs verwenden
- ❌ `fetch()` direkt → `universalFetch` nutzen!
- ❌ localStorage für sensible Daten → Tauri Secure Storage

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

## Wichtige Pfade

```bash
# Core Docs
PROJECT_STATUS.md              # Project Status Dashboard
ARCHITECTURE.md                # Software Architecture
PROJECT_SPEC.md                # Requirements & API Spec
CHANGELOG.md                   # Version History
ENV.md                         # Environment Config

# Codebase
server/                        # Backend (Node.js + Express)
  src/server.ts                # Main Server Entry
  database.db                  # SQLite Database
desktop/                       # Frontend (Tauri + React)
  src/                         # React Components
  src-tauri/                   # Tauri (Rust)
scripts/                       # Deployment & Utility Scripts
.github/workflows/             # CI/CD Pipelines
```

## Häufige Commands

```bash
# Development
npm run dev                    # Start Server (in server/)
npm run dev                    # Start Desktop App (in desktop/)

# TypeScript Check
npx tsc --noEmit              # Check TS ohne Build

# Git
git status                     # Check working tree
git add . && git commit -m "..." && git push

# Release
gh release create v1.X.Y --title "..." --notes "..."
gh run list --workflow="release.yml"

# Production
ssh ubuntu@129.159.8.19        # Connect to Oracle Cloud
pm2 logs timetracking-server   # Server Logs
curl http://129.159.8.19:3000/api/health  # Health Check
```

## Core Docs Sections (Quick Jump)

### PROJECT_STATUS.md
- Section 1: Quick Stats
- Section 2: Current Sprint
- Section 3: Health Indicators
- Section 5: Dependencies Status

### ARCHITECTURE.md
- Section 3: System Context (Diagrams)
- Section 5: Building Block View (Components)
- Section 9: ADRs (Architecture Decisions)
- Section 7: Deployment View (Oracle Cloud)

### PROJECT_SPEC.md
- Section 3: Functional Requirements
- Section 5: API Specification (24+ Endpoints)
- Section 6: Data Model (11 Tables)
- Section 7: Workflows (Overtime, Absence)

### CHANGELOG.md
- Section: [Unreleased] (Current Work)
- Version History: v1.5.1 → v1.0.0

### ENV.md
- Section 2: GitHub Credentials
- Section 4: SSH / Production Server
- Section 10: Troubleshooting

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

**Version:** 2.0 (Optimiert für AI Context Loading)
**Lines:** ~480 (vorher: 1093 lines, -56% Reduktion)
**Last Updated:** 2026-01-15
**Status:** ✅ AKTIV

**Changelog:**
- v2.0 (2026-01-15): AI-freundliche Neustrukturierung, Core Docs Integration
- v1.3 (2026-01-15): Core Docs Section hinzugefügt
- v1.2 (2025-11-12): Release Workflow Details
- v1.0 (2025-11-01): Initial Version
