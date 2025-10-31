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
  - Bundle Identifier: `com.dpolg-stiftung.timetracker` ✅
  - Product Name: "Stiftung der DPolG TimeTracker" ✅
  - Window Title: "Stiftung der DPolG TimeTracker" ✅
  - Window Size: 1280x800 (min: 1024x600) ✅
  - Publisher: "Stiftung der Deutschen Polizeigewerkschaft" ✅
  - Bundle targets: NSIS (Windows), DMG (macOS), AppImage (Linux) ✅
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

### **Phase 3: Time Tracking (Manual Entry)** ✅ COMPLETE (Backend)
**Ziel:** Manuelle Zeiterfassung für Mitarbeiter

**Tasks:**
- [x] API Routes: GET/POST/PUT/DELETE /api/time-entries
- [x] Time Entry Service
- [x] Automatische Stunden-Berechnung
- [x] Pausen-Handling
- [x] Validation (keine Überschneidungen, realistische Zeiten)
- [x] Overtime Balance Calculation
- [x] Admin: Zeit-Korrektur Permission Check
- [x] Nachträgliche Erfassung (past dates only)
- [ ] Frontend: TimeEntryForm Component (Phase 6)
- [ ] Frontend: TimeEntryList Component (Phase 6)

**Success Criteria:**
- ✅ API Endpoints erstellt (GET/POST/PUT/DELETE)
- ✅ Pausen werden korrekt abgezogen
- ✅ Überschneidungen werden verhindert
- ✅ Admin kann fremde Einträge korrigieren
- ✅ Vergangene Tage erfassbar
- ✅ Zukunfts-Datum wird abgelehnt
- ✅ Pausen-Regel: >6h = min. 30 Min Pause
- ✅ Overtime Balance wird automatisch berechnet
- ✅ Audit Log Integration
- ✅ Permission Checks (Employee: own, Admin: all)

**Abgeschlossen:** 2025-10-31
**Commits:** 9ec9b93
**Tatsächliche Zeit:** ~3 Stunden (Backend only)
**Hinweis:** Frontend UI wird in Phase 6 (Dashboard) implementiert

**Implementierte Features:**
- `server/src/services/timeEntryService.ts` - Complete Business Logic
- `server/src/routes/timeEntries.ts` - REST API Endpoints
- `server/src/middleware/validation.ts` - Time Entry Validation
- Automatic hours calculation from start/end/break
- Overlap detection for same day
- Future date prevention
- Break rule enforcement (>6h requires 30min)
- Overtime balance tracking per month
- Permission system (Employee vs Admin)

**Test Guide:** See `TEST_PHASE3.md` for complete API testing instructions

---

### **Phase 4: Absence Management** ✅ COMPLETE (Backend)
**Ziel:** Urlaub, Krankheit, Überstunden-Ausgleich

**Tasks:**
- [x] API Routes: Absence Requests CRUD
- [x] Absence Service (Berechnung von Tagen)
- [x] Vacation Balance Tracking
- [x] Urlaubs-Kontingent pro Jahr
- [x] Übertrag ins nächste Jahr (max 5 Tage)
- [x] Benachrichtigungen (Genehmigt/Abgelehnt)
- [x] Krankheit automatisch genehmigt
- [x] Überstunden-Ausgleich Logik (8h pro Tag)
- [x] Business Days Calculation (exclude weekends)
- [x] Holiday Integration (exclude holidays)
- [x] Notification Service
- [ ] Frontend: AbsenceRequest Component (Phase 6)
- [ ] Frontend: AbsenceApproval (Admin) (Phase 6)

**Success Criteria:**
- ✅ Mitarbeiter kann Urlaub beantragen
- ✅ Admin kann genehmigen/ablehnen
- ✅ Verbleibende Urlaubstage korrekt berechnet
- ✅ Krankheit direkt genehmigt
- ✅ Überstunden → Freitage Umwandlung (FIFO)
- ✅ Business Days berechnet (ohne Wochenenden)
- ✅ Feiertage werden ausgeschlossen
- ✅ Vacation Balance mit Carryover
- ✅ Benachrichtigungen bei Genehmigung/Ablehnung
- ✅ Insufficient vacation days check
- ✅ Insufficient overtime hours check

