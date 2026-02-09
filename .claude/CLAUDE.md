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

**Details:** PROJECT_SPEC.md → Section 6.2 "Overtime Calculation"

### 🔍 Überstunden-Validierungs-Checkliste (PFLICHT!)

**WANN NUTZEN:** Bei JEDEM Debugging von Überstunden-Berechnungen!

**19 Faktoren die Überstunden beeinflussen:**

#### 1. User-Stammdaten (users table)
```bash
# 1. weeklyHours - IGNORIERT wenn workSchedule existiert!
☐ weeklyHours geprüft (z.B. 40h)
☐ Wenn workSchedule existiert → weeklyHours wird IGNORIERT!

# 2. workSchedule - HÖCHSTE PRIORITÄT!
☐ workSchedule existiert? (JSON: {monday: 8, tuesday: 8, ...})
☐ Welche Tage sind Arbeitstage? (hours > 0)
☐ Welche Tage sind KEINE Arbeitstage? (hours = 0 oder fehlt)
☐ BEISPIEL: Christine {monday: 4, tuesday: 4} → Nur Mo+Di = Arbeitstage!

# 3. hireDate - Start der Berechnung
☐ hireDate geprüft (Format: YYYY-MM-DD)
☐ Berechnung startet NICHT vor hireDate!

# 4. endDate - Falls Mitarbeiter gekündigt
☐ endDate geprüft (NULL = noch aktiv)
☐ Berechnung endet bei endDate (falls gesetzt)
```

#### 2. Zeitraum & Referenz-Datum
```bash
# 5. "Heute" als Referenz
☐ Berechnung läuft IMMER bis "heute" (nicht Monatsende!)
☐ Beispiel: 15.01.2026 → Zeitraum: hireDate bis 15.01.2026

# 6. Feiertage (holidays table)
☐ ALLE Feiertage im Zeitraum geladen (federal=0 UND federal=1!)
☐ Bayern: Heilige Drei Könige (06.01) ist Feiertag!
☐ Feiertag ÜBERSCHREIBT workSchedule → 0h (auch wenn workSchedule > 0!)
☐ Beispiel: 06.01 (Dienstag) + workSchedule.tuesday=4h → 0h wegen Feiertag!

# 7. Wochenenden
☐ Samstag + Sonntag sind KEINE Arbeitstage (es sei denn workSchedule.saturday > 0)
```

#### 3. Abwesenheiten (absence_requests table)
```bash
# Nur status='approved' zählen!

# 8. vacation (Urlaub)
☐ Urlaubs-Tage MIT Gutschrift (Ist-Stunden +)
☐ Feiertage innerhalb Urlaub zählen NICHT als Urlaubstag!
☐ Beispiel: Urlaub 01.01-10.01, aber 06.01 = Feiertag → Nur Arbeitstage zählen!

# 9. sick (Krankheit)
☐ Kranke Tage MIT Gutschrift (Ist-Stunden +)
☐ Wochenenden + Feiertage zählen NICHT!

# 10. overtime_comp (Überstunden-Ausgleich)
☐ Überstunden-Ausgleich MIT Gutschrift (Ist-Stunden +)

# 11. special (Sonderurlaub)
☐ Sonderurlaub MIT Gutschrift (Ist-Stunden +)

# 12. unpaid (Unbezahlter Urlaub)
☐ Unbezahlter Urlaub REDUZIERT Soll-Stunden (Ist-Stunden OHNE Gutschrift!)
☐ Beispiel: 2 Tage unbezahlt → Soll-Stunden - (2 × targetHoursPerDay)
```

#### 4. Gearbeitete Stunden
```bash
# 13. time_entries table
☐ Alle Zeiteinträge im Zeitraum geladen
☐ Summe korrekt berechnet (reduce((sum, e) => sum + e.hours, 0))
☐ Nur userId + Zeitraum filtern (KEINE deletedAt-Spalte in time_entries!)
```

#### 5. Korrekturen
```bash
# 14. overtime_corrections table
☐ Manuelle Korrekturen geladen (falls vorhanden)
☐ Summe zu Ist-Stunden addieren
```

