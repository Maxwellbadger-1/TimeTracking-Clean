# TimeTracking System - Claude AI Development Guidelines

**Projekt:** Multi-User Zeiterfassungssystem
**Typ:** Tauri Desktop-App + Backend Server
**Version:** 1.2
**CI/CD:** ✅ GitHub Actions (Auto-Deploy)
**Letzte Aktualisierung:** 2025-11-12

---

# 🎯 KERN-PRINZIPIEN

## 1. KEINE REGRESSION
Funktionierende Features dürfen NIEMALS kaputt gehen!

**Vor JEDER Änderung:**
1. Plan erstellen → User Review → Implementation
2. Tests schreiben & ausführen
3. Manuelle Prüfung (Happy Path + Edge Cases)

## 2. PLAN-FIRST APPROACH
- ❌ **NIEMALS** direkt coden
- ✅ **IMMER** Plan mit User reviewen
- ✅ Bei Komplexität: "think hard" nutzen

## 3. IMPLEMENTATION_PLAN.md PFLICHT
- VOR Beginn lesen
- WÄHREND aktualisieren
- NACH Abschluss committen

---

# 🚀 CI/CD WORKFLOW (Vollautomatisch)

## Production Deployment (Oracle Cloud)

**Trigger:** `git push origin main` (wenn `server/**` geändert)

```bash
# Lokale Änderung
vim server/src/server.ts

# Committen & Pushen
git add server/
git commit -m "fix: Bug XYZ"
git push origin main

# → GitHub Actions deployed automatisch!
# → Status: https://github.com/user/repo/actions
```

**Was passiert automatisch:**
1. TypeScript Type Check
2. Security Audit
3. SSH zu Oracle Cloud (129.159.8.19)
4. Database Backup
5. `npm ci && npm run build`
6. PM2 Zero-Downtime Restart
7. Health Check

**Monitoring:**
```bash
# Health Check
http://129.159.8.19:3000/api/health

# Server Logs (SSH)
ssh ubuntu@129.159.8.19
pm2 logs timetracking-server --lines 50
```

---

## Desktop App Releases

### 🚨 KRITISCHSTE REGEL: TypeScript MUSS kompilieren!

**WARUM SO WICHTIG?**
- Tauri Workflow: `npm run build` (TypeScript) → DANN Rust-Build → DANN Binaries
- TypeScript-Fehler = Workflow stoppt SOFORT = **NUR Source Code im Release, KEINE Binaries!**
- **DAS** war das Problem, das immer wieder auftrat!

**LÖSUNG:**
```bash
# VOR jedem Release IMMER testen:
cd desktop && npx tsc --noEmit

# Wenn Fehler → ERST fixen, DANN Release!
```

---

### ✅ KOMPLETTER RELEASE-PROZESS (Step-by-Step)

**Wenn User sagt: "mach release"** → EXAKT diese Schritte befolgen:

#### **Schritt 1: PRE-CHECKS (PFLICHT!)**

```bash
# A) TypeScript Compilation Check
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/desktop
npx tsc --noEmit
# → MUSS ohne Fehler durchlaufen! Sonst STOP!

# B) Alle Änderungen committed?
git status
# → "working tree clean" = ✅
# → Änderungen vorhanden = ERST committen!
```

**Häufigste Fehlerquellen (aus Erfahrung):**
- ❌ Import von gelöschten Dateien (z.B. DevTools)
- ❌ Fehlende Properties in Types
- ❌ Unvollständige File-Edits (z.B. durch sed-Fehler)

**FIX bei TypeScript-Fehlern:**
1. File aus Git wiederherstellen: `git show HEAD^:path/to/file.tsx`
2. Vorsichtig editieren (NIEMALS mit sed/awk!)
3. Erneut testen: `npx tsc --noEmit`

#### **Schritt 2: VERSION BUMP**

**3 Files ändern (immer alle 3!):**

```bash
# 1. desktop/package.json
{
  "version": "1.X.Y"  // MINOR oder PATCH bumpen
}

# 2. desktop/src-tauri/Cargo.toml
[package]
version = "1.X.Y"

# 3. desktop/src-tauri/tauri.conf.json
{
  "version": "1.X.Y"
}
```