**Abgeschlossen:** 2025-10-31
**Commits:** 264f4df
**Tatsächliche Zeit:** ~4 Stunden (Backend only)
**Hinweis:** Frontend UI wird in Phase 6 implementiert

**Implementierte Features:**
- `server/src/services/absenceService.ts` - Complete Business Logic (620 lines)
- `server/src/services/notificationService.ts` - Notification System (130 lines)
- `server/src/routes/absences.ts` - REST API Endpoints (530 lines)
- `server/src/routes/notifications.ts` - Notification Endpoints (140 lines)
- `server/src/middleware/validation.ts` - Absence Validation (+128 lines)
- Business days calculation (excludes weekends)
- Holiday exclusion for vacation days
- Vacation balance tracking with carryover (max 5 days)
- Overtime compensation (8h per day, FIFO deduction)
- Auto-approval for sick leave
- Notification system for approval/rejection
- Permission system (Employee vs Admin)

**API Endpoints:**
- GET    /api/absences - List requests (filtered by role)
- GET    /api/absences/:id - Get single request
- POST   /api/absences - Create new request
- PUT    /api/absences/:id - Update request (pending only)
- POST   /api/absences/:id/approve - Approve request (Admin)
- POST   /api/absences/:id/reject - Reject request (Admin)
- DELETE /api/absences/:id - Delete request
- GET    /api/absences/vacation-balance/:year - Get vacation balance
- GET    /api/notifications - Get user notifications
- GET    /api/notifications/unread-count - Get unread count
- PATCH  /api/notifications/:id/read - Mark as read
- PATCH  /api/notifications/read-all - Mark all as read
- DELETE /api/notifications/:id - Delete notification

**Business Rules:**
- Vacation: Business days only, excludes weekends + holidays
- Sick leave: Auto-approved, business days only (no holidays)
- Overtime compensation: Requires sufficient overtime hours (8h/day)
- Vacation balance: Entitlement + Carryover (max 5 days) - Taken
- Carryover: Max 5 days from previous year
- Deletion: Employees can only delete pending requests
- Modification: Cannot modify approved/rejected requests

---

### **Phase 5: Calendar Views** 🟢 IN PROGRESS
**Ziel:** Monats-, Wochen-, Jahreskalender + Team-Kalender

**Tasks:**
- [x] Navigation & Layout
  - [x] Sidebar Component (modern, minimalistisch)
  - [x] UI Store für View-Management
  - [x] App.tsx Routing Integration
  - [x] Calendar Page Container
- [x] Calendar Utilities & Helpers
  - [x] calendarUtils.ts (getDaysInMonth, getEventColor, etc.)
  - [x] CalendarHeader Component (Today, Prev/Next, View Switcher)
  - [x] CalendarLegend Component (Color Coding)
- [x] Backend: Holidays API
  - [x] GET /api/holidays (with year filter)
  - [x] useHolidays Hook (TanStack Query)
- [x] MonthCalendar Component (✅ COMPLETE)
  - [x] Grid Layout (7 columns)
  - [x] Color-coded Events (Arbeit, Urlaub, Krank, etc.)
  - [x] Today Highlight
  - [x] Previous/Next Month Navigation
  - [x] Modern Design (soft shadows, rounded corners, smooth transitions)
  - [x] Dark Mode Support
- [ ] WeekCalendar Component (Timeline View)
  - [ ] Timeline Design (8:00-18:00 Stunden-Blöcke)
  - [ ] Drag & Drop Support (optional, später)
  - [ ] Multi-day Events spanning
  - [ ] Current Time Indicator
- [ ] YearCalendar Component (Heatmap)
  - [ ] GitHub-style Contribution Graph
  - [ ] Arbeitsintensität pro Tag visualisiert
  - [ ] Hover: Details anzeigen
  - [ ] Click: Zu Tag springen