#### 6. Berechnungslogik
```bash
# 15. Soll-Stunden (Target)
☐ FOR EACH Tag im Zeitraum (hireDate bis heute):
☐   - Wenn Wochenende → 0h
☐   - Wenn Feiertag → 0h (ÜBERSCHREIBT workSchedule!)
☐   - Wenn workSchedule existiert → workSchedule[dayOfWeek]
☐   - Sonst → weeklyHours / 5
☐ Summe aller Tage = totalTargetHours
☐ Unbezahlter Urlaub ABZIEHEN → adjustedTargetHours

# 16. Ist-Stunden (Actual)
☐ Gearbeitete Stunden (time_entries)
☐ + Abwesenheits-Gutschriften (vacation + sick + overtime_comp + special)
☐ + Manuelle Korrekturen (overtime_corrections)
☐ = totalActualHours

# 17. Überstunden
☐ totalActualHours - adjustedTargetHours = overtime
```

#### 7. Database-Strukturen
```bash
# 18. overtime_balance table (Monatlich)
☐ Für Monats-Vergleich: Eintrag mit month='YYYY-MM' vorhanden?
☐ Werte prüfen: targetHours, actualHours, overtime
☐ Diskrepanz zwischen berechnet vs. DB → Recalculation nötig!

# 19. overtime_transactions table (Historie)
☐ Alle Transaktionen korrekt geloggt?
☐ Types: worked, vacation_credit, sick_credit, correction, etc.
```

### 🛠️ Validation Tools

```bash
# Tool 1: Detailliertes Validation Script (NEU!)
npm run validate:overtime:detailed -- --userId=3 --month=2026-01

# Output zeigt:
# - User Info + workSchedule Visualisierung
# - Calculation Period
# - Holidays (mit [Bundesweit] / [Länderspezifisch])
# - DAY-BY-DAY BREAKDOWN (Tabelle mit Target pro Tag)
# - Absences (mit Gutschrift-Berechnung pro Typ)
# - Time Entries
# - Calculation (Soll vs. Ist vs. Überstunden)
# - Database Comparison (Expected vs. Actual mit Diskrepanz-Highlighting)

# Tool 2: Quick Validation (Bestehendes Script)
npm run validate:overtime -- --userId=3

# Tool 3: Tests ausführen
npm test -- workingDays
```

### ⚠️ Häufige Fehlerquellen (Aus Production Issues)

1. **workSchedule ignoriert** → Prüfe: Existiert workSchedule? Dann weeklyHours IGNORIEREN!
2. **Feiertag übersehen** → Bayern: Heilige Drei Könige (06.01), Fronleichnam, etc.
3. **Feiertag überschreibt nicht** → Feiertag MUSS workSchedule-Tag auf 0h setzen!
4. **Urlaub zählt Feiertag** → Feiertag innerhalb Urlaub = KEIN Urlaubstag!
5. **Unbezahlter Urlaub falsch** → REDUZIERT Soll, gibt KEINE Ist-Gutschrift!
6. **Wochenende in workSchedule** → Nur wenn saturday/sunday > 0 in workSchedule!

### 📝 Beispiel-Szenario: Christine Glas

```
User: Christine Glas (ID=3)
workSchedule: {monday: 4h, tuesday: 4h, rest: 0h}
Zeitraum: 01.01 - 15.01.2026
Urlaub: 01.01 - 25.01.2026 (approved)

DAY-BY-DAY:
01.01 (Do) → 0h (Neujahr = Feiertag)
02.01 (Fr) → 0h (workSchedule: kein Arbeitstag)
05.01 (Mo) → 4h (workSchedule.monday)
06.01 (Di) → 0h (Heilige Drei Könige = Feiertag, überschreibt workSchedule.tuesday!)
07.01 (Mi) → 0h (workSchedule: kein Arbeitstag)
12.01 (Mo) → 4h (workSchedule.monday)
13.01 (Di) → 4h (workSchedule.tuesday)
14.01 (Mi) → 0h (workSchedule: kein Arbeitstag)

Soll-Stunden: 4h + 4h + 4h = 12h (3 Arbeitstage)
Urlaubs-Gutschrift: 12h (3 Arbeitstage, NICHT 4 wegen Feiertag!)
Gearbeitet: 0h
Ist-Stunden: 0h + 12h = 12h
Überstunden: 12h - 12h = 0h ✅
```