**Semantic Versioning:**
- `1.0.X → 1.0.X+1` = PATCH (Bugfix)
- `1.X.0 → 1.X+1.0` = MINOR (Neue Features)
- `X.0.0 → X+1.0.0` = MAJOR (Breaking Changes)

#### **Schritt 3: COMMIT & PUSH**

```bash
# Version Bump committen
git add desktop/package.json desktop/src-tauri/Cargo.toml desktop/src-tauri/tauri.conf.json
git commit -m "chore: Bump version to v1.X.Y"
git push origin main
```

#### **Schritt 4: RELEASE ERSTELLEN**

**WICHTIG:** Tag → Release → Workflow (diese Reihenfolge!)

```bash
# 1. Tag erstellen
git tag v1.X.Y

# 2. Tag pushen (triggert Workflow!)
git push origin v1.X.Y

# 3. GitHub Release erstellen (für Release Notes)
gh release create v1.X.Y \
  --title "TimeTracking System v1.X.Y - [Feature Name]" \
  --notes "$(cat <<'EOF'
# TimeTracking System v1.X.Y

## 🎯 New Features
- Feature 1
- Feature 2

## 🐛 Bug Fixes
- Fix 1
- Fix 2

## 📋 Usage
\`\`\`bash
# Installation instructions
\`\`\`

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Alternative (wenn gh release create den Tag automatisch erstellt):**
```bash
# Release erstellen (erstellt auch automatisch den Tag)
gh release create v1.X.Y \
  --title "..." \
  --notes "..."
# → Workflow wird automatisch getriggert
```

#### **Schritt 5: BUILD MONITORING (PFLICHT!)**

```bash
# 1. Workflow-Status checken (sofort nach Release-Erstellung)
gh run list --workflow="release.yml" --limit 1
# → Status: "in_progress" = ✅

# 2. Nach 2-3 Minuten: Detaillierte Status-Prüfung
gh run view <RUN_ID>
# → Alle 4 Jobs müssen "*" (in_progress) oder "✓" (completed) haben
# → "X" (failed) = Problem!

# 3. Bei Fehlern: Log prüfen
gh run view <RUN_ID> --log | grep -E "(Error|error|failed)"

# 4. Nach 8-12 Minuten: Workflow sollte fertig sein
gh run list --workflow="release.yml" --limit 1
# → Status: "completed" = ✅
```

**Erwartete Build-Zeiten:**
- TypeScript Build: ~1 Minute
- Rust Builds (parallel, 4 Plattformen): ~7-10 Minuten
- Binary Upload: ~1 Minute
- **GESAMT: 8-12 Minuten**

#### **Schritt 6: SUCCESS VERIFICATION (PFLICHT!)**

**KRITISCH:** Release muss BINARIES enthalten, nicht nur Source Code!

```bash
# Release-Seite öffnen
open "https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/tag/v1.X.Y"

# ODER: Assets per CLI prüfen
gh release view v1.X.Y --json assets --jq '.assets[].name'
```

**Erwartete Files (ALLE müssen vorhanden sein!):**
- ✅ `*.dmg` (macOS Universal Binary - Intel + ARM)
- ✅ `*.exe` (Windows Executable)
- ✅ `*.msi` (Windows Installer)
- ✅ `*.AppImage` (Linux Portable)
- ✅ `*.deb` (Linux Debian Package)
- ✅ `latest.json` (Tauri Auto-Update Manifest)

**Wenn NUR `Source code (zip/tar.gz)` vorhanden:**
- ❌ **BUILD HAT VERSAGT!**
- → GitHub hat nur automatisch Source-Archive erstellt
- → Workflow hatte TypeScript/Rust-Fehler
- → Siehe "Schritt 7: Troubleshooting"

---

### 🔧 TROUBLESHOOTING

#### **Problem 1: Release enthält nur Source Code, keine Binaries**

**Ursache:** TypeScript-Compilation ist fehlgeschlagen

**FIX:**
```bash
# 1. Workflow-Logs prüfen
gh run view <RUN_ID> --log | grep -A 20 "error TS"

# 2. TypeScript-Fehler lokal fixen
cd desktop && npx tsc --noEmit
# → Fehler anschauen und fixen

