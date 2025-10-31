# TimeTracking System - Claude AI Development Guidelines

**Projekt:** Multi-User Zeiterfassungssystem
**Offizieller Name:** "TimeTracking System"
**Typ:** Tauri Desktop-App + Backend Server
**Ziel:** Production-ready, intuitiv, privater Server, Multi-User fähig
**Version:** 1.0
**Letzte Aktualisierung:** 2025-10-31

---

# 📋 KRITISCH: IMPLEMENTATION_PLAN.md IMMER AKTUELL HALTEN!

**PFLICHT bei JEDEM Task:**

1. ✅ **VOR Beginn:** IMPLEMENTATION_PLAN.md lesen
   - Welche Phase?
   - Welche Tasks?
   - Was sind Success Criteria?

2. ✅ **WÄHREND der Arbeit:** Plan aktualisieren
   - Tasks abhaken: `- [ ]` → `- [x]`
   - Status ändern: `🔴 NOT STARTED` → `🟢 IN PROGRESS` → `✅ COMPLETE`
   - Bei Abschluss: Commit Hash + Datum hinzufügen

3. ✅ **NACH Abschluss:** Plan committen
   ```bash
   git add IMPLEMENTATION_PLAN.md
   git commit -m "docs: Update Phase X status"
   ```

**Warum?**
- 🎯 Überblick behalten (was ist schon gemacht?)
- 🎯 User kann Fortschritt sehen
- 🎯 Neue Chat-Sessions wissen, wo wir stehen
- 🎯 Verhindert doppelte Arbeit

**NIEMALS:**
- ❌ Plan ignorieren und "frei" coden
- ❌ Plan nicht aktualisieren nach Fertigstellung
- ❌ Phasen überspringen ohne Grund

---

# 🎯 OBERSTES PRINZIP: KEINE REGRESSION!

**KRITISCH:** Funktionierende Features dürfen NIEMALS kaputt gehen!

**Vor JEDER Änderung:**
1. ✅ Verstehe den aktuellen Code vollständig
2. ✅ Erstelle einen detaillierten Plan
3. ✅ User reviewed den Plan
4. ✅ Teste die Änderung gründlich
5. ✅ Prüfe ob andere Features betroffen sind

**NIEMALS:**
- ❌ Direkt coden ohne Plan
- ❌ Monolithische Rewrites
- ❌ Code ändern ohne zu verstehen was er tut
- ❌ Alte funktionierende Logik entfernen ohne Grund

---

# 🤖 Workflow mit Claude (PLAN-FIRST APPROACH)

## Phase-Start Workflow

**IMMER diese Schritte befolgen:**

```
1. BRANCH ERSTELLEN
   git checkout -b phase-X-feature-name

2. CONTEXT SAMMELN
   - Relevante Dateien lesen
   - Dokumentation prüfen
   - Abhängigkeiten verstehen

3. PLAN ERSTELLEN (mit Extended Thinking!)
   - User: "think hard" oder "think harder" verwenden
   - Claude: Detaillierten Plan schreiben
   - Plan enthält:
     * Was wird gebaut?
     * Warum so und nicht anders?
     * Welche Dateien betroffen?
     * Abhängigkeiten?
     * Tests?
     * Erfolgs-Kriterien?

4. USER REVIEW
   - Plan dem User vorlegen
   - Auf Feedback warten
   - Plan anpassen falls nötig

5. IMPLEMENTATION
   - Erst Backend (API, Business Logic, Database)
   - Dann Frontend (Components, Hooks, State)
   - Tests parallel schreiben

6. REVIEW & TEST
   - Code Review
   - Manuelles Testing
   - Edge Cases prüfen

7. MERGE
   git checkout main
   git merge phase-X-feature-name
   git branch -d phase-X-feature-name

8. CONTEXT CLEAR
   /clear
```

## Wann "think hard" / "think harder" nutzen?

- ✅ **"think"** - Standard komplexe Aufgabe
- ✅ **"think hard"** - Architektur-Entscheidungen, komplexe Business Logic
- ✅ **"think harder"** - Kritische Sicherheits-Features, Performance-Optimierung
- ✅ **"ultrathink"** - Sehr komplexe Algorithmen, Multi-System Integration

## Sub-Agents nutzen