- [ ] TeamCalendar Component (Admin only)
  - [ ] Alle Mitarbeiter auf einen Blick
  - [ ] Abwesenheiten/Verfügbarkeit
  - [ ] Filter (Abteilung)
- [ ] Additional Features (später)
  - [ ] Day View (volle Tages-Timeline 8:00-18:00)
  - [ ] Quick Edit (Klick auf Event → Inline bearbeiten)
  - [ ] Drag & Drop (Time Entries verschieben)
  - [ ] Print View (Monats-Report drucken)
  - [ ] Filter & Search
- [ ] Seed Holiday Data für Testing
- [ ] Responsive Design für alle Views
- [ ] Mobile Optimization

**Success Criteria:**
- ✅ Sidebar Navigation funktioniert
- ✅ Kalender ist sichtbar und navigierbar
- ✅ MonthCalendar zeigt Daten korrekt an
- ⏳ WeekCalendar funktioniert
- ⏳ YearCalendar funktioniert (Heatmap)
- ⏳ TeamCalendar funktioniert (Admin)
- ⏳ Feiertage werden angezeigt
- ⏳ Team-Übersicht zeigt alle Abwesenheiten
- ⏳ Mobile-optimiert

**Design Inspiration (Research):**
- ✅ Professionelle Tools analysiert: Toggl Track, Clockify, Harvest
- ✅ Best Practices identifiziert:
  - Multiple View Options (Month, Week, Year) ✅
  - Color-coded Entries ✅
  - Clean, Minimal Design ✅
  - Quick Navigation (Today, Prev/Next) ✅
  - Timeline View für Week (TODO)
  - Heatmap für Year (TODO)
  - Team Availability Overview (TODO)

**Future Enhancements (dokumentiert für später):**
- **Day View:** Volle Tages-Timeline (8:00-18:00) mit Stunden-Blöcken
- **Drag & Drop:** Time Entries per Drag & Drop verschieben (wie Toggl)
- **Quick Edit:** Klick auf Event → Inline bearbeiten (kein Modal)
- **Print View:** Monats-Report drucken für Papier-Archiv
- **Advanced Filters:** Nach Projekt, Aktivität, Location filtern
- **Export Calendar:** iCal, Google Calendar Integration

**Geschätzte Zeit:** 5-6 Stunden (begonnen)
**Bisher investiert:** ~2 Stunden
**Verbleibend:** ~3-4 Stunden

---

### **Phase 6: Dashboard & Overview** ✅ COMPLETE
**Ziel:** Persönliches + Admin Dashboard

**Tasks:**
- [x] Auth Store (Zustand) - Session Management
- [x] UI Components Foundation
  - [x] Button (variants: primary, secondary, danger, ghost)
  - [x] Input (with label, error, helper text)
  - [x] Card (Header, Title, Content, Footer)
  - [x] LoadingSpinner (size variants)
  - [x] Modal (backdrop, ESC to close, size variants)
  - [x] Select (dropdown with validation)
  - [x] Textarea (multi-line with validation)
- [x] Login Component mit Validation
- [x] App.tsx Auth-Flow (Login → Dashboard Routing)
- [x] EmployeeDashboard Component mit echten Daten
  - [x] Quick Stats Cards mit API-Daten
  - [x] Heutige Arbeitszeit (echte Daten)
  - [x] Wochenübersicht (echte Daten)
  - [x] Verbleibende Urlaubstage (echte Daten)
  - [x] Überstunden-Saldo (echte Daten)
  - [x] Recent Entries Liste (letzte 5 Einträge)
  - [x] Schnellzugriff Buttons mit Modal-Integration
  - [x] Notification Bell im Header
- [x] AdminDashboard Component mit echten Daten
  - [x] Mitarbeiteranzahl (active only)
  - [x] Heute im Dienst (Count)
  - [x] Offene Anträge mit Approve/Reject Actions
  - [x] Monatsstatistik (Stunden)
  - [x] Team-Übersicht mit Status-Indikatoren
  - [x] Schnellzugriff Buttons
  - [x] Notification Bell im Header
