# 🎯 Implementation Plan: Stiftung der DPolG Zeiterfassung

**Projekt:** Stiftung der DPolG - Zeiterfassung Plus
**Offizieller Name:** "Stiftung der DPolG TimeTracker"
**Kurz:** "DPolG Stiftung Zeiterfassung"
**Entwickler:** Maxflow Software
**Auftraggeber:** Stiftung der Deutschen Polizeigewerkschaft
**Typ:** Tauri Desktop-App mit Multi-User Server
**Ziel:** Produktionsreifes, intuitives Zeiterfassungssystem
**Start:** 2025-10-31
**Status:** 🟢 Planning Phase

---

## 📋 Requirements Summary

### Core Features
- ✅ **Desktop-App** (eigenständige .exe/.app/.AppImage)
- ✅ Multi-User fähig (privater Server, gleichzeitige Nutzung)
- ✅ Rollen: Admin + Mitarbeiter
- ✅ Manuelle Zeiterfassung + Pausen
- ✅ Urlaubs-/Krankheitsverwaltung mit Genehmigung
- ✅ Überstunden-Tracking
- ✅ Reports & Export (PDF/CSV)
- ✅ Moderne, intuitive UI (Desktop native)
- ✅ System Tray Integration
- ✅ Desktop Notifications
- ✅ Auto-Update Mechanismus
- ✅ GitHub Releases

---

## 🏗️ Tech Stack (Modern & Production-Ready)

### Desktop Layer (NEU!)
```
- Tauri 2.x (Desktop Framework)
- Rust 1.75+ (Tauri Backend)
- Native System Integration
  * System Tray
  * Desktop Notifications
  * Keyboard Shortcuts
  * Auto-Updater
```

### Frontend
```
- React 18.3+ (UI Library)
- TypeScript 5.7+ (Type Safety)
- Vite 6.0+ (Build Tool, HMR)
- TanStack Query v5 (Server State)
- Zustand (UI State)
- Tailwind CSS 3.4+ (Styling)
- Recharts (Grafiken/Charts)
- Lucide React (Icons)
- Sonner (Toast Notifications)
- date-fns (Date Handling)
```

### Backend
```
- Node.js 20.x (LTS)
- Express.js 5.x (REST API)
- TypeScript (tsx für Development)
- better-sqlite3 (Database - file-based, multi-user safe)
- bcrypt (Password Hashing)
- express-session (Session Management)
- ws (WebSocket für Real-time Updates)
- cors (Cross-Origin Support)
```

### Database
```
- SQLite3 mit WAL Mode (Write-Ahead Logging)
  → Multi-User fähig
  → File-based (einfaches Backup)
  → Keine separate DB-Server nötig
  → Production-ready
```

### Deployment
```
- PM2 (Process Manager für Node.js)
- Nginx (Reverse Proxy)
- SSL/TLS (HTTPS)
- Privater Server (selbst gehostet)
```

---

## 🎨 Architecture Pattern: Clean Architecture

```
┌─────────────────────────────────────────────┐
│  UI Layer (React Components)                │
├─────────────────────────────────────────────┤
│  State Management (TanStack Query + Zustand)│
├─────────────────────────────────────────────┤
│  API Client (Fetch + Type-safe Endpoints)   │
├─────────────────────────────────────────────┤
│  REST API (Express Routes)                  │
├─────────────────────────────────────────────┤
│  Business Logic (Services)                  │
├─────────────────────────────────────────────┤
│  Data Access (Database Queries)             │
├─────────────────────────────────────────────┤
│  Database (SQLite with WAL)                 │
└─────────────────────────────────────────────┘
```