# 3. Release & Tag löschen, neu erstellen
gh release delete v1.X.Y --yes
git push origin :refs/tags/v1.X.Y
git tag -d v1.X.Y

# 4. Fix committen & pushen
git add -A
git commit -m "fix: TypeScript compilation errors"
git push origin main

# 5. Release erneut erstellen (siehe Schritt 4)
```

#### **Problem 2: TypeScript-Fehler durch gelöschte/umbenannte Dateien**

**Beispiel:** DevTools wurden gelöscht, aber Imports existieren noch

**FIX:**
```bash
# 1. Alle Referenzen finden
grep -r "devtools\|DevTool" desktop/src/

# 2. Imports entfernen (VORSICHTIG mit Edit-Tool!)
# - Imports löschen
# - Usages löschen
# - JSX-Blöcke löschen

# 3. Test
npx tsc --noEmit
```

#### **Problem 3: File wurde durch sed/awk beschädigt**

**Symptom:** File hat zu wenige Zeilen oder fehlt Syntax

**FIX:**
```bash
# File aus Git wiederherstellen
git show HEAD:desktop/src/pages/SettingsPage.tsx > desktop/src/pages/SettingsPage.tsx

# ODER: Aus früherem Commit
git show <COMMIT_SHA>:path/to/file.tsx > path/to/file.tsx
```

#### **Problem 4: Build läuft > 15 Minuten**

**Ursache:** Workflow hängt oder ist sehr langsam

**FIX:**
```bash
# 1. Status checken
gh run view <RUN_ID>

# 2. Wenn "in_progress" zu lange:
#    - GitHub Actions können langsam sein (normal bis 20 Min)
#    - Abwarten oder Workflow canceln & neu starten

# 3. Workflow canceln (nur wenn wirklich nötig!)
gh run cancel <RUN_ID>
```

---

### 📋 RELEASE CHECKLIST (Für Copy-Paste)

```
☐ 1. TypeScript kompiliert ohne Fehler (npx tsc --noEmit)
☐ 2. Alle Änderungen committed (git status clean)
☐ 3. Version in 3 Files gebumpt
☐ 4. Version-Commit erstellt & gepusht
☐ 5. Tag erstellt & gepusht (git tag v1.X.Y && git push origin v1.X.Y)
☐ 6. GitHub Release erstellt (gh release create)
☐ 7. Workflow gestartet (gh run list)
☐ 8. Build-Status geprüft (nach 2-3 Min)
☐ 9. Build abgeschlossen (nach 8-12 Min)
☐ 10. Binaries im Release vorhanden (*.dmg, *.exe, *.msi, *.AppImage, *.deb)
☐ 11. latest.json vorhanden (für Auto-Update)
☐ 12. Mindestens 1 Binary getestet (lokal installieren & starten)
```

---

### 🎯 WICHTIGSTE ERKENNTNISSE (Aus diesem Release v1.1.0)

1. **TypeScript-Fehler = Kein Release**
   - DevTools-Imports waren nicht vollständig entfernt
   - Workflow failed bei `npm run build`
   - **LESSON:** IMMER lokal testen: `npx tsc --noEmit`

2. **File-Corruption durch sed**
   - `sed` kann Files beschädigen wenn Patterns nicht exakt matchen
   - SettingsPage.tsx hatte nur 19 statt 332 Zeilen
   - **LESSON:** Nur Edit-Tool nutzen, NIEMALS sed/awk!

3. **Richtige Reihenfolge**
   - ✅ Commit → Push → Tag → Push Tag → Release
   - ❌ NICHT: Tag vor Commit, Release vor Tag

4. **Geduld bei Builds**
   - Rust-Compilation für 4 Plattformen braucht Zeit
   - 8-12 Minuten sind NORMAL
   - Nicht vorzeitig canceln!

---

# 🗄️ DATABASE REGELN

## Eine Datenbank (PFLICHT!)
- ✅ Nur: `server/database.db`
- ❌ NIEMALS weitere DB-Dateien

## WAL Mode (Multi-User)
```typescript
db.pragma('journal_mode = WAL');
```

## Prepared Statements (SQL Injection Schutz)
```typescript
// ✅ RICHTIG
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ FALSCH
const user = db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
```

## Soft Delete
```sql
UPDATE users SET deletedAt = datetime('now') WHERE id = ?;
-- NICHT: DELETE FROM users WHERE id = ?;
```

---

# 💻 CODE-QUALITÄT

## TypeScript Strict Mode (PFLICHT!)
- ❌ **NIEMALS** `any` verwenden
- ✅ `unknown` wenn Typ unklar
- ✅ Type Guards nutzen

## Defensive Programming
```typescript
// ✅ RICHTIG - Optional Chaining + Defaults
const totalHours = timeEntries
  ?.filter(e => e.userId === userId)
  ?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;