**Wann Sub-Agents?**
- Komplexe Multi-Step Workflows
- Parallele Tasks (z.B. mehrere Reports gleichzeitig)
- Spezialisierte Tasks (z.B. PDF-Generation, Chart-Erstellung)

**Beispiel:**
```
User: "Erstelle Monats-Report mit PDF Export"
Claude: Nutzt Sub-Agent für PDF-Generation
        Haupt-Agent fokussiert auf Daten-Aggregation
```

## Context Management

**KRITISCH:** Zwischen JEDER Phase `/clear` verwenden!

**Warum?**
- Verhindert Vermischung von Kontexten
- Verhindert Regression (alte Infos beeinflussen neue Änderungen)
- Sauberer Neustart

**Wann `/clear`?**
- ✅ Nach jeder abgeschlossenen Phase
- ✅ Bei Wechsel zwischen verschiedenen Features
- ✅ Nach größeren Debugging-Sessions
- ✅ Wenn Konversation unübersichtlich wird

---

# 🏗️ Architektur-Prinzipien

## SOLID Principles (PFLICHT!)

### S - Single Responsibility Principle
```typescript
// ✅ RICHTIG - Eine Verantwortung
class UserService {
  createUser(data: UserData): User { }
  updateUser(id: number, data: UserData): User { }
  deleteUser(id: number): void { }
}

// ❌ FALSCH - Zu viele Verantwortungen
class UserService {
  createUser() { }
  sendWelcomeEmail() { }  // Email-Service Aufgabe!
  generatePdfReport() { }  // Report-Service Aufgabe!
}
```

### O - Open/Closed Principle
- Offen für Erweiterung
- Geschlossen für Änderung

### L - Liskov Substitution Principle
- Subtypen müssen austauschbar sein

### I - Interface Segregation
- Kleine, spezifische Interfaces
- Nicht ein großes "God Interface"

### D - Dependency Inversion
- Abhängigkeiten zu Abstraktionen, nicht Konkretionen

## DRY (Don't Repeat Yourself)

```typescript
// ✅ RICHTIG - Wiederverwendbare Funktion
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ❌ FALSCH - Code-Duplikation
// date.toISOString().split('T')[0]  <- 10x im Code
```

## YAGNI (You Aren't Gonna Need It)

**Nur bauen, was JETZT gebraucht wird!**

```typescript
// ✅ RICHTIG - Simple Lösung für aktuelles Problem
interface User {
  id: number;
  name: string;
  email: string;
}

// ❌ FALSCH - Spekulativ für Zukunft
interface User {
  id: number;
  name: string;
  email: string;
  socialMediaProfiles?: SocialMedia[];  // Nicht gebraucht!
  preferences?: UserPreferences;         // Nicht gebraucht!
  gamificationPoints?: number;          // Nicht gebraucht!
}
```

## Clean Architecture Layers

```
┌─────────────────────────────────────┐
│  UI Layer (React Components)        │ ← Presentation
├─────────────────────────────────────┤
│  State (TanStack Query + Zustand)   │ ← State Management
├─────────────────────────────────────┤
│  API Client (Typed Endpoints)       │ ← Communication
├─────────────────────────────────────┤
│  REST API (Express Routes)          │ ← API Layer
├─────────────────────────────────────┤
│  Services (Business Logic)          │ ← Business Rules
├─────────────────────────────────────┤
│  Data Access (DB Queries)            │ ← Data Layer
├─────────────────────────────────────┤
│  Database (SQLite + WAL)             │ ← Persistence
└─────────────────────────────────────┘
```

**Dependency Rule:** Dependencies zeigen immer NACH INNEN!
- UI kennt Services, aber Services kennen NICHT UI
- Services kennen Database, aber Database kennt NICHT Services

---

# 💻 Code-Qualitäts-Regeln

## TypeScript Strict Mode (PFLICHT!)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### NIEMALS `any` verwenden!

```typescript
// ✅ RICHTIG
function processUser(user: User): void { }

// ❌ FALSCH
function processUser(user: any): void { }

// ✅ Wenn Typ unklar: unknown
function processData(data: unknown): void {
  if (typeof data === 'string') {
    // Type guard
  }
}
```

## Defensive Programming (KRITISCH!)

```typescript
// ✅ RICHTIG - Null-Checks, Optional Chaining, Defaults
const totalHours = timeEntries
  ?.filter(e => e.userId === userId)
  ?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;

// ❌ FALSCH - Crash bei undefined
const totalHours = timeEntries
  .filter(e => e.userId === userId)
  .reduce((sum, entry) => sum + entry.hours, 0);
```