- [x] TanStack Query Hooks (API Integration)
  - [x] useTimeEntries (+ useTodayTimeEntries, useWeekTimeEntries)
  - [x] useAbsenceRequests (+ usePendingAbsenceRequests)
  - [x] useVacationBalance (+ useCurrentVacationBalance, useRemainingVacationDays)
  - [x] useOvertimeBalance (+ useTotalOvertime)
  - [x] useUsers (+ useActiveEmployees)
  - [x] useNotifications (+ useUnreadNotifications)
  - [x] CRUD Mutations (Create, Update, Delete, Approve, Reject)
- [x] Utility Functions
  - [x] timeUtils: calculateHours, formatHours, formatOvertimeHours, date helpers
  - [x] validation: email, time, date, password validation
- [x] Time Entry Components
  - [x] TimeEntryForm (vollständig mit Validation, Preview, Integration)
- [x] Absence Request Components
  - [x] AbsenceRequestForm (vollständig mit Balance-Check, Auto-Approval Info)
  - [x] AbsenceApproval (Admin) - bereits in AdminDashboard integriert
- [x] Notifications System UI
  - [x] NotificationBell Component mit Dropdown
  - [x] Badge mit Unread Count
  - [x] Mark as Read / Delete Actions
  - [x] Mark All as Read Action
  - [x] Type-specific Icons
  - [x] Auto-refetch every 30s

**Success Criteria:**
- ✅ Login-Flow funktioniert
- ✅ Role-based Routing (Admin vs Employee)
- ✅ Mitarbeiter sieht eigene Daten auf einen Blick
- ✅ Admin sieht Team-Übersicht
- ✅ Echte API-Daten in Dashboards
- ✅ Loading States überall
- ✅ Toast Notifications für Feedback
- ✅ User können Zeit erfassen (TimeEntryForm)
- ✅ User können Urlaub/Krank beantragen (AbsenceRequestForm)
- ✅ Admin kann Anträge genehmigen/ablehnen (inline in Dashboard)
- ✅ Benachrichtigungen UI mit Bell-Icon und Dropdown
- ⏳ Real-time Updates via WebSocket (optional, nicht Teil von Phase 6)

**Commits:**
- 1140bb4 (2025-10-31) - Foundation (Auth, UI Components, Login)
- 48668ca (2025-10-31) - Data Integration (TanStack Query Hooks, Real Data)
- 8a76943 (2025-10-31) - Forms (TimeEntry, AbsenceRequest, Modal/Select/Textarea)
- 1307884 (2025-10-31) - Notifications UI (Bell, Dropdown, Actions)

**Status:** ✅ 100% COMPLETE! Production-ready Dashboard System
**Geschätzte Zeit:** 5-6 Stunden (completed)

**Optional Future Enhancements (not required for Phase 6):**
- TimeEntryList (separate Ansicht aller Einträge mit Edit/Delete)
- AbsenceRequestList (separate Ansicht aller Anträge)
- WebSocket für Real-time Updates (aktuell: Auto-Refetch alle 30s)

---

### **Phase 6.5: Tauri Production-Ready** ✅ COMPLETE
**Ziel:** Desktop-App production-ready machen mit System Tray, Notifications, HTTP Plugin

**Tasks:**
- [x] **Tauri HTTP Plugin** (tauri-plugin-http)
  - [x] Installation: Rust Dependency + Frontend Package
  - [x] Universal Fetch Wrapper (desktop/src/lib/tauriHttpClient.ts)
  - [x] Auto-detect Tauri vs Browser
  - [x] HttpOnly Cookie Support
  - [x] Integration in API Client
- [x] **System Tray Integration**
  - [x] Cargo.toml: `tray-icon` Feature hinzufügen
  - [x] Rust Implementation (desktop/src-tauri/src/lib.rs)
  - [x] Tray Menu: "Anzeigen", "Verstecken", "Beenden"
  - [x] Linksklick: Fenster anzeigen
  - [x] Rechtsklick: Menü öffnen
