# 🎯 Context für neuen Chat: Stiftung der DPolG TimeTracker

**Projekt:** Stiftung der DPolG - Zeiterfassung Plus
**Offizieller Name:** "Stiftung der DPolG TimeTracker"
**Entwickler:** Maxflow Software
**Datum:** 2025-10-31
**Projekt-Ordner:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean`
**Status:** Planning Phase abgeschlossen, bereit für Phase 0 (Setup)

---

## 📋 Was bisher geschah

### Altes Projekt (NICHT MEHR NUTZEN!)
- **Ordner:** `/Users/maximilianfegg/Desktop/Stiftung der DPolG Arbeitszeiterfassung.nosynch`
- **Problem:** Zu viele Bugs, Regression, Code-Chaos, inkonsistente Architektur
- **Entscheidung:** **Kompletter Neuaufbau** mit professionellem Ansatz

### Neues Projekt (HIER ARBEITEN!)
- **Ordner:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean`
- **Status:** Komplett neu, sauber, professionell geplant
- **Dateien vorhanden:**
  - ✅ `.claude/CLAUDE.md` - **ALLE Regeln für Claude AI**
  - ✅ `IMPLEMENTATION_PLAN.md` - **11 Phasen, 65-75h Aufwand**
  - ✅ `CONTEXT_FOR_NEW_CHAT.md` - Diese Datei

---

## 🎯 Projektziel

**Ein modernes Tauri Desktop-App Zeiterfassungssystem für die Stiftung der DPolG**

### ⭐ KRITISCHE Architektur-Entscheidung:
- **TAURI DESKTOP-APP** - KEINE Web-App, KEIN Electron!
- **Desktop-Apps (.exe, .app, .AppImage)** verbinden sich zu **zentralem Server**
- **Multi-User:** Mehrere Desktop-Apps → Ein Server → Eine Datenbank

### Warum Tauri?
- **Klein:** ~10 MB (Electron: ~100 MB)
- **Schnell:** ~50 MB RAM (Electron: ~200 MB)
- **Modern:** Rust Backend + WebView
- **Built-in Auto-Update**
- **System Tray & Native Notifications**

### Kern-Anforderungen:
- ✅ **Desktop-App** (Windows, macOS, Linux)
- ✅ **Multi-User fähig** (privater Server, gleichzeitige Nutzung)
- ✅ **Rollen:** Admin + Mitarbeiter
- ✅ **Zeiterfassung:** Manuell + Pausen
- ✅ **Urlaubs-/Krankheitsverwaltung** mit Genehmigung
- ✅ **Überstunden-Tracking**
- ✅ **Kalender:** Monat/Woche/Jahr + Team-Übersicht
- ✅ **Reports & Export** (PDF/CSV/Excel)
- ✅ **Dashboard:** Personal + Admin
- ✅ **Benachrichtigungen** (Native OS-Benachrichtigungen!)
- ✅ **System Tray Integration**
- ✅ **GitHub Releases & Tauri Auto-Update System**
- ✅ **Modern & Intuitiv**

---

## 🏗️ Tech Stack (FESTGELEGT - NICHT ÄNDERN!)

### 🆕 Desktop Layer (TAURI)
```
- Tauri 2.x (Desktop Framework)
- Rust 1.75+ (Tauri Backend)
- System Tray Integration
- Native Notifications
- Auto-Updater (Built-in)
- Keyboard Shortcuts
- Native File Dialogs
```

### Frontend (React in Tauri WebView)
```
- React 18.3+
- TypeScript 5.7+
- Vite 6.0+
- TanStack Query v5 (Server State)
- Zustand (UI State)
- Tailwind CSS 3.4+
- Recharts (Grafiken)
- Lucide React (Icons)
- Sonner (Toasts)
- date-fns (Dates)
- @tauri-apps/api (Tauri Integration)
```

### Backend (Server)
```
- Node.js 20.x LTS
- Express.js 5.x
- TypeScript (tsx)
- better-sqlite3 (Database)
- bcrypt (Password Hashing)
- express-session (Auth)
- ws (WebSocket)
- cors
```

### Database
```
- SQLite3 mit WAL Mode (Multi-User fähig!)
- 11 Tabellen (siehe IMPLEMENTATION_PLAN.md)
```

### Deployment
```
- Server: PM2 (Process Manager)
- Server: Nginx (Reverse Proxy)
- Server: SSL/TLS (HTTPS)
- Desktop-Apps: GitHub Releases (.exe, .app, .AppImage)
- CI/CD: GitHub Actions (Multi-Platform Builds)
- Auto-Update: Tauri Updater
```

---

## 📊 Database Schema (11 Tabellen)