// ❌ FALSCH - Crash bei undefined
const totalHours = timeEntries
  .filter(e => e.userId === userId)
  .reduce((sum, entry) => sum + entry.hours, 0);
```

## Error Handling (PFLICHT!)
```typescript
async function createUser(data: UserData): Promise<User> {
  try {
    // Validation
    if (!data.email?.trim()) {
      throw new Error('Email required');
    }

    // Business Logic
    const user = await db.createUser(data);
    if (!user) throw new Error('Failed to create user');

    return user;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error; // Re-throw für API Handler
  }
}
```

---

# 🖥️ TAURI DESKTOP-APP (KRITISCH!)

## Architektur
- Desktop-Apps (Windows .exe, macOS .app, Linux .AppImage) = Clients
- Server (Node.js + SQLite) = Zentrale Datenhaltung
- Multi-User: Mehrere Apps → Ein Server

## API-Calls & Session-Management (KRITISCH!)

**PROBLEM:** Browser `fetch()` sendet keine Session-Cookies bei Cross-Origin!

**LÖSUNG:** `universalFetch` verwenden!

```typescript
// ❌ FALSCH - Session-Cookies gehen verloren
const response = await fetch('http://localhost:3000/api/exports/datev', {
  credentials: 'include'
});

// ✅ RICHTIG - Korrekte Cookie-Handhabung
import { universalFetch } from '../lib/tauriHttpClient';