### Design Principles
- **SOLID** Principles
- **DRY** (Don't Repeat Yourself)
- **YAGNI** (You Aren't Gonna Need It)
- **Separation of Concerns**
- **Single Source of Truth**

---

## 📊 Database Schema

### Tables

#### 1. **users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,           -- bcrypt hashed
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'admin' | 'employee'
  department TEXT,
  weeklyHours REAL NOT NULL,        -- Soll-Stunden/Woche
  vacationDaysPerYear INTEGER,      -- Urlaubstage/Jahr
  status TEXT DEFAULT 'active',     -- 'active' | 'inactive'
  createdAt TEXT DEFAULT (datetime('now')),
  deletedAt TEXT
);
```

#### 2. **time_entries**
```sql
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  startTime TEXT NOT NULL,          -- HH:MM
  endTime TEXT NOT NULL,            -- HH:MM
  breakMinutes INTEGER DEFAULT 0,
  hours REAL NOT NULL,              -- Berechnete Stunden
  activity TEXT,                    -- Tätigkeitsbeschreibung
  project TEXT,                     -- Projekt-Zuordnung
  location TEXT NOT NULL,           -- 'office' | 'homeoffice' | 'field'
  notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 3. **absence_requests**
```sql
CREATE TABLE absence_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,               -- 'vacation' | 'sick' | 'unpaid' | 'overtime_comp'
  startDate TEXT NOT NULL,          -- YYYY-MM-DD
  endDate TEXT NOT NULL,            -- YYYY-MM-DD
  days REAL NOT NULL,               -- Anzahl Tage (berechnet)
  status TEXT DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected'
  reason TEXT,
  adminNote TEXT,
  approvedBy INTEGER,
  approvedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approvedBy) REFERENCES users(id)
);
```

#### 4. **vacation_balance**
```sql
CREATE TABLE vacation_balance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  year INTEGER NOT NULL,
  entitlement REAL NOT NULL,        -- Anspruch (z.B. 30 Tage)
  carryover REAL DEFAULT 0,         -- Übertrag aus Vorjahr
  taken REAL DEFAULT 0,             -- Genommene Tage
  remaining REAL GENERATED ALWAYS AS (entitlement + carryover - taken) VIRTUAL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(userId, year)
);
```

#### 5. **overtime_balance**
```sql
CREATE TABLE overtime_balance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  month TEXT NOT NULL,              -- YYYY-MM
  targetHours REAL NOT NULL,        -- Soll-Stunden
  actualHours REAL DEFAULT 0,       -- Ist-Stunden
  overtime REAL GENERATED ALWAYS AS (actualHours - targetHours) VIRTUAL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(userId, month)
);
```

#### 6. **departments**
```sql
CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  createdAt TEXT DEFAULT (datetime('now'))
);
```

#### 7. **projects**
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);
```

#### 8. **activities**
```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);
```

#### 9. **holidays**
```sql
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,        -- YYYY-MM-DD
  name TEXT NOT NULL,
  federal INTEGER DEFAULT 1         -- Bundesweit oder regional
);
```

#### 10. **notifications**
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,               -- 'absence_approved' | 'absence_rejected' | 'time_edited'
  title TEXT NOT NULL,
  message TEXT,
  read INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 11. **audit_log**
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  action TEXT NOT NULL,             -- 'create' | 'update' | 'delete'
  entity TEXT NOT NULL,             -- 'user' | 'time_entry' | 'absence_request'
  entityId INTEGER,
  changes TEXT,                     -- JSON string
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

---

## 📁 Project Structure

```
TimeTracking-Clean/
├── .claude/
│   └── CLAUDE.md                  # Projekt-Kontext für Claude
├── src-tauri/                     # 🆕 TAURI DESKTOP LAYER
│   ├── src/
│   │   ├── main.rs                # Rust Entry Point + Tauri Setup
│   │   ├── tray.rs                # System Tray Implementation
│   │   └── lib.rs                 # Tauri Commands
│   ├── icons/                     # App Icons (verschiedene Größen)
│   ├── tauri.conf.json            # Tauri Configuration
│   ├── Cargo.toml                 # Rust Dependencies
│   ├── build.rs                   # Build Script
│   └── capabilities/              # Tauri Capabilities/Permissions
├── src/                           # 🆕 FRONTEND (für Tauri)
│   ├── api/
│   │   └── client.ts              # API Client + TanStack Query Hooks
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── PasswordReset.tsx
│   │   ├── dashboard/
│   │   │   ├── EmployeeDashboard.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── time/
│   │   │   ├── TimeEntryForm.tsx
│   │   │   ├── TimeEntryList.tsx
│   │   │   └── ManualEntry.tsx
│   │   ├── absence/
│   │   │   ├── AbsenceRequest.tsx
│   │   │   ├── AbsenceApproval.tsx (Admin)
│   │   │   └── AbsenceCalendar.tsx
│   │   ├── reports/
│   │   │   ├── MonthlyReport.tsx
│   │   │   ├── OvertimeReport.tsx
│   │   │   └── ExportButton.tsx
│   │   ├── calendar/
│   │   │   ├── MonthCalendar.tsx
│   │   │   ├── WeekCalendar.tsx
│   │   │   ├── YearCalendar.tsx
│   │   │   └── TeamCalendar.tsx
│   │   ├── admin/
│   │   │   ├── UserManagement.tsx
│   │   │   ├── DepartmentManagement.tsx
│   │   │   └── ProjectManagement.tsx
│   │   ├── desktop/               # 🆕 DESKTOP-SPECIFIC
│   │   │   ├── SystemTray.tsx     # Tray Menu Component
│   │   │   ├── UpdateChecker.tsx  # Auto-Update UI
│   │   │   └── Settings.tsx       # Desktop Settings
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── DesktopLayout.tsx  # 🆕 Desktop-optimiert
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── usePermissions.ts
│   │   └── useTauriCommands.ts    # 🆕 Tauri-spezifische Hooks
│   ├── store/
│   │   ├── authStore.ts           # Zustand
│   │   └── uiStore.ts             # Zustand
│   ├── types/
│   │   └── index.ts               # TypeScript Interfaces
│   ├── utils/
│   │   ├── dateUtils.ts
│   │   ├── timeUtils.ts
│   │   ├── exportUtils.ts
│   │   └── tauriUtils.ts          # 🆕 Tauri Helper Functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/                        # Assets
├── index.html
├── vite.config.ts                 # Vite + Tauri Config
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json                   # Root package.json
├── client/                        # Frontend (VERALTET - wird zu src/)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts          # API Client + TanStack Query Hooks
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── PasswordReset.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── EmployeeDashboard.tsx
│   │   │   │   └── AdminDashboard.tsx
│   │   │   ├── time/
│   │   │   │   ├── TimeEntryForm.tsx
│   │   │   │   ├── TimeEntryList.tsx
│   │   │   │   └── ManualEntry.tsx
│   │   │   ├── absence/
│   │   │   │   ├── AbsenceRequest.tsx
│   │   │   │   ├── AbsenceApproval.tsx (Admin)
│   │   │   │   └── AbsenceCalendar.tsx
│   │   │   ├── reports/
│   │   │   │   ├── MonthlyReport.tsx
│   │   │   │   ├── OvertimeReport.tsx
│   │   │   │   └── ExportButton.tsx
│   │   │   ├── calendar/
│   │   │   │   ├── MonthCalendar.tsx
│   │   │   │   ├── WeekCalendar.tsx
│   │   │   │   ├── YearCalendar.tsx
│   │   │   │   └── TeamCalendar.tsx
│   │   │   ├── admin/
│   │   │   │   ├── UserManagement.tsx
│   │   │   │   ├── DepartmentManagement.tsx
│   │   │   │   └── ProjectManagement.tsx
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Toast.tsx
│   │   │   └── layout/
│   │   │       ├── Sidebar.tsx
│   │   │       ├── Header.tsx
│   │   │       └── MobileNav.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── usePermissions.ts
│   │   ├── store/
│   │   │   ├── authStore.ts         # Zustand
│   │   │   └── uiStore.ts           # Zustand
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript Interfaces
│   │   ├── utils/
│   │   │   ├── dateUtils.ts
│   │   │   ├── timeUtils.ts
│   │   │   └── exportUtils.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── server/                        # Backend
│   ├── src/
│   │   ├── database/
│   │   │   ├── schema.ts          # DB Schema Definition
│   │   │   ├── connection.ts      # DB Connection + WAL
│   │   │   └── migrations.ts      # Schema Migrations
│   │   ├── routes/
│   │   │   ├── auth.ts            # Login, Logout, Session
│   │   │   ├── users.ts           # User CRUD
│   │   │   ├── timeEntries.ts     # Time Entry CRUD
│   │   │   ├── absences.ts        # Absence Requests CRUD
│   │   │   ├── reports.ts         # Reports & Export
│   │   │   └── admin.ts           # Admin-only routes
│   │   ├── services/
│   │   │   ├── authService.ts     # Business Logic
│   │   │   ├── timeService.ts
│   │   │   ├── absenceService.ts
│   │   │   └── reportService.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # requireAuth, requireAdmin
│   │   │   ├── validation.ts      # Input Validation
│   │   │   └── errorHandler.ts    # Global Error Handler
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript Interfaces
│   │   ├── utils/
│   │   │   ├── dateUtils.ts
│   │   │   ├── pdfExport.ts
│   │   │   └── csvExport.ts
│   │   ├── websocket/
│   │   │   └── server.ts          # WebSocket Server
│   │   └── server.ts              # Express App Entry
│   ├── database.db                # SQLite Database
│   ├── package.json
│   └── tsconfig.json
├── shared/                        # Shared Types (optional)
│   └── types.ts
├── .gitignore
├── README.md
├── IMPLEMENTATION_PLAN.md         # This file
└── package.json                   # Root workspace
```

---

## 🚀 Implementation Phases

### **Phase 0: Setup & Planning** ✅ COMPLETE
**Ziel:** Projekt-Setup, Tool-Installation, Tauri Desktop-App Grundgerüst, Architektur finalisieren

**Tasks:**
- [x] Requirements gesammelt
- [x] CLAUDE.md erstellen (alle Regeln für Claude AI)
- [x] IMPLEMENTATION_PLAN.md erstellen (11 Phasen)
- [x] CONTEXT_FOR_NEW_CHAT.md erstellen (Handover-Dokument)
- [x] Git Repository initialisieren
- [x] .gitignore erstellen (node_modules, target/, dist/, database.db)
- [x] **Rust Toolchain installieren** (bereits vorhanden: rustc 1.90.0)
- [x] **Tauri CLI installieren** (via npm workspace)
- [x] **Tauri Projekt initialisieren** (npm create tauri-app)
  - Template: React + TypeScript ✅
  - Frontend: Vite ✅
  - Package Manager: npm ✅
- [x] Projekt-Struktur anlegen (desktop/, server/)
- [x] Root package.json Setup (Workspaces: desktop + server)
- [x] Frontend package.json (React, Vite, Tailwind)
- [x] Server package.json (Express, TypeScript, CORS)
- [x] TypeScript Konfiguration (strict mode für Frontend + Backend)
- [x] **Tauri Configuration** (tauri.conf.json)
  - Bundle Identifier: `com.timetracking.app` ✅
  - Window Title: "TimeTracking System" ✅
  - Window Size: 1280x800 (min: 1024x600) ✅
  - Bundle targets: NSIS (Windows) ✅
- [x] ESLint + Prettier Setup
- [x] Tailwind CSS Setup (Frontend)
- [x] README.md erstellen

**Success Criteria:**
- ✅ Git initialisiert mit sinnvollem .gitignore
- ✅ Rust Toolchain installiert (`rustc --version`)
- ✅ Tauri CLI funktioniert
- ✅ Frontend kompiliert (Vite läuft auf :1420)
- ✅ Backend Server läuft (Express auf :3000)
- ✅ Ordnerstruktur existiert (desktop/, server/)
- ✅ TypeScript kompiliert ohne Fehler (Frontend + Backend)
- ✅ ESLint + Prettier funktionieren
- ✅ HTTP Kommunikation Desktop ↔ Server getestet

**Abgeschlossen:** 2025-10-31
**Commits:** bd56a76, 6f2820e, 4d22c4c
**Tag:** v0.1.0-setup

---

### **Phase 1: Database & Backend Foundation** ✅ COMPLETE
**Ziel:** Datenbank-Schema, Express Server, Auth System

**Tasks:**
- [x] SQLite Schema erstellen (alle 11 Tabellen)
- [x] WAL Mode aktivieren
- [x] Express Server Setup
- [x] Session Management (express-session)
- [x] Auth Routes (Login, Logout, Check Session)
- [x] Password Hashing (bcrypt)
- [x] Middleware: requireAuth, requireAdmin
- [x] Error Handling Middleware
- [x] CORS Configuration
- [x] Seed Data (Admin User)

**Success Criteria:**
- ✅ Datenbank-Schema existiert (alle 11 Tabellen)
- ✅ Admin kann sich einloggen (admin/admin123)
- ✅ Session bleibt persistent
- ✅ API gibt korrekte Fehler zurück
- ✅ WAL Mode aktiv für Multi-User Support
- ✅ Foreign Keys aktiviert
- ✅ Indexes erstellt für Performance

**Abgeschlossen:** 2025-10-31
**Commits:** 547489e, fac0d44
**Tag:** v0.2.0-phase1
**Tatsächliche Zeit:** ~2 Stunden

---

### **Phase 2: User Management (Admin)** ✅ COMPLETE
**Ziel:** Mitarbeiter anlegen, bearbeiten, löschen

**Tasks:**
- [x] API Routes: GET/POST/PUT/DELETE /api/users
- [x] User Service (Business Logic)
- [x] Input Validation
- [x] Department/Project CRUD
- [x] Audit Log für User-Änderungen

**Success Criteria:**
- ✅ Admin kann Mitarbeiter anlegen
- ✅ Wochenstunden + Urlaubstage werden gespeichert
- ✅ Abteilungen + Projekte verwaltbar
- ✅ Änderungen werden geloggt
- ✅ Duplicate validation (username/email)
- ✅ Soft delete funktioniert
- ✅ Input validation aktiv

**Abgeschlossen:** 2025-10-31
**Commits:** ca2bc4f
**Tatsächliche Zeit:** ~1.5 Stunden
**Hinweis:** Frontend UI wurde in dieser Phase noch nicht implementiert (Backend-only)

---

### **Phase 3: Time Tracking (Manual Entry)** 🔴 NOT STARTED
**Ziel:** Manuelle Zeiterfassung für Mitarbeiter

**Tasks:**
- [ ] API Routes: GET/POST/PUT/DELETE /api/time-entries
- [ ] Time Entry Service
- [ ] Automatische Stunden-Berechnung
- [ ] Pausen-Handling
- [ ] Frontend: TimeEntryForm Component
- [ ] Frontend: TimeEntryList Component
- [ ] Nachträgliche Erfassung
- [ ] Admin: Zeit-Korrektur
- [ ] Validation (keine Überschneidungen, realistische Zeiten)

**Success Criteria:**
- ✅ Mitarbeiter kann Zeiten erfassen
- ✅ Pausen werden korrekt abgezogen
- ✅ Admin kann fremde Einträge korrigieren
- ✅ Vergangene Tage erfassbar

**Geschätzte Zeit:** 5-6 Stunden

---

### **Phase 4: Absence Management** 🔴 NOT STARTED
**Ziel:** Urlaub, Krankheit, Überstunden-Ausgleich

**Tasks:**
- [ ] API Routes: Absence Requests CRUD
- [ ] Absence Service (Berechnung von Tagen)
- [ ] Vacation Balance Tracking
- [ ] Urlaubs-Kontingent pro Jahr
- [ ] Übertrag ins nächste Jahr
- [ ] Frontend: AbsenceRequest Component
- [ ] Frontend: AbsenceApproval (Admin)
- [ ] Benachrichtigungen (Genehmigt/Abgelehnt)
- [ ] Krankheit ohne Genehmigung
- [ ] Überstunden-Ausgleich Logik

**Success Criteria:**
- ✅ Mitarbeiter kann Urlaub beantragen
- ✅ Admin kann genehmigen/ablehnen
- ✅ Verbleibende Urlaubstage korrekt
- ✅ Krankheit direkt eingetragen
- ✅ Überstunden → Freitage Umwandlung

**Geschätzte Zeit:** 6-7 Stunden

---

### **Phase 5: Calendar Views** 🔴 NOT STARTED
**Ziel:** Monats-, Wochen-, Jahreskalender + Team-Kalender

**Tasks:**
- [ ] MonthCalendar Component
- [ ] WeekCalendar Component
- [ ] YearCalendar Component
- [ ] TeamCalendar Component (alle Mitarbeiter)
- [ ] Feiertage-Integration
- [ ] Farbcodierung (Urlaub, Krank, Arbeit, etc.)
- [ ] Responsive Design
- [ ] Filter (Abteilung, Mitarbeiter)

**Success Criteria:**
- ✅ Alle Kalender-Ansichten funktionieren
- ✅ Feiertage werden angezeigt
- ✅ Team-Übersicht zeigt alle Abwesenheiten
- ✅ Mobile-optimiert

**Geschätzte Zeit:** 5-6 Stunden

---

### **Phase 6: Dashboard & Overview** 🔴 NOT STARTED
**Ziel:** Persönliches + Admin Dashboard

**Tasks:**
- [ ] EmployeeDashboard Component
  - [ ] Heutige Arbeitszeit
  - [ ] Wochenübersicht
  - [ ] Verbleibende Urlaubstage
  - [ ] Überstunden-Saldo
  - [ ] Schnellzugriff (Zeit erfassen, Urlaub beantragen)
- [ ] AdminDashboard Component
  - [ ] Team-Übersicht (wer arbeitet gerade?)
  - [ ] Offene Urlaubsanträge
  - [ ] Monatsstatistik
  - [ ] Schnellzugriff (Genehmigungen, Reports)
- [ ] Notifications System
- [ ] WebSocket für Real-time Updates

**Success Criteria:**
- ✅ Mitarbeiter sieht eigene Daten auf einen Blick
- ✅ Admin sieht Team-Übersicht
- ✅ Benachrichtigungen funktionieren
- ✅ Real-time Updates via WebSocket

**Geschätzte Zeit:** 5-6 Stunden

---

### **Phase 7: Reports & Export** 🔴 NOT STARTED
**Ziel:** Monatsberichte, Überstunden, Export

**Tasks:**
- [ ] MonthlyReport Component (Stunden pro Mitarbeiter)
- [ ] OvertimeReport Component
- [ ] AbsenceReport Component (Kranktage, Urlaubstage)
- [ ] Recharts Integration (Grafiken)
- [ ] PDF Export (pdfmake oder jsPDF)
- [ ] CSV Export
- [ ] Excel Export (optional)
- [ ] Filter: Zeitraum, Mitarbeiter, Abteilung

**Success Criteria:**
- ✅ Reports zeigen korrekte Daten
- ✅ Grafiken sind lesbar
- ✅ PDF/CSV Export funktioniert
- ✅ Admin kann Reports filtern

**Geschätzte Zeit:** 4-5 Stunden

---

### **Phase 8: UI/UX Polish** 🔴 NOT STARTED
**Ziel:** Mobile-Optimierung, Responsive Design, Accessibility

**Tasks:**
- [ ] Mobile Navigation
- [ ] Responsive Tables (horizontal scroll)
- [ ] Touch-friendly Buttons
- [ ] Loading States
- [ ] Error States
- [ ] Empty States
- [ ] Keyboard Navigation
- [ ] ARIA Labels
- [ ] Farbkontrast-Check (WCAG)
- [ ] Dark Mode (optional)

**Success Criteria:**
- ✅ App funktioniert auf Mobile (Tablet + Phone)
- ✅ Alle Interaktionen sind touch-friendly
- ✅ Keyboard-Navigation möglich
- ✅ Screen Reader kompatibel

**Geschätzte Zeit:** 3-4 Stunden

---

### **Phase 9: Testing & Bug Fixes** 🔴 NOT STARTED
**Ziel:** Manuelles Testing, Bug-Fixing, Edge Cases

**Tasks:**
- [ ] Test: Multi-User gleichzeitig
- [ ] Test: Zeitzone-Handling
- [ ] Test: Monats-/Jahreswechsel
- [ ] Test: Urlaubstage-Übertrag
- [ ] Test: Überstunden-Berechnung
- [ ] Test: Admin-Rechte korrekt
- [ ] Test: Session Timeout
- [ ] Test: Export-Funktionen
- [ ] Bug-Fixing
- [ ] Performance-Optimierung

**Success Criteria:**
- ✅ Keine kritischen Bugs
- ✅ Multi-User funktioniert stabil
- ✅ Alle Edge Cases getestet
- ✅ Performance akzeptabel

**Geschätzte Zeit:** 4-5 Stunden

---

### **Phase 10: Deployment Preparation** 🔴 NOT STARTED
**Ziel:** Production Build (Server + Desktop-Apps), Server Setup, Deployment

**Tasks:**

**A) Server Deployment:**
- [ ] Server Production Build (`npm run build`)
- [ ] Environment Variables (.env)
  - [ ] Database Path
  - [ ] Session Secret
  - [ ] Server Port (3000)
  - [ ] CORS Origin (falls Web-Interface später)
- [ ] PM2 Setup (process.json)
  - [ ] Auto-Restart bei Crash
  - [ ] Log-Rotation
  - [ ] Graceful Reload
- [ ] Nginx Configuration (Reverse Proxy)
  - [ ] Proxy zu http://localhost:3000
  - [ ] WebSocket Support
  - [ ] Rate Limiting
- [ ] SSL/TLS Setup (Let's Encrypt)
  - [ ] Certbot installieren
  - [ ] Auto-Renewal
- [ ] Database Backup Script
  - [ ] Tägliches Backup (Cron Job)
  - [ ] Backup Retention (30 Tage)
- [ ] Server Monitoring Setup
  - [ ] PM2 Monitoring
  - [ ] Disk Space Alerts
  - [ ] Database Health Check

**B) Desktop-App Build:**
- [ ] **Tauri Production Build** (`npm run tauri build`)
  - [ ] Windows: .exe + .msi Installer
  - [ ] macOS: .app + .dmg Bundle
  - [ ] Linux: .AppImage + .deb Package
- [ ] App Icons für alle Plattformen
- [ ] Bundle Identifier finalisieren
- [ ] App Version synchronisieren
- [ ] Tauri Signer Setup (für Updates)
- [ ] Test-Installation auf allen Plattformen

**C) Dokumentation:**
- [ ] Server Deployment Guide
- [ ] Desktop-App Installation Guide (für User)
- [ ] Troubleshooting Guide
- [ ] Backup & Restore Guide

**Success Criteria:**
- ✅ Server läuft stabil auf privatem Server (PM2)
- ✅ HTTPS aktiviert
- ✅ Automatische Backups funktionieren
- ✅ Desktop-Apps für Windows/macOS/Linux gebaut
- ✅ Desktop-Apps können Server erreichen
- ✅ WebSocket-Verbindung stabil
- ✅ Monitoring aktiv

**Geschätzte Zeit:** 4-5 Stunden

---

### **Phase 11: GitHub Releases & Auto-Update** 🔴 NOT STARTED
**Ziel:** Versionierung, GitHub Releases, Tauri Auto-Update System für Desktop-Apps

**Tasks:**
- [ ] **GitHub Repository Setup**
  - [ ] Repository erstellen (public oder private)
  - [ ] Secrets konfigurieren (TAURI_PRIVATE_KEY, TAURI_KEY_PASSWORD)
  - [ ] Branch Protection Rules (main branch)
- [ ] **Semantic Versioning** (package.json + Cargo.toml)
  - [ ] MAJOR.MINOR.PATCH (z.B. 1.0.0)
  - [ ] Version synchronisiert zwischen package.json und Cargo.toml
- [ ] **CHANGELOG.md** automatisch generieren
  - [ ] Conventional Commits verwenden
  - [ ] Auto-generate via GitHub Actions
- [ ] **Code Signing Setup** (für macOS/Windows)
  - [ ] macOS: Apple Developer Account + Zertifikat
  - [ ] Windows: Code-Signing-Zertifikat (optional, aber empfohlen)
- [ ] **GitHub Actions für Tauri Releases**
  - [ ] `.github/workflows/release.yml` erstellen
  - [ ] Multi-Platform Builds: Windows (.exe), macOS (.app/.dmg), Linux (.AppImage/.deb)
  - [ ] Tauri Signer für Updates
  - [ ] Auto-Build bei Git Tag (z.B. `v1.0.0`)
  - [ ] GitHub Release mit Artifacts (.exe, .dmg, .AppImage)
  - [ ] `latest.json` für Tauri Updater generieren
- [ ] **Tauri Auto-Update Konfiguration**
  - [ ] `tauri.conf.json` → `"updater"` aktivieren
  - [ ] Update-Server: GitHub Releases
  - [ ] Public Key für Signature Verification
  - [ ] Update-Check Intervall: Bei App-Start + alle 24h
- [ ] **Frontend: Update-Checker Component** (Desktop-spezifisch)
  - [ ] Tauri Command: `check_for_updates()`
  - [ ] Benachrichtigung wenn Update verfügbar (System Tray)
  - [ ] Modal: "Version X.Y.Z verfügbar - Jetzt installieren?"
  - [ ] Progress Bar während Download
  - [ ] App automatisch neustarten nach Installation
- [ ] **Backend: Version-Check API** (für Server-Updates)
  - [ ] GET /api/version (aktuelle Server-Version)
  - [ ] Warnung wenn Desktop-App und Server nicht kompatibel
  - [ ] Minimum-Version-Check
- [ ] **Update-Log** (audit_log Tabelle)
  - [ ] Desktop-App Updates loggen
  - [ ] Server Updates loggen
- [ ] **Rollback-Mechanismus**
  - [ ] Tauri erstellt automatisch Backup vor Update
  - [ ] Bei Fehler: Rollback zur vorherigen Version
- [ ] **Dokumentation: Release-Prozess**
  - [ ] README: Wie erstelle ich ein Release?
  - [ ] Versioning Guide
  - [ ] Testing Guide für Updates

**Success Criteria:**
- ✅ GitHub Actions baut Desktop-Apps für Windows/macOS/Linux
- ✅ GitHub Releases enthalten .exe, .dmg, .AppImage
- ✅ Desktop-App erkennt neue Versionen automatisch
- ✅ User kann Update mit einem Klick installieren
- ✅ App startet nach Update automatisch neu
- ✅ Signatur-Verifizierung funktioniert (sichere Updates)
- ✅ Rollback funktioniert bei fehlerhaftem Update
- ✅ Alle Updates werden geloggt

**Geschätzte Zeit:** 6-8 Stunden (inkl. Code-Signing Setup)

**Tech Stack:**
- **Tauri Updater** (Built-in Auto-Update System)
- **GitHub Actions** (CI/CD für Multi-Platform Builds)
- **Semantic Versioning** (semver)
- **Code Signing** (macOS: Apple Developer, Windows: Optional)
- **RSA Signing** (Update-Signatur-Verifizierung)

---

## 📊 Gesamtaufwand-Schätzung

| Phase | Geschätzte Zeit |
|-------|-----------------|
| Phase 0: Setup + Tauri Installation | 1-2h |
| Phase 1: Backend Foundation | 4h |
| Phase 2: User Management | 5h |
| Phase 3: Time Tracking | 6h |
| Phase 4: Absence Management | 7h |
| Phase 5: Calendar Views | 6h |
| Phase 6: Dashboard | 6h |
| Phase 7: Reports & Export | 5h |
| Phase 8: UI/UX Polish + Desktop Features | 5h |
| Phase 9: Testing | 5h |
| Phase 10: Deployment (Server + Desktop Builds) | 5h |
| Phase 11: GitHub Releases & Auto-Update (Tauri) | 6-8h |
| **TOTAL** | **~65-75 Stunden** |

**Realistisch mit Buffer:** 65-75 Stunden

---

## 🎯 Development Workflow

### Pro Phase:

1. **Branch erstellen**
   ```bash
   git checkout -b phase-X-feature-name
   ```

2. **Plan erstellen**
   - Claude erstellt detaillierten Plan
   - User reviewed Plan
   - Bei Unklarheiten: Fragen klären

3. **Implementation**
   - Backend zuerst (API)
   - Dann Frontend
   - Tests parallel

4. **Review**
   - Code Review
   - Manuelles Testing
   - User-Feedback

5. **Merge**
   ```bash
   git checkout main
   git merge phase-X-feature-name
   git branch -d phase-X-feature-name
   ```

6. **Context Clear**
   ```
   /clear
   ```
   Zwischen Phasen Context clearen!

---

## 🔒 Security Considerations

- ✅ **Password Hashing** (bcrypt mit salt)
- ✅ **Session-based Auth** (HttpOnly Cookies)
- ✅ **CSRF Protection** (SameSite Cookies)
- ✅ **Input Validation** (Backend + Frontend)
- ✅ **SQL Injection Prevention** (Prepared Statements)
- ✅ **XSS Prevention** (React auto-escaping)
- ✅ **Role-based Access Control**
- ✅ **Audit Logging**
- ✅ **HTTPS** (Production)
- ✅ **Rate Limiting** (optional, für Production)

---

## 📝 Next Steps

1. **User Approval** ✋
   - Review diesen Plan
   - Feedback geben
   - Änderungen/Ergänzungen

2. **CLAUDE.md erstellen**
   - Alle Regeln dokumentieren
   - Architektur festhalten

3. **Git Setup**
   - Repository initialisieren
   - Initial Commit

4. **Start Phase 1** 🚀
   - Backend Foundation
   - Database Schema

---

**Letzte Aktualisierung:** 2025-10-30
**Version:** 1.0
**Status:** Wartet auf User-Approval ✋