1. **users** - Benutzer (Admin + Mitarbeiter)
2. **time_entries** - Zeiteinträge
3. **absence_requests** - Urlaub/Krankheit/Unbezahlt/Überstunden-Ausgleich
4. **vacation_balance** - Urlaubskontingent pro Jahr
5. **overtime_balance** - Überstunden pro Monat
6. **departments** - Abteilungen
7. **projects** - Projekte
8. **activities** - Tätigkeiten-Templates
9. **holidays** - Feiertage
10. **notifications** - Benachrichtigungen
11. **audit_log** - Audit-Trail für alle Änderungen

**Komplettes Schema:** Siehe `IMPLEMENTATION_PLAN.md` ab Zeile 185

---

## 🚀 Implementation Plan (11 Phasen)

| Phase | Beschreibung | Zeit | Status |
|-------|-------------|------|--------|
| **Phase 0** | Setup & Planning | 1h | 🔴 NOT STARTED |
| **Phase 1** | Backend Foundation | 4h | 🔴 NOT STARTED |
| **Phase 2** | User Management | 5h | 🔴 NOT STARTED |
| **Phase 3** | Time Tracking | 6h | 🔴 NOT STARTED |
| **Phase 4** | Absence Management | 7h | 🔴 NOT STARTED |
| **Phase 5** | Calendar Views | 6h | 🔴 NOT STARTED |
| **Phase 6** | Dashboard | 6h | 🔴 NOT STARTED |
| **Phase 7** | Reports & Export | 5h | 🔴 NOT STARTED |
| **Phase 8** | UI/UX Polish | 4h | 🔴 NOT STARTED |
| **Phase 9** | Testing | 5h | 🔴 NOT STARTED |
| **Phase 10** | Deployment | 4h | 🔴 NOT STARTED |
| **Phase 11** | Releases & Updates | 5h | 🔴 NOT STARTED |
| **TOTAL** | | **~58h** | **Realistisch: 65-75h** |

**Details zu jeder Phase:** Siehe `IMPLEMENTATION_PLAN.md` ab Zeile 365

---

## 📝 Wichtigste Regeln (aus CLAUDE.md)

### ⚠️ NIEMALS:
- ❌ `any` Type verwenden
- ❌ SQL ohne Prepared Statements
- ❌ Regression (alte Fixes verlieren)
- ❌ Direkt coden ohne Plan
- ❌ Auf main branch arbeiten
- ❌ Neue Datenbank-Dateien erstellen
- ❌ Passwörter im Klartext
- ❌ Input nicht validieren

### ✅ IMMER:
- ✅ TypeScript strict mode
- ✅ Error Handling (Try-Catch)
- ✅ Defensive Programming (Optional Chaining, Null-Checks)
- ✅ Plan-First Approach ("think hard")
- ✅ Git Branching pro Phase
- ✅ Tests schreiben
- ✅ `/clear` zwischen Phasen
- ✅ Pre-Commit Checklist

### 🔄 Workflow pro Phase:
```
1. Branch erstellen (git checkout -b phase-X-feature)
2. Plan erstellen (mit "think hard")
3. User reviewed Plan
4. Implementation (Backend → Frontend)
5. Testing
6. Merge (git merge)
7. /clear (Context clearen!)
```

---

## 🎯 Nächste Schritte (für neuen Chat)

### **START: Phase 0 - Setup**

**Was der neue Chat tun soll:**

1. **Context laden**
   ```
   User sagt: "Lies CLAUDE.md und IMPLEMENTATION_PLAN.md"
   ```

2. **Phase 0 starten**
   ```
   User sagt: "GO Phase 0" oder "Start Phase 0"
   ```