const response = await universalFetch('http://localhost:3000/api/exports/datev', {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
});
```

**Warum `universalFetch`?**
- Nutzt Tauri HTTP Plugin in Desktop-App
- Nutzt Browser `fetch()` im Browser (fallback)
- Handled Session-Cookies korrekt bei Cross-Origin
- Definiert in `src/lib/tauriHttpClient.ts`

**REGEL:** Wenn du `await fetch(` siehst → SOFORT ersetzen mit `universalFetch`!

## apiClient (Bereits konfiguriert!)

Der `apiClient` nutzt bereits `universalFetch` mit `credentials: 'include'`:

```typescript
// src/api/client.ts
const response = await universalFetch(url, {
  ...options,
  credentials: 'include', // ✅ Bereits konfiguriert!
  headers: {
    'Content-Type': 'application/json',
    ...options?.headers,
  },
});
```

**ABER:** Direkte `universalFetch` Calls brauchen manuelles `credentials: 'include'`!

## VERBOTE
- ❌ Browser-APIs (window.open, alert, confirm)
- ❌ localStorage für sensible Daten
- ❌ Direct `fetch()` (immer `universalFetch`!)
- ❌ Browser Notifications (Tauri Notifications nutzen!)

---

# 📊 ÜBERSTUNDEN-BERECHNUNG (Best Practice)

**KRITISCH:** Diese Regeln entsprechen HR-Systemen (Personio, DATEV, SAP)

## Grundformel (UNVERÄNDERLICH!)
```
Überstunden = Ist-Stunden - Soll-Stunden
```

**NIEMALS anders berechnen!** Standard in ALLEN professionellen Systemen.

## Referenz-Datum (IMMER HEUTE!)
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

// Arbeits tage FROM hireDate TO today (BEIDE inklusive!)
const workingDays = countWorkingDaysBetween(hireDate, today);
```

**Beispiel:**
- Eintritt: 07.11.2025 (Donnerstag)
- Heute: 11.11.2025 (Montag)
- Arbeitstage: 3 (Do, Fr, Mo)
- Soll: 3 × 8h = 24h
- Ist: 0h
- **Überstunden: 0h - 24h = -24h** ✅

## Live-Berechnung (PFLICHT!)

**Überstunden IMMER ON-DEMAND berechnen!**

```typescript
// ✅ RICHTIG - Live-Berechnung
const targetHours = calculateTargetHours(user.weeklyHours, user.hireDate);
const actualHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
const overtime = actualHours - targetHours;

// ❌ FALSCH - Database Cache (kann veraltet sein!)
const overtime = overtimeData?.totalOvertime;
```

## UI Display-Regeln (PFLICHT!)

**3 separate Metriken zeigen:**

```tsx
<Card>Soll-Stunden: 24:00h</Card>
<Card>Ist-Stunden: 0:00h</Card>
<Card>Überstunden (Differenz): -24:00h</Card>
```

**Layout Best Practice:**
1. **Soll** (Target) - Gray, Clock Icon, Subtitle: "Stand: [Datum]"
2. **Ist** (Actual) - Blue, CheckCircle Icon, Subtitle: "[%] vom Soll"
3. **Überstunden** (Diff) - Green/Red, TrendingUp/AlertCircle Icon, Subtitle: "Ist - Soll"

## Arbeitstage-Berechnung

```typescript
export function countWorkingDaysBetween(from: Date, to: Date): number {
  let workingDays = 0;

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.includes(formatDate(d));

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
  }

  return workingDays;
}
```

## Zeitformatierung

```typescript
// Mit Vorzeichen (für Überstunden)
function formatOvertimeHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  return `${sign}${h}:${String(m).padStart(2, '0')}h`;
}

// Ohne Vorzeichen (für Soll/Ist)
function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}h`;
}
```

---

# 🏖️ ABWESENHEITS-GUTSCHRIFT (Best Practice)

**WICHTIGSTE REGEL:** "Krank/Urlaub = Gearbeitet"

## Grundprinzip (Personio, DATEV, SAP)
```
Kranke/Urlaubstage dürfen NIEMALS zu Minusstunden führen!
```

## Implementierung

### 1. Soll-Stunden (Target)
```typescript
const targetHours = workingDays × targetHoursPerDay;

// Unbezahlter Urlaub REDUZIERT Soll!
const unpaidDays = absences.filter(a => a.type === 'unpaid').reduce(...);
const adjustedTargetHours = targetHours - (unpaidDays × targetHoursPerDay);
```

### 2. Ist-Stunden (Actual)
```typescript
const workedHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);

// Abwesenheits-Gutschrift addieren!
const absenceCredits = absences
  .filter(a => a.status === 'approved')
  .reduce((sum, a) => {
    const days = a.daysRequired || 0;
    // Krankheit, Urlaub, Überstunden-Ausgleich → Gutschrift
    if (a.type === 'vacation' || a.type === 'sick' || a.type === 'overtime_comp') {
      return sum + (days × targetHoursPerDay);
    }
    // Unbezahlter Urlaub → KEINE Gutschrift
    return sum;
  }, 0);

const actualHours = workedHours + absenceCredits;
```

### 3. Überstunden
```typescript
const overtime = actualHours - adjustedTargetHours;
```

## Beispiele

### Beispiel 1: Krankheit
```
Woche: 5 Arbeitstage (Mo-Fr)
Mo, Di: Gearbeitet (16h)
Mi, Do, Fr: Krank (3 Tage)

RICHTIG:
Soll: 5 × 8h = 40h
Ist: 16h + (3 × 8h) = 40h  // Kranken-Gutschrift!
Überstunden: 40h - 40h = 0h ✅
```

### Beispiel 2: Unbezahlter Urlaub
```
Woche: 5 Arbeitstage
Mo-Mi: Gearbeitet (24h)
Do, Fr: Unbezahlter Urlaub (2 Tage)

RICHTIG:
Soll: (5 - 2) × 8h = 24h  // Unbezahlt REDUZIERT Soll!
Ist: 24h  // KEINE Gutschrift
Überstunden: 24h - 24h = 0h ✅
```

---

# 🎨 UI/UX REGELN

## Tailwind CSS (PFLICHT!)
```tsx
// ✅ RICHTIG
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
  Speichern