### ⚠️ DUAL CALCULATION SYSTEM WARNING (CRITICAL!)

**GEFAHR:** System hat ZWEI unabhängige Berechnungswege!

```
Backend (Source of Truth)              Frontend (Problematic!)
overtimeService.ts                     reportService.ts
  ↓ calculates                           ↓ recalculates
  ↓ writes to DB                         ↓ live on-demand
overtime_balance table                 API response
```

**Probleme:**
1. ❌ Zwei verschiedene Implementierungen können unterschiedlich rechnen
2. ❌ Timezone bugs führen zu Diskrepanzen (z.B. 6h Differenz!)
3. ❌ reportService ignoriert Single Source of Truth
4. ❌ UNPROFESSIONELL - SAP, Personio, DATEV nutzen IMMER Single Source!

**Details:** ARCHITECTURE.md → Section 6.3.9 "Overtime System Architecture & Known Issues"

### 🐛 Bekannte Timezone Bugs (ACHTUNG!)

**Bug Location #1: reportService.ts Line 70** ✅ FIXED
```typescript
// WAS (❌ wrong):
new Date(year, month, 0).toISOString().split('T')[0]
// Result: "2025-12-30" (one day off!)

// IST (✅ correct):
formatDate(new Date(year, month, 0), 'yyyy-MM-dd')
// Result: "2025-12-31" (timezone-safe!)
```

**Bug Location #2: reportService.ts Line 245** ❌ STILL BUGGY!
```typescript
// BUGGY CODE:
const weekKey = weekStart.toISOString().split('T')[0];
// FIX NEEDED:
const weekKey = formatDate(weekStart, 'yyyy-MM-dd');
```

**Root Cause:**
- `toISOString()` konvertiert zu UTC → 1h Zeitverschiebung (Europe/Berlin = UTC+1)
- Dezember 31, 2025 00:00 (Berlin) wird zu "2025-12-30T23:00:00.000Z"
- `.split('T')[0]` extrahiert "2025-12-30" ❌ FALSCHES DATUM!

**Always Use:**
```typescript
import { formatDate } from '../utils/dateFormatting.js';
formatDate(date, 'yyyy-MM-dd') // ✅ Timezone-safe
```

**NEVER Use:**
```typescript
date.toISOString().split('T')[0] // ❌ Timezone bug!
```

### 🔍 Debugging Workflow (Wenn Überstunden falsch)

**Step 1: Vergleiche Backend vs Frontend**
```bash
# Backend (Source of Truth)
sqlite3 server/database.db "SELECT * FROM overtime_balance WHERE userId=155 AND month='2025-12'"

# Frontend (API)
curl http://localhost:3000/api/reports/overtime/user/155?year=2025&month=12
```

**Step 2: Nutze Validation Tool**
```bash
cd server
npm run validate:overtime:detailed -- --userId=155 --month=2025-12

# Output shows:
# - DAY-BY-DAY BREAKDOWN (target per day)
# - Database Comparison (Expected vs Actual)
# - Discrepancy highlighting (if any)
```

**Step 3: Check für Timezone Bugs**
```bash
# Search für toISOString() in overtime code
cd server/src
grep -n "toISOString()" services/reportService.ts
grep -n "toISOString()" services/overtimeService.ts

# EXPECTED:
# - overtimeService.ts: KEINE toISOString() (nutzt formatDate)
# - reportService.ts: toISOString() auf Line 245 (BUG!)
```

**Step 4: Verify Calculation Period**
```bash
# Create test script to verify date range
cat > test_dates.ts << 'EOF'
import { getUserOvertimeReport } from './src/services/reportService.js';
const report = await getUserOvertimeReport(155, 2025, 12);
console.log('First date:', report.breakdown.daily[0].date);
console.log('Last date:', report.breakdown.daily[report.breakdown.daily.length - 1].date);
console.log('Expected: 2025-12-31');
EOF

npx tsx test_dates.ts
```

### 🛠️ Validation Tools Reference

| Tool | Command | Use Case |
|------|---------|----------|
| **Detailed Validation** | `npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM` | Full analysis with day-by-day breakdown |
| **Quick Validation** | `npm run validate:overtime -- --userId=X` | Quick check all months |
| **Unit Tests** | `npm test -- workingDays` | Test calculation logic |
| **Database Query** | `sqlite3 database.db "SELECT ..."` | Manual verification |
| **API Test** | `curl http://localhost:3000/api/...` | Test frontend API |