- [x] **Native Notifications**
  - [x] Installation: tauri-plugin-notification
  - [x] Frontend Helper Functions (desktop/src/lib/notifications.ts)
  - [x] Permission Management
  - [x] Notification Types: Absence Requests, Overtime, Reminders
- [x] **Authentication Fixes für Tauri**
  - [x] Server Response Format Fix ({data: {user}})
  - [x] CORS: tauri://localhost Origin hinzufügen
  - [x] Session Cookies: secure: false für localhost
- [x] **Debug Tools**
  - [x] DebugPanel Component (desktop/src/components/DebugPanel.tsx)
  - [x] Real-time API Request/Response Logging
  - [x] HTTP Method, URL, Status, Data Display
- [x] **Production Configuration**
  - [x] tauri.conf.json: Metadata aktualisieren
  - [x] Product Name, Version, Bundle ID
  - [x] Publisher, Copyright, Category
- [x] **Dokumentation**
  - [x] TAURI_DEPLOYMENT.md erstellen
  - [x] Prerequisites (macOS, Windows, Linux)
  - [x] Development Setup
  - [x] Production Build Guide
  - [x] Known Issues & Solutions
  - [x] Distribution Guide

**Success Criteria:**
- ✅ Login funktioniert mit Tauri HTTP Plugin
- ✅ HttpOnly Cookies werden persistent gespeichert
- ✅ System Tray Icon in Menüleiste sichtbar
- ✅ Tray Menu funktioniert (Anzeigen/Verstecken/Beenden)
- ✅ Native Notifications konfiguriert
- ✅ Debug Panel zeigt API Calls
- ✅ CORS für Tauri Origins konfiguriert
- ✅ Production Metadata vollständig
- ✅ Multi-User Funktionalität bleibt erhalten

**Commits:**
- [Commit Hash] (2025-10-31) - Tauri HTTP Plugin + Auth Fixes
- [Commit Hash] (2025-10-31) - System Tray + Native Notifications
- [Commit Hash] (2025-10-31) - TAURI_DEPLOYMENT.md + Debug Panel

**Abgeschlossen:** 2025-10-31
**Status:** ✅ COMPLETE
**Geschätzte Zeit:** 4 Stunden
**Tatsächliche Zeit:** ~3 Stunden

**Implementierte Files:**
- `desktop/src-tauri/Cargo.toml` - Rust Dependencies (tray-icon, tauri-plugin-notification)
- `desktop/src-tauri/src/lib.rs` - System Tray + Notification Plugin Init
- `desktop/src/lib/tauriHttpClient.ts` - Universal Fetch Wrapper
- `desktop/src/lib/notifications.ts` - Native Notification Helpers
- `desktop/src/components/DebugPanel.tsx` - API Debug Panel
- `desktop/src/api/client.ts` - Tauri HTTP Integration
- `server/src/routes/auth.ts` - Response Format Fix
- `server/src/server.ts` - CORS + Session Config
- `TAURI_DEPLOYMENT.md` - Complete Deployment Guide

**Tech Stack:**
- **@tauri-apps/plugin-http** v2.5.4 - HttpOnly Cookie Support
- **@tauri-apps/plugin-notification** v2.3.3 - Native Notifications
- **tauri tray-icon** v0.21.2 - System Tray Integration
- **mac-notification-sys** v0.6.8 - macOS Native Notifications
- **notify-rust** v4.11.7 - Cross-platform Notifications

**Known Issues (Gelöst):**
- ~~Browser fetch() funktioniert nicht mit HttpOnly Cookies in Tauri~~ → Gelöst mit tauri-plugin-http
- ~~CORS Errors von tauri://localhost~~ → Gelöst durch CORS Origin Konfiguration
- ~~Session Cookies nicht persistent~~ → Gelöst mit Universal Fetch Wrapper
- ~~Response Format Mismatch~~ → Gelöst durch Server Response Format Fix

---