### IMMER:
- ✅ Optional Chaining (`?.`)
- ✅ Nullish Coalescing (`??`)
- ✅ Default Values (`|| 0`, `?? 'default'`)
- ✅ Array/String Length Checks
- ✅ Try-Catch für async Operationen

## Error Handling (PFLICHT!)

```typescript
// ✅ RICHTIG - Comprehensive Error Handling
async function createUser(data: UserData): Promise<User> {
  try {
    // Validation
    if (!data.email?.trim()) {
      throw new Error('Email is required');
    }

    // Business Logic
    const user = await db.createUser(data);

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error; // Re-throw für API Handler
  }
}

// ❌ FALSCH - Kein Error Handling
async function createUser(data: UserData): Promise<User> {
  const user = await db.createUser(data);
  return user;
}
```

## Naming Conventions

```typescript
// ✅ RICHTIG - Klare, beschreibende Namen

// Variablen: camelCase, beschreibend
const userVacationDays = 30;
const isAdminUser = user.role === 'admin';

// Funktionen: camelCase, Verben
function calculateOvertimeHours(entries: TimeEntry[]): number { }
function validateTimeEntry(entry: TimeEntry): boolean { }

// Interfaces: PascalCase
interface User { }
interface TimeEntry { }
interface VacationRequest { }

// Types: PascalCase
type UserRole = 'admin' | 'employee';
type TimeEntryStatus = 'pending' | 'approved';

// Constants: UPPER_SNAKE_CASE
const MAX_VACATION_DAYS = 30;
const DEFAULT_WEEKLY_HOURS = 40;

// ❌ FALSCH - Unklare Namen
const x = 30;
const flag = true;
function calc(e) { }
```

## Code Struktur

```typescript
// ✅ RICHTIG - Klare Struktur

export default function Component() {
  // 1. Hooks (useState, useMemo, useQuery, etc.)
  const [state, setState] = useState();
  const { data } = useQuery();

  // 2. Berechnungen (useMemo, useCallback)
  const computed = useMemo(() => { ... }, [deps]);

  // 3. Event Handler
  const handleClick = useCallback(() => { ... }, [deps]);

  // 4. Effects (useEffect)
  useEffect(() => { ... }, [deps]);

  // 5. Return JSX
  return (
    <div>...</div>
  );
}
```

---

# 🗄️ Database-Regeln

## Eine einzige Datenbank (PFLICHT!)

- ✅ **Nur:** `server/database.db`
- ❌ **NIEMALS:** Weitere DB-Dateien erstellen
- ❌ **NIEMALS:** Alternative DB-Pfade verwenden

## SQLite WAL Mode (PFLICHT!)

```typescript
// IMMER aktivieren für Multi-User Support
db.pragma('journal_mode = WAL');
```

## Prepared Statements (PFLICHT!)

```typescript
// ✅ RICHTIG - SQL Injection sicher
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ FALSCH - SQL Injection möglich
const user = db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
```

## Foreign Keys (PFLICHT!)

```sql
-- IMMER Foreign Keys nutzen für Integrität
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY,
  userId INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

## Soft Delete

```sql
-- IMMER soft delete nutzen (deletedAt statt DELETE)
UPDATE users SET deletedAt = datetime('now') WHERE id = ?;

-- NICHT:
DELETE FROM users WHERE id = ?;
```

---

# 🧪 Testing-Strategie

## Test-Driven Development (TDD)

**Workflow:**
```
1. Test schreiben (Red)
2. Code schreiben (Green)
3. Refactor (Clean)
```

## Was testen?

- ✅ **Business Logic** (Services)
- ✅ **API Endpoints** (Request/Response)
- ✅ **Berechnungen** (Überstunden, Urlaubstage)
- ✅ **Edge Cases** (null, undefined, empty arrays)
- ✅ **Validation** (falsche Eingaben)

## Manuelles Testing (PFLICHT!)

**Vor jedem Merge:**
- ✅ Happy Path durchspielen
- ✅ Edge Cases testen
- ✅ Multi-User Szenario
- ✅ Browser Console checken (keine Errors)
- ✅ Network Tab checken (API Calls OK)

---

# 🔒 Sicherheits-Regeln

## Authentication & Authorization

```typescript
// ✅ Passwort Hashing
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// ✅ Session-based Auth
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,    // XSS Protection
    secure: true,      // HTTPS only (production)
    sameSite: 'strict', // CSRF Protection
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// ✅ Auth Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ✅ Role-based Access
const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