**Tool Locations:**
- `server/src/scripts/validateOvertimeDetailed.ts` - Detailed validation
- `server/src/scripts/validateAllTestUsers.ts` - Batch validation
- `server/src/utils/workingDays.test.ts` - Unit tests

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

# 🚫 VERBOTE (Never Do!) - Updated 2026-02-05

## 🔴 CRITICAL: Date/Time Handling (NEW!)
- ❌ **NIEMALS** `toISOString().split('T')[0]` → Timezone bugs! Dates shift by 1 day!
- ❌ **NIEMALS** `new Date().toString()` für DB queries → Inconsistent format
- ❌ **NIEMALS** Date comparisons ohne `date()` function in SQL → Off-by-one errors
- ✅ **IMMER** `formatDate(date, 'yyyy-MM-dd')` from timezone.ts nutzen
- ✅ **IMMER** `date(column)` in SQL WHERE clauses verwenden

## 🔴 CRITICAL: Overtime Calculation (UPDATED!)
- ❌ **NIEMALS** neue Overtime Calculation Logic erstellen → Use UnifiedOvertimeService!
- ❌ **NIEMALS** direkt overtime berechnen in Services → Delegate to UnifiedOvertimeService
- ❌ **NIEMALS** verschiedene Calculation Paths → Single Source of Truth required
- ❌ `toISOString().split('T')[0]` für Datumskonvertierung → Timezone Bugs!
- ❌ reportService.ts ändern ohne overtimeService.ts → Inkonsistente Berechnungen
- ❌ Frontend API als Source of Truth → overtime_balance ist authoritative!
- ❌ Ohne Validation Tool testen → Immer `npm run validate:overtime:detailed` nutzen
- ❌ Nur einen Berechnungsweg prüfen → Backend UND Frontend vergleichen!
- ✅ **IMMER** UnifiedOvertimeService.calculateDailyOvertime() nutzen (ab v1.6.0)

## 🔴 CRITICAL: Transaction Creation (NEW!)
- ❌ **NIEMALS** direkt `INSERT INTO overtime_transactions` → Use OvertimeTransactionManager!
- ❌ **NIEMALS** Transactions ohne Duplikat-Check erstellen → Risk of duplicates
- ❌ **NIEMALS** Multiple transaction creation paths → Centralize in Manager
- ✅ **IMMER** OvertimeTransactionManager.createTransaction() nutzen
- ✅ **IMMER** Idempotency checks implementieren

## Code Quality
- ❌ `any` Type verwenden → `unknown` + Type Guards nutzen
- ❌ Code duplizieren → DRY Principle
- ❌ Business Logic in mehreren Services → Extract to shared service
- ❌ Inline Styles → Tailwind CSS nutzen
- ❌ `console.log` in Production → Entfernen vor Commit
- ❌ Hardcoded Values → Environment Variables oder Config

## Database
- ❌ Neue DB-Files erstellen → Nur `server/database.db`!
- ❌ SQL Injection → IMMER Prepared Statements
- ❌ Hard Delete → Soft Delete (`deletedAt`)
- ❌ WAL Mode vergessen → Multi-User funktioniert nicht
- ❌ Verschiedene Date Query Patterns → Use standardized dateQueries utils

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

## Datumsberechnungen (CRITICAL!)

**Verbotene Verhaltensweisen:**
- ❌ **NIEMALS** Wochentage annehmen oder raten
- ❌ **NIEMALS** Kalender ohne korrekten Startag zeichnen
- ❌ **NIEMALS** Tage einfach durchnummerieren ohne Wochentag zu beachten
- ❌ **NIEMALS** toISOString().split('T')[0] ohne Timezone-Kontext nutzen

**Pflicht-Vorgehen:**
1. ✅ **Web Search nutzen:** "which day is [date] Germany" oder "Kalender [Monat] [Jahr] Deutschland"
2. ✅ **Ersten Tag in RICHTIGE SPALTE setzen** (Mo-So Wochentag beachten!)
3. ✅ **Leere Felder DAVOR leer lassen** (nicht mit anderen Tagen auffüllen)
4. ✅ **Systematisch Zeile-für-Zeile ausfüllen** (immer 7 Spalten: Mo-So)
5. ✅ **Gegenprüfung:** Gesamt-Tage - Wochenenden - Feiertage = Werktage