### **Phase 7: Management UI Pages** ✅ COMPLETE
**Ziel:** Dedizierte Pages für Time Entries, Users, Absences Management

**WICHTIG:** Backend APIs sind bereits komplett (Phase 1-4). Diese Phase implementiert nur die fehlenden Frontend-UIs!

**Abgeschlossen:** 2025-10-31
**Commits:** cd3c72a, 18ceb28, 64ba613, 224aa28, 6306c3a, 3e97d97, 0dcfbe1
**Tatsächliche Zeit:** ~6.5 Stunden (inkl. Bugfixes)
**Geschätzte Zeit:** 10-13 Stunden

#### **7.1 Time Entry Management Page** ✅ COMPLETE
**Backend Status:** ✅ Komplett (GET/POST/PUT/DELETE `/api/time-entries`)
**Ziel:** Dedizierte Seite zur Verwaltung aller Zeiteinträge

**Tasks:**
- [x] `pages/TimeEntriesPage.tsx` erstellen
- [x] `components/timeEntries/EditTimeEntryModal.tsx` - Eintrag bearbeiten
- [x] Filter & Search Functionality
  - [x] Nach Monat (month input)
  - [x] Nach Location (Büro/Home Office/Außendienst)
  - [x] Nach Datum (date search)
- [x] Sortierung (Datum, Stunden) mit Toggle asc/desc
- [x] CSV Export (alle gefilterten Einträge)
- [x] Statistiken (Gesamt-Stunden, Durchschnitt, Nach Ort)
- [x] Edit/Delete Actions (mit Permission Check)
- [x] Role-based View (Admin: alle, Employee: eigene)

**Success Criteria:**
- ✅ Mitarbeiter sieht alle eigenen Zeiteinträge
- ✅ Admin sieht Zeiteinträge aller Mitarbeiter
- ✅ Filter funktionieren (Monat, Location, Datum)
- ✅ Edit/Delete mit Permission Check (Backend handled)
- ✅ CSV Export funktioniert
- ✅ Responsive Design (Tailwind grid)
- ✅ Dark Mode Support
- ✅ Sortierung funktioniert (Datum, Stunden)
- ✅ Statistik-Cards zeigen korrekte Daten
- ✅ Table mit Hover-States

**Abgeschlossen:** 2025-10-31
**Commits:** cd3c72a
**Tatsächliche Zeit:** ~2 Stunden
**Geschätzte Zeit:** 3-4 Stunden

---

#### **7.2 User Management Page (Admin)** ✅ COMPLETE
**Backend Status:** ✅ Komplett (GET/POST/PUT/DELETE `/api/users`, `/api/departments`, `/api/projects`)
**Ziel:** Admin-Interface zur Mitarbeiterverwaltung

**Tasks:**
- [x] `pages/UserManagementPage.tsx` erstellen
- [x] `components/users/CreateUserModal.tsx` - Neuen Mitarbeiter anlegen
- [x] `components/users/EditUserModal.tsx` - Mitarbeiter bearbeiten
- [x] User Actions
  - [x] Create User (Formular mit Validation)
  - [x] Edit User (alle Felder änderbar außer Username)
  - [x] Delete User (Soft Delete mit Bestätigung)
  - [x] Role ändern (Admin ↔ Employee)
  - [x] Urlaubskontingent setzen
  - [x] Wochenstunden setzen
  - [x] Aktiv/Inaktiv Toggle
- [x] Search & Filter
  - [x] Nach Name/E-Mail/Username suchen
  - [x] Nach Abteilung filtern (dynamisch)
  - [x] Nach Rolle filtern (Admin/Employee)
  - [x] Nach Status (Aktiv / Alle inkl. Gelöschte)
- [x] Statistiken
  - [x] Gesamt-Benutzer
  - [x] Admins vs. Mitarbeiter
  - [x] Aktiv vs. Inaktiv