## Input Validation (PFLICHT!)

```typescript
// ✅ RICHTIG - Backend UND Frontend validieren

// Backend
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { email, password, firstName } = req.body;

  // Validation
  if (!email?.trim() || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }

  if (!firstName?.trim()) {
    return res.status(400).json({ error: 'First name required' });
  }

  // ... rest
});

// Frontend
if (!formData.email?.trim() || !formData.email.includes('@')) {
  toast.error('Ungültige E-Mail');
  return;
}
```

## NIEMALS:

- ❌ Passwörter im Klartext speichern
- ❌ Session-Secrets hardcoden
- ❌ API-Keys im Frontend
- ❌ Sensitive Daten in Logs
- ❌ SQL ohne Prepared Statements

---

# 🎨 UI/UX Regeln

## Tailwind CSS (PFLICHT!)

```tsx
// ✅ RICHTIG - Tailwind Utility Classes
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
// ✅ RICHTIG - Dark Mode Varianten
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  Content
</div>
```

## Responsive Design (PFLICHT!)

```tsx
// ✅ RICHTIG - Mobile-first, dann Desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Mobile: 1 Spalte, Tablet: 2, Desktop: 3 */}
</div>
```

## Loading & Error States

```tsx
// ✅ RICHTIG - Immer Loading/Error States
function Component() {
  const { data, isLoading, error } = useQuery(...);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.length) return <EmptyState />;

  return <DataTable data={data} />;
}
```

## Accessibility (PFLICHT!)

```tsx
// ✅ RICHTIG - ARIA Labels, Keyboard Navigation
<button
  aria-label="Delete user"
  onClick={handleDelete}
  className="..."
>
  <TrashIcon />
</button>

<input
  type="email"
  aria-required="true"
  aria-invalid={!!error}
  aria-describedby="email-error"
/>
{error && <span id="email-error">{error}</span>}
```

---

# 🌐 API Design

## RESTful Endpoints (PFLICHT!)

```typescript
// ✅ RICHTIG - Standard REST
GET    /api/users              // Liste
GET    /api/users/:id          // Einzeln
POST   /api/users              // Erstellen
PUT    /api/users/:id          // Update (vollständig)
PATCH  /api/users/:id          // Update (partial)
DELETE /api/users/:id          // Löschen

// ❌ FALSCH - Inkonsistent
POST /api/getUsers
POST /api/updateUser
POST /api/deleteUser
```

## Response-Struktur (PFLICHT!)

```typescript
// ✅ RICHTIG - Konsistent
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

// ❌ FALSCH - Inkonsistent
res.json(result);
res.send('Error');
```

## HTTP Status Codes

```typescript
// ✅ RICHTIG
200 OK              // Success (GET, PUT, PATCH)
201 Created         // Success (POST)
204 No Content      // Success (DELETE)
400 Bad Request     // Validation Error
401 Unauthorized    // Not logged in
403 Forbidden       // Logged in, but no permission
404 Not Found       // Resource doesn't exist
500 Server Error    // Unexpected error
```

---

# 📦 State Management

## TanStack Query für Server-State (PFLICHT!)

```typescript
// ✅ RICHTIG - Server-Daten mit TanStack Query
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// ❌ FALSCH - useState + useEffect für Server-Daten
const [users, setUsers] = useState([]);
useEffect(() => {
  fetch('/api/users').then(r => r.json()).then(setUsers);
}, []);
```

## Zustand für UI-State (PFLICHT!)

```typescript
// ✅ RICHTIG - UI State in Zustand
import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  currentView: 'dashboard',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCurrentView: (view) => set({ currentView: view }),
}));

// ❌ FALSCH - Server-Daten in Zustand
const useDataStore = create((set) => ({
  users: [],
  fetchUsers: async () => { ... } // NEIN! TanStack Query nutzen!
}));
```

---

# 📅 Datums-Handling

## Manuelle ISO-Formatierung (PFLICHT!)

```typescript
// ✅ RICHTIG - Timezone-safe
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ❌ FALSCH - Timezone-Bug durch UTC
const dateString = date.toISOString().split('T')[0];
```