**Beispiel (RICHTIG) - Februar 2026:**
```
Web Search: "which day is February 1st 2026" → Sonntag

Kalender:
MO DI MI DO FR SA SO
                  01  ← Sonntag (ganz rechts!)
02 03 04 05 06 07 08
09 10 11 12 13 14 15
16 17 18 19 20 21 22
23 24 25 26 27 28

Zählung:
Mo: 02, 09, 16, 23 = 4 Tage
Di: 03, 10, 17, 24 = 4 Tage
Mi: 04, 11, 18, 25 = 4 Tage
Do: 05, 12, 19, 26 = 4 Tage
Fr: 06, 13, 20, 27 = 4 Tage
GESAMT = 20 Werktage

Check: 28 Tage - 8 Wochenenden = 20 ✅
```

**Beispiel (FALSCH) - Häufiger Fehler:**
```
MO DI MI DO FR SA SO
02 03 04 05 06 07 01  ← FALSCH! Ignoriert dass 01.=Sonntag
09 10 11 12 13 14 15
...

Problem: Der 01. wurde einfach ans Ende der ersten Zeile gesetzt,
ohne zu beachten dass 01. Februar ein SONNTAG ist!
```

**Mathematische Backup-Methode (Zeller's Congruence):**
```javascript
// Wenn Web Search nicht verfügbar, nutze diese Formel:
function getDayOfWeek(year, month, day) {
  if (month < 3) { month += 12; year -= 1; }
  const q = day;
  const m = month;
  const K = year % 100;
  const J = Math.floor(year / 100);
  const h = (q + Math.floor((13 * (m + 1)) / 5) + K +
             Math.floor(K / 4) + Math.floor(J / 4) - 2 * J) % 7;
  return ((h + 5) % 7) + 1; // ISO: 1=Mo, 7=So
}

// Test: 01.01.2026
getDayOfWeek(2026, 1, 1) // → 4 = Donnerstag ✅
```

**Checkliste für Monatsberechnung:**
```bash
☐ Ersten Tag des Monats bestimmen (Web Search ODER Formel)
☐ Kalender zeichnen (mit korrektem Startag in richtiger Spalte)
☐ Wochentag-für-Wochentag zählen (Mo: ..., Di: ..., etc.)
☐ Summe bilden
☐ Gegenprüfung: Gesamt-Tage - Wochenenden = Werktage
☐ Bei Unsicherheit: Zweite Quelle prüfen
```

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

# Overtime Validation (in server/)
npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM  # Detailed analysis
npm run validate:overtime -- --userId=X                            # Quick check all months
npm test -- workingDays                                            # Unit tests

# Database
sqlite3 database.db "SELECT * FROM overtime_balance WHERE userId=X AND month='YYYY-MM'"
sqlite3 database.db "SELECT * FROM overtime_transactions WHERE userId=X ORDER BY date DESC LIMIT 10"

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
- Section 6.3.9: Overtime System Architecture & Known Issues ⚠️
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

**Version:** 2.1 (Overtime System Dokumentation)
**Lines:** ~840 (v2.0: 480 lines, +75% für Overtime Details)
**Last Updated:** 2026-01-24
**Status:** ✅ AKTIV

**Changelog:**
- v2.1 (2026-01-24): Overtime System Architecture & Debugging Tools
  - Added: Dual Calculation System Warning
  - Added: Timezone Bug Locations & Fixes
  - Added: Debugging Workflow for Overtime Issues
  - Added: Validation Tools Reference
  - Added: Overtime-specific VERBOTE Section
  - Updated: Bug Fix Workflow with Overtime Special Case
  - Updated: Häufige Commands with Validation Tools
  - Cross-referenced: ARCHITECTURE.md Section 6.3.9
- v2.0 (2026-01-15): AI-freundliche Neustrukturierung, Core Docs Integration
- v1.3 (2026-01-15): Core Docs Section hinzugefügt
- v1.2 (2025-11-12): Release Workflow Details
- v1.0 (2025-11-01): Initial Version