**Success Criteria:**
- ✅ Admin kann Mitarbeiter anlegen/bearbeiten/löschen
- ✅ Urlaubskontingent & Wochenstunden änderbar
- ✅ Rolle ändern funktioniert
- ✅ Validation funktioniert (Email, Password, Pflichtfelder)
- ✅ Search/Filter funktionieren
- ✅ Responsive Design
- ✅ Dark Mode Support
- ✅ Permission Check (nur Admin-Zugriff)
- ✅ Self-Protection (Admin kann sich nicht selbst löschen)
- ✅ Department Filter (dynamisch basierend auf Daten)

**Abgeschlossen:** 2025-10-31
**Commits:** 64ba613
**Tatsächliche Zeit:** ~2.5 Stunden
**Geschätzte Zeit:** 4-5 Stunden

---

#### **7.3 Absence Management Page** ✅ COMPLETE
**Backend Status:** ✅ Komplett (GET/POST/PUT/PATCH `/api/absences`)
**Ziel:** Übersicht aller Abwesenheiten (eigene + Team)

**Tasks:**
- [x] `pages/AbsencesPage.tsx` erstellen
- [x] Inline Table implementation (kein separates Component nötig)
- [x] Employee View
  - [x] Eigene Anträge (approved, pending, rejected)
  - [x] Status-Filter (Alle/Genehmigt/Ausstehend/Abgelehnt)
  - [x] Delete (nur pending)
- [x] Admin View
  - [x] Alle Anträge aller Mitarbeiter
  - [x] Filter nach Mitarbeiter (dynamisch)
  - [x] Filter nach Status
  - [x] Filter nach Type (Urlaub/Krank/Unbezahlt/Überstundenausgleich)
  - [x] Approve/Reject Actions mit Grund-Eingabe
- [x] Statistiken
  - [x] Gesamt-Anträge
  - [x] Ausstehend
  - [x] Genehmigt
  - [x] Abgelehnt
- [x] Rejection Reason Display (adminNote)
- [x] Status Badges mit Icons (Clock, CheckCircle, XCircle)
- [x] Sidebar Integration (Umbrella Icon)
- [x] Dark Mode Support

**Success Criteria:**
- ✅ Mitarbeiter sieht alle eigenen Anträge
- ✅ Admin sieht alle Anträge aller Mitarbeiter
- ✅ Filter funktionieren (Status, Type, Mitarbeiter)
- ✅ Delete nur für pending Anträge
- ✅ Approve/Reject Actions (Admin)
- ✅ Statistiken zeigen korrekte Daten
- ✅ Responsive Design

**Abgeschlossen:** 2025-10-31
**Commits:** 6306c3a
**Tatsächliche Zeit:** ~2 Stunden
**Geschätzte Zeit:** 3-4 Stunden

**Hinweis:** Timeline View und Bulk Approve wurden als optional markiert und nicht implementiert (YAGNI Prinzip)

---

**Phase 7 Gesamt:**
- **Geschätzte Zeit:** 10-13 Stunden
- **Priorät:** HOCH (Backend fertig, nur UI fehlt!)
- **Abhängigkeiten:** Keine (kann sofort starten)

**Wichtig:**
- Diese Phase implementiert KEINE neuen Backend-APIs
- Alle APIs sind bereits in Phase 1-4 gebaut
- Fokus liegt ausschließlich auf Frontend UI
- Forms (TimeEntryForm, AbsenceRequestForm) existieren bereits im Dashboard
- Diese Phase baut die Management/List Views

---

### **Phase 8: Reports & Export** ✅ COMPLETE
**Ziel:** Monatsberichte, Überstunden, Export

**Tasks:**
- [x] ReportsPage erstellen
- [x] MonthlyReport (Stunden pro Mitarbeiter)
- [x] OvertimeReport Statistics
- [x] AbsenceReport (Kranktage, Urlaubstage)
- [x] CSV Export
- [x] Filter: Monat, Mitarbeiter (Admin)
- [x] Role-based Views (Admin: alle, Employee: eigene)
- [x] Statistics Cards (Gesamtstunden, Arbeitstage, Ø, Abwesenheiten)
- [x] Dark Mode Support