## date-fns nutzen (empfohlen)

```typescript
import { format, parseISO, addDays } from 'date-fns';

const formatted = format(new Date(), 'yyyy-MM-dd');
const parsed = parseISO('2025-10-30');
const tomorrow = addDays(new Date(), 1);
```

---

# 🖥️ Tauri Desktop-App (KRITISCH!)

## Architektur: Desktop-App + Server

**WICHTIG:** Dies ist KEINE Electron-App! Tauri ist moderner, kleiner, schneller.

**Struktur:**
- **Desktop-Apps** (Windows .exe, macOS .app, Linux .AppImage) → **Clients**
- **Server** (Node.js + Express + SQLite) → **Zentrale Datenhaltung**
- **Multi-User:** Mehrere Desktop-Apps verbinden sich zum selben Server

**Vorteile:**
- Desktop-Apps: ~10 MB (Electron: ~100 MB)
- RAM-Verbrauch: ~50 MB (Electron: ~200 MB)
- Native Performance (Rust Backend)
- System Tray Integration
- Native Notifications
- Auto-Update System (Built-in)

## Tauri Commands (PFLICHT!)

**NIEMALS direkt fetch() verwenden! Immer Tauri invoke()!**

**Rust Side (src-tauri/src/main.rs):**
```rust
use tauri::command;

#[command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend Side (React/TypeScript):**
```typescript
import { invoke } from '@tauri-apps/api/core';

// ✅ RICHTIG - Tauri Command
async function fetchServerUrl(): Promise<string> {
  try {
    const url = await invoke<string>('get_server_url');
    return url;
  } catch (error) {
    console.error('Failed to get server URL:', error);
    throw error;
  }
}
```

## System Tray (PFLICHT!)

**App MUSS im System Tray laufen können!**

**Rust Side (src-tauri/src/tray.rs):**
```rust
use tauri::{AppHandle, CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu};

pub fn create_tray() -> SystemTray {
    let quit = CustomMenuItem::new("quit".to_string(), "Beenden");
    let show = CustomMenuItem::new("show".to_string(), "Anzeigen");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

pub fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                }
                _ => {}
            }
        }
        _ => {}
    }
}
```

## Native Notifications (PFLICHT!)

**NIEMALS Browser-Notifications! Immer Tauri Notifications!**

```typescript
import { sendNotification } from '@tauri-apps/api/notification';

// ✅ RICHTIG - Tauri Notification
async function notifyUser(title: string, body: string) {
  await sendNotification({
    title,
    body,
    icon: '/icons/icon.png'
  });
}

// Beispiel: Abwesenheitsanfrage genehmigt
notifyUser(
  'Urlaubsantrag genehmigt',
  'Dein Urlaub vom 01.11. - 05.11. wurde genehmigt.'
);
```

## Window Management

```typescript
import { appWindow } from '@tauri-apps/api/window';

// Fenster minimieren
await appWindow.minimize();

// Fenster maximieren
await appWindow.maximize();

// Fenster schließen (versteckt es nur, beendet nicht die App!)
await appWindow.hide();