3. **Phase 0 Tasks (TAURI SETUP!):**
   - [ ] Git Repository initialisieren
   - [ ] `.gitignore` erstellen (node_modules, target/, dist/, database.db)
   - [ ] **Rust Toolchain installieren** (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
   - [ ] **Tauri CLI installieren** (`npm install -g @tauri-apps/cli`)
   - [ ] **Tauri Projekt initialisieren** (`npm create tauri-app`)
   - [ ] Projekt-Struktur anlegen (src-tauri/, src/, server/)
   - [ ] `package.json` Setup (Frontend + Server)
   - [ ] **Tauri Configuration** (tauri.conf.json)
   - [ ] TypeScript Konfiguration (strict mode!)
   - [ ] ESLint + Prettier Setup
   - [ ] Tailwind CSS Setup
   - [ ] README.md erstellen

4. **Success Criteria Phase 0:**
   - ✅ Git initialisiert mit .gitignore
   - ✅ **Rust Toolchain installiert** (`rustc --version`)
   - ✅ **Tauri CLI funktioniert** (`cargo tauri --version`)
   - ✅ **Desktop-App startet** (`npm run tauri dev`)
   - ✅ Ordnerstruktur existiert (src-tauri/, src/, server/)
   - ✅ TypeScript kompiliert ohne Fehler
   - ✅ ESLint + Prettier funktionieren

5. **Nach Phase 0:**
   - Merge auf main
   - Tag erstellen: `git tag v0.1.0-setup`
   - `/clear` verwenden
   - Phase 1 starten

---

## 🔧 Environment Setup

### Node.js Version
```bash
node --version
# v20.19.5 (via nvm)

export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
```

### VS Code
- Öffnen: `/Users/maximilianfegg/Desktop/TimeTracking-Clean`

### Extensions (empfohlen)
- ESLint
- Prettier
- TypeScript + JavaScript
- Tailwind CSS IntelliSense
- SQLite Viewer

---

## 📚 Wichtige Dateien zum Lesen

### CLAUDE.md (`.claude/CLAUDE.md`)
**Inhalt:**
- Workflow mit Claude (Plan-First, think hard, Sub-Agents)
- SOLID Principles
- Code-Qualitäts-Regeln
- Database-Regeln
- Testing-Strategie
- Sicherheits-Regeln
- UI/UX Regeln
- API Design
- State Management
- Datums-Handling
- WebSocket
- GitHub Releases & Auto-Update
- Verbote & Checklisten

**Wichtigkeit:** ⭐⭐⭐⭐⭐ (KRITISCH!)

### IMPLEMENTATION_PLAN.md
**Inhalt:**
- Requirements Summary
- Tech Stack
- Architecture Pattern
- Database Schema (komplett!)
- Projekt-Struktur
- 11 Phasen mit Tasks
- Zeitschätzungen
- Development Workflow
- Security Considerations

**Wichtigkeit:** ⭐⭐⭐⭐⭐ (KRITISCH!)

---

## ⚡ Quick Commands für neuen Chat

```bash
# Projekt-Ordner öffnen
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

# VS Code öffnen
code .

# Git Status
git status

# Node Version prüfen
node --version

# Dependencies installieren (nach Setup)
npm install

# Server starten (nach Setup)
npm run server  # Backend
npm run dev     # Frontend
```

---

## 🚨 Häufige Probleme & Lösungen

### Problem: "Alte Prozesse laufen noch"
```bash
# Alle Node-Prozesse killen
pkill -9 node

# Prüfen ob weg
ps aux | grep node
```

### Problem: "Port bereits belegt"
```bash
# Port 3000 freigeben (Backend)
lsof -ti:3000 | xargs kill -9

# Port 5173 freigeben (Frontend)
lsof -ti:5173 | xargs kill -9
```

### Problem: "TypeScript Fehler"
```bash
# TypeScript Check
npx tsc --noEmit

# Strict Mode ist PFLICHT!
```

---

## 💡 Best Practices für neuen Chat

### 1. **Immer Plan-First!**
```
❌ FALSCH: "Bau Feature X"
✅ RICHTIG: "think hard - Erstelle Plan für Feature X"
```

### 2. **Context Management**
```
- /clear nach jeder Phase
- Keine Vermischung von Kontexten
```

### 3. **Git Workflow**
```
- IMMER neue Branch pro Feature
- NIEMALS direkt auf main
- Descriptive Commit Messages
```

### 4. **Testing**
```
- Manuell testen nach jedem Feature
- Edge Cases prüfen
- Desktop-App Console checken (DevTools in Tauri)
- Tauri Commands testen
```

### 5. **Code Review**
```
- Pre-Commit Checklist durchgehen
- TypeScript kompiliert? (Frontend + Backend)
- Rust kompiliert? (Tauri)
- Keine any Types?
- Error Handling vorhanden?
```

---

## 🎯 Ziel des neuen Chats

**Starte mit Phase 0 (Tauri Setup) und arbeite dich durch alle 11 Phasen.**

**Pro Phase:**
1. Branch erstellen
2. Plan mit "think hard"
3. User-Approval
4. Implementation (Tauri → Backend → Frontend)
5. Testing
6. Merge
7. `/clear`

**Am Ende:**
- Production-ready TimeTracking **Desktop-App**
- **Desktop-Apps:** Windows .exe, macOS .app, Linux .AppImage
- **Server** deployed auf privatem Server
- **GitHub Releases** mit Multi-Platform Builds
- **Tauri Auto-Update** funktioniert
- **System Tray & Native Notifications** aktiv

---

## 📞 Erste Nachricht im neuen Chat

**Kopiere das:**

```
Hallo! Ich möchte mit Phase 0 des TimeTracking Systems starten.

Bitte lies zuerst:
1. .claude/CLAUDE.md (alle Regeln)
2. IMPLEMENTATION_PLAN.md (11 Phasen)
3. CONTEXT_FOR_NEW_CHAT.md (dieser Context)

Dann erstelle einen detaillierten Plan für Phase 0 (Setup) mit "think hard".

Projekt-Ordner: /Users/maximilianfegg/Desktop/TimeTracking-Clean
```

---

**Viel Erfolg!** 🚀

**Letzte Aktualisierung:** 2025-10-30
**Version:** 1.0