**Success Criteria:**
- ✅ Reports zeigen korrekte Daten
- ✅ CSV Export funktioniert
- ✅ Admin kann Reports filtern
- ✅ Role-based Access Control

**Abgeschlossen:** 2025-10-31
**Commits:** 1c0075a
**Tatsächliche Zeit:** ~2 Stunden
**Geschätzte Zeit:** 4-5 Stunden

**Hinweis:** PDF Export und Recharts (Grafiken) wurden als optional markiert und nicht implementiert (YAGNI Prinzip - CSV Export reicht für jetzt)

---

### **Phase 9: UI/UX Polish** 🔴 NOT STARTED
**Ziel:** Desktop-Optimierung, Accessibility, User Experience

**WICHTIG:** Dies ist eine **Desktop-App** (Tauri), keine Mobile-App!
- Keine Mobile-Optimierung nötig
- Fokus auf Desktop-UX (Windows, macOS, Linux)

**Tasks:**
- [ ] Loading States überprüfen (alle API Calls)
- [ ] Error States überprüfen (Fehlerbehandlung)
- [ ] Empty States überprüfen (keine Daten vorhanden)
- [ ] Keyboard Navigation testen
  - [ ] Tab-Navigation funktioniert
  - [ ] Enter/Escape in Modals
  - [ ] Shortcuts (z.B. Ctrl+S für Save)
- [ ] ARIA Labels für Screen Reader
- [ ] Farbkontrast-Check (WCAG AA)
- [ ] Form Validation Messages
- [ ] Success Toasts (nach Actions)
- [ ] Window Resize Handling (min. 1024x600)

**Success Criteria:**
- ✅ Loading/Error/Empty States überall vorhanden
- ✅ Keyboard-Navigation funktioniert
- ✅ Screen Reader kompatibel (ARIA)
- ✅ Farbkontrast WCAG AA konform
- ✅ App funktioniert bei min. Window-Größe (1024x600)

**Geschätzte Zeit:** 2-3 Stunden

---

### **Phase 10: Testing & Bug Fixes** 🔴 NOT STARTED
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

### **Phase 11: Deployment Preparation** 🔴 NOT STARTED
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

### **Phase 12: GitHub Releases & Auto-Update** 🔴 NOT STARTED
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

| Phase | Geschätzte Zeit | Tatsächliche Zeit | Status |
|-------|-----------------|-------------------|--------|
| Phase 0: Setup + Tauri Installation | 1-2h | ~2h | ✅ COMPLETE |
| Phase 1: Backend Foundation | 4h | ~2h | ✅ COMPLETE |
| Phase 2: User Management | 5h | ~1.5h | ✅ COMPLETE |
| Phase 3: Time Tracking | 6h | ~3h | ✅ COMPLETE (Backend) |
| Phase 4: Absence Management | 7h | ~4h | ✅ COMPLETE (Backend) |
| Phase 5: Calendar Views | 6h | - | 🔴 NOT STARTED |
| Phase 6: Dashboard | 6h | ~6h | ✅ COMPLETE |
| Phase 6.5: Tauri Production-Ready | 4h | ~3h | ✅ COMPLETE |
| Phase 7: Reports & Export | 5h | - | 🔴 NOT STARTED |
| Phase 8: UI/UX Polish + Desktop Features | 5h | - | 🔴 NOT STARTED |
| Phase 9: Testing | 5h | - | 🔴 NOT STARTED |
| Phase 10: Deployment (Server + Desktop Builds) | 5h | - | 🔴 NOT STARTED |
| Phase 11: GitHub Releases & Auto-Update (Tauri) | 6-8h | - | 🔴 NOT STARTED |
| **TOTAL** | **~65-75 Stunden** | **~21.5h** (von 75h) | **29% Complete** |

**Realistisch mit Buffer:** 65-75 Stunden
**Bereits investiert:** ~21.5 Stunden
**Verbleibend:** ~43.5-53.5 Stunden

**Produktiver als geplant:** Backend-Phasen waren ~30% schneller als geschätzt dank strukturierter Planung!

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