// App komplett beenden
import { exit } from '@tauri-apps/api/process';
await exit(0);
```

## Tauri Configuration (tauri.conf.json)

**KRITISCHE Einstellungen:**

```json
{
  "package": {
    "productName": "Stiftung der DPolG TimeTracker",
    "version": "1.0.0"
  },
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "window": {
        "all": true
      },
      "notification": {
        "all": true
      },
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true
      }
    },
    "bundle": {
      "identifier": "com.dpolg-stiftung.timetracker",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "systemTray": {
      "iconPath": "icons/icon.png"
    },
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/user/repo/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    },
    "windows": [
      {
        "title": "Stiftung der DPolG TimeTracker",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

## Desktop-Specific Features

**System Tray:**
- App läuft im Hintergrund weiter
- Klick auf Tray Icon → Fenster zeigen
- Rechtsklick → Kontext-Menü

**Keyboard Shortcuts:**
```typescript
import { register } from '@tauri-apps/api/globalShortcut';

// Globale Shortcuts registrieren
await register('CommandOrControl+Shift+T', () => {
  appWindow.show();
  appWindow.setFocus();
});
```

**File System Access:**
```typescript
import { open, save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';

// Datei-Dialog öffnen (für CSV Export)
const filePath = await save({
  defaultPath: `bericht_${format(new Date(), 'yyyy-MM-dd')}.csv`,
  filters: [{
    name: 'CSV',
    extensions: ['csv']
  }]
});

if (filePath) {
  await writeTextFile(filePath, csvContent);
}
```

## NIEMALS:

- ❌ Browser-spezifische APIs verwenden (window.open, alert, confirm)
- ❌ localStorage für sensible Daten (nutze Tauri Store)
- ❌ Direct fetch() zu externen APIs (nutze Tauri Commands)
- ❌ Browser Notifications (nutze Tauri Notifications)
- ❌ window.location (nutze Tauri Router)

## IMMER:

- ✅ Tauri Commands für Backend-Kommunikation
- ✅ Tauri Notifications für System-Benachrichtigungen
- ✅ System Tray Integration
- ✅ Native File Dialogs
- ✅ Keyboard Shortcuts
- ✅ Auto-Update aktivieren

---

# 🔄 WebSocket (Real-time Updates)

## Exponential Backoff (PFLICHT!)

```typescript
// ✅ RICHTIG - Mit Max Attempts + Backoff
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

ws.onclose = () => {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    setTimeout(() => connect(), delay);
  }
};

ws.onopen = () => {
  reconnectAttempts = 0; // Reset on success
};

// ❌ FALSCH - Sofort reconnect (Infinite Loop!)
ws.onclose = () => {
  connect();
};
```

---

# 🚫 VERBOTE (NIEMALS TUN!)

## Code

- ❌ **any** Type verwenden
- ❌ Code kopieren/duplizieren (DRY!)
- ❌ Inline Styles (Tailwind nutzen!)
- ❌ console.log in Production lassen
- ❌ Hardcoded Values (Constants nutzen!)
- ❌ Passwörter/Secrets im Code

## Database

- ❌ Neue DB-Dateien erstellen
- ❌ SQL Injection (IMMER Prepared Statements!)
- ❌ Hard Delete (Soft Delete nutzen!)
- ❌ Ohne Foreign Keys arbeiten

## Workflow

- ❌ Direkt coden ohne Plan
- ❌ Auf main branch arbeiten
- ❌ Commits ohne Beschreibung
- ❌ Mergen ohne Testing
- ❌ Context nicht clearen zwischen Phasen

## Sicherheit

- ❌ Passwörter Klartext
- ❌ Input nicht validieren
- ❌ Auth/Authorization vergessen
- ❌ Session-Secrets hardcoden
- ❌ HTTPS in Production weglassen

---

# ✅ PRE-COMMIT CHECKLISTE

**Vor JEDEM Commit:**

- [ ] TypeScript kompiliert ohne Fehler (`tsc`)
- [ ] Keine `any` Types verwendet
- [ ] Error Handling implementiert
- [ ] Null-Checks für Arrays/Strings/Objects
- [ ] Dark Mode Styles hinzugefügt
- [ ] Responsive Design getestet
- [ ] Loading/Error States vorhanden
- [ ] Debug console.logs entfernt
- [ ] Konsistente Namensgebung
- [ ] Keine hardcoded Secrets
- [ ] Keine SQL ohne Prepared Statements
- [ ] Input Validation (Backend + Frontend)
- [ ] Tests geschrieben (falls nötig)
- [ ] Manuell getestet (Happy Path + Edge Cases)
- [ ] Browser Console: Keine Errors
- [ ] Git Diff reviewed

---

# 📊 Logging-Konventionen

```typescript
// ✅ RICHTIG - Strukturiert mit Emoji-Prefix
console.log('✅ Database connected:', dbPath);
console.error('❌ API Error:', error);
console.warn('⚠️ Deprecated feature:', feature);
console.log('🔄 Reconnecting...', attempt);
console.log('📊 Stats:', { users: 10, entries: 50 });

// ❌ FALSCH - Unstrukturiert
console.log('connected');
console.log(error);
```

---

# 🎯 Projekt-spezifische Regeln

## Tech Stack (NICHT ÄNDERN!)

- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind
- **Backend:** Node.js 20 + Express + TypeScript + SQLite
- **Database:** SQLite mit WAL Mode
- **Real-time:** WebSocket (ws library)

## Database Schema

**11 Tabellen (siehe IMPLEMENTATION_PLAN.md):**
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

## Features

**Siehe IMPLEMENTATION_PLAN.md für komplette Liste**

Kern-Features:
- Manuelle Zeiterfassung + Pausen
- Urlaubs-/Krankheitsverwaltung
- Überstunden-Tracking
- Admin-Dashboard
- Mitarbeiter-Dashboard
- Kalender (Monat/Woche/Jahr)
- Reports & Export (PDF/CSV)
- Benachrichtigungen

---

# 🔄 Inkrementelle Entwicklung

## Maximale Change-Größe

- ✅ **Max. 100-200 Zeilen** pro Context-File
- ✅ **Patch-Sets** statt Monolith-Rewrites
- ✅ **Kleine, testbare Schritte**

## Bei großen Changes

1. Plan in Sub-Tasks aufteilen
2. Sub-Agents nutzen
3. Schrittweise implementieren
4. Nach jedem Schritt testen

---

# 📚 Dokumentation

## Code-Kommentare

```typescript
// ✅ RICHTIG - WARUM, nicht WAS
// Berechne Überstunden mit Berücksichtigung von Feiertagen
const overtime = calculateOvertime(entries, holidays);

// ❌ FALSCH - Offensichtliches kommentieren
// Addiere 1 zu counter
counter = counter + 1;
```

## README.md

- Setup-Anleitung
- Development Commands
- Deployment-Anleitung
- Environment Variables

---

# 🚀 Deployment

## Environment Variables

```env
# NIEMALS im Git committen!
SESSION_SECRET=xxx
DATABASE_PATH=./database.db
NODE_ENV=production
PORT=3000
```

## Production Checklist

- [ ] Environment Variables gesetzt
- [ ] HTTPS aktiviert
- [ ] PM2 konfiguriert
- [ ] Database Backups eingerichtet
- [ ] Monitoring aktiv
- [ ] Logging konfiguriert
- [ ] Error Tracking (optional: Sentry)
- [ ] GitHub Releases Setup
- [ ] Auto-Update System aktiv

---

# 🔄 GitHub Releases & Auto-Update System

## Semantic Versioning (PFLICHT!)

**WICHTIG:** Version MUSS synchron sein in `package.json` und `Cargo.toml`!

```json
// package.json
{
  "version": "1.0.0"  // MAJOR.MINOR.PATCH
}
```

```toml
# src-tauri/Cargo.toml
[package]
version = "1.0.0"
```

**Regeln:**
- **MAJOR** (1.x.x): Breaking Changes
- **MINOR** (x.1.x): Neue Features (backwards compatible)
- **PATCH** (x.x.1): Bug Fixes

**Beispiele:**
- `1.0.0` → `1.0.1`: Bug Fix
- `1.0.1` → `1.1.0`: Neues Feature
- `1.1.0` → `2.0.0`: Breaking Change (z.B. API geändert)

## GitHub Actions Tauri Release Workflow

**KRITISCH:** Tauri-Apps MÜSSEN auf allen Plattformen gebaut werden!

```yaml
# .github/workflows/release.yml
name: 'Tauri Release'

on:
  push:
    tags:
      - 'v*'  # Triggered bei git tag v1.0.0

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: npm install

      - name: Build Tauri App
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Stiftung der DPolG TimeTracker v__VERSION__'
          releaseBody: 'See CHANGELOG.md for details'
          releaseDraft: false
          prerelease: false
```

**Output:**
- **Windows:** `.exe`, `.msi`
- **macOS:** `.app`, `.dmg`
- **Linux:** `.AppImage`, `.deb`
- **Update Files:** `latest.json`, signatures

## Version-Check API

```typescript
// Backend: GET /api/version
app.get('/api/version', (req, res) => {
  res.json({
    version: process.env.npm_package_version,
    releaseDate: '2025-10-30',
    changelog: 'Bug fixes and improvements'
  });
});

// Backend: GET /api/updates/check
app.get('/api/updates/check', async (req, res) => {
  const latestRelease = await fetchGitHubLatestRelease();
  const currentVersion = process.env.npm_package_version;

  res.json({
    updateAvailable: isNewer(latestRelease.version, currentVersion),
    latestVersion: latestRelease.version,
    downloadUrl: latestRelease.assets[0].browser_download_url,
    changelog: latestRelease.body
  });
});
```

## Tauri Auto-Update Mechanismus (PFLICHT!)

**WICHTIG:** Tauri hat Built-in Updater! Nutze ihn!

**Desktop-App Update (Frontend):**
```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';
import { sendNotification } from '@tauri-apps/api/notification';

// Update Checker Component
export function TauriUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      const { shouldUpdate, manifest } = await checkUpdate();

      if (shouldUpdate) {
        setUpdateAvailable(true);
        setUpdateInfo(manifest);

        // System Notification
        await sendNotification({
          title: 'Update verfügbar',
          body: `Version ${manifest?.version} ist verfügbar!`
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  }

  async function handleInstallUpdate() {
    setInstalling(true);
    try {
      // Download + Install Update
      await installUpdate();

      // App neu starten
      await relaunch();
    } catch (error) {
      console.error('Update installation failed:', error);
      setInstalling(false);
    }
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg">
      <h3 className="font-bold">Update verfügbar!</h3>
      <p>Version {updateInfo?.version}</p>
      <button
        onClick={handleInstallUpdate}
        disabled={installing}
        className="mt-2 bg-white text-blue-500 px-4 py-2 rounded"
      >
        {installing ? 'Installiere...' : 'Jetzt aktualisieren'}
      </button>
    </div>
  );
}
```

**Tauri Updater Configuration:**
```json
// tauri.conf.json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/username/repo/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

**Update Signature generieren:**
```bash
# Einmalig: Generate Key Pair
npm run tauri signer generate

# Output:
# Private Key: SAVE_IN_GITHUB_SECRETS
# Public Key: ADD_TO_tauri.conf.json
```

## Server Update (Separate!)

**Server hat eigenen Update-Prozess:**

```bash
#!/bin/bash
# scripts/update-server.sh

echo "🔄 Updating Server..."

# 1. Backup Database
cp server/database.db server/database.backup.$(date +%Y%m%d).db

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
cd server && npm install --production

# 4. PM2 Reload (zero-downtime)
pm2 reload ecosystem.config.js

echo "✅ Server Update complete!"
```

## Rollback Mechanismus

**Desktop-App:**
- Tauri erstellt automatisch Backup vor Update
- Bei Fehler: Previous version wird wiederhergestellt

**Server:**
```bash
#!/bin/bash
# scripts/rollback-server.sh

echo "⏪ Rolling back..."

# 1. Restore Database Backup
cp server/database.backup.db server/database.db

# 2. Git checkout previous tag
git checkout $(git describe --tags --abbrev=0 HEAD^)

# 3. Reinstall
npm install --production

# 4. Reload PM2
pm2 reload ecosystem.config.js

echo "✅ Rollback complete!"
```

## CHANGELOG.md (automatisch generiert)

```markdown
# Changelog

## [1.1.0] - 2025-10-31
### Added
- Auto-Update System
- GitHub Releases Integration

### Fixed
- Bug in time calculation

## [1.0.0] - 2025-10-30
### Initial Release
- Time Tracking
- Vacation Management
- Admin Dashboard
```

## Sicherheits-Regeln für Updates

- ✅ **Nur Admin** darf Updates installieren
- ✅ **Database Backup** VOR Update
- ✅ **Rollback-Script** bereit
- ✅ **Changelog** dem User zeigen
- ✅ **Bestätigung** vor Installation
- ✅ **Audit Log** für alle Updates

---

# 📖 Weiterführende Ressourcen

- **Clean Architecture:** https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- **SOLID Principles:** https://en.wikipedia.org/wiki/SOLID
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **TanStack Query:** https://tanstack.com/query/latest
- **Tailwind CSS:** https://tailwindcss.com/docs

---

**Version:** 1.0
**Letztes Update:** 2025-10-30
**Status:** ✅ AKTIV

---

# ⚡ QUICK REFERENCE

**Bei jedem Task:**
1. ✅ Branch erstellen
2. ✅ "think hard" für Plan
3. ✅ User-Review
4. ✅ Implementieren
5. ✅ Testen
6. ✅ Merge
7. ✅ `/clear`

**NIEMALS:**
- ❌ `any` Type
- ❌ SQL Injection
- ❌ Regression
- ❌ Ohne Plan coden

**IMMER:**
- ✅ TypeScript strict
- ✅ Error Handling
- ✅ Null-Checks
- ✅ Tests
- ✅ Clean Code