</button>

// ❌ FALSCH - Inline Styles
<button style={{ padding: '8px 16px', background: '#2563eb' }}>
  Speichern
</button>
```

## Dark Mode Support (IMMER!)
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  Content
</div>
```

## Loading & Error States (PFLICHT!)
```tsx
function Component() {
  const { data, isLoading, error } = useQuery(...);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.length) return <EmptyState />;

  return <DataTable data={data} />;
}
```

---

# 🌐 API DESIGN

## RESTful Endpoints
```typescript
GET    /api/users              // Liste
GET    /api/users/:id          // Einzeln
POST   /api/users              // Erstellen
PUT    /api/users/:id          // Update (vollständig)
PATCH  /api/users/:id          // Update (partial)
DELETE /api/users/:id          // Löschen
```

## Response-Struktur (PFLICHT!)
```typescript
// Success
res.json({
  success: true,
  data: result
});

// Error
res.status(400).json({
  success: false,
  error: 'Error message'
});
```

## HTTP Status Codes
```
200 OK              // GET, PUT, PATCH
201 Created         // POST
204 No Content      // DELETE
400 Bad Request     // Validation Error
401 Unauthorized    // Not logged in
403 Forbidden       // Logged in, no permission
404 Not Found       // Resource doesn't exist
500 Server Error    // Unexpected error
```

---

# 🔒 SICHERHEIT

## Authentication & Authorization
```typescript
// Passwort Hashing
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,      // HTTPS only
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// Auth Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Role-based Access
const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

## Input Validation (PFLICHT!)
```typescript
// Backend
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email?.trim() || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }

  // ... rest
});
```

---

# 📦 STATE MANAGEMENT

## TanStack Query für Server-State (PFLICHT!)
```typescript
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}
```

## Zustand für UI-State (PFLICHT!)
```typescript
import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  currentView: 'dashboard',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCurrentView: (view) => set({ currentView: view }),
}));
```

---

# 🚫 VERBOTE (NIEMALS TUN!)

## Code
- ❌ `any` Type verwenden
- ❌ Code kopieren/duplizieren (DRY!)
- ❌ Inline Styles (Tailwind nutzen!)
- ❌ console.log in Production
- ❌ Hardcoded Values

## Database
- ❌ Neue DB-Dateien erstellen
- ❌ SQL Injection (IMMER Prepared Statements!)
- ❌ Hard Delete (Soft Delete nutzen!)

## Workflow
- ❌ Direkt coden ohne Plan
- ❌ Auf main branch arbeiten
- ❌ Commits ohne Beschreibung
- ❌ Mergen ohne Testing

## Sicherheit
- ❌ Passwörter Klartext
- ❌ Input nicht validieren
- ❌ Auth/Authorization vergessen
- ❌ Session-Secrets hardcoden

---

# ✅ PRE-COMMIT CHECKLISTE

**Vor JEDEM Commit:**
- [ ] TypeScript kompiliert ohne Fehler
- [ ] Keine `any` Types
- [ ] Error Handling implementiert
- [ ] Null-Checks vorhanden
- [ ] Dark Mode Styles
- [ ] Responsive Design
- [ ] Loading/Error States
- [ ] Debug console.logs entfernt
- [ ] Keine hardcoded Secrets
- [ ] Prepared Statements
- [ ] Input Validation (Backend + Frontend)
- [ ] Manuell getestet
- [ ] Browser Console: Keine Errors

---

# 📊 PROJEKT-SPEZIFISCH

## Tech Stack (NICHT ÄNDERN!)
- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind
- **Backend:** Node.js 20 + Express + TypeScript + SQLite
- **Database:** SQLite mit WAL Mode
- **Real-time:** WebSocket (ws library)
- **Desktop:** Tauri v2

## Database Schema (11 Tabellen)
1. users
2. time_entries
3. absence_requests
4. vacation_balance
5. overtime_balance
6. departments
7. projects
8. activities
9. holidays
10. notifications
11. audit_log

---

**Version:** 1.2
**Letzte Aktualisierung:** 2025-11-12
**Status:** ✅ AKTIV
