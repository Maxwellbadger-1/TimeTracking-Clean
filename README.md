# ⏱️ TimeTracking System - Enterprise Zeiterfassung

**Production-ready Multi-User Zeiterfassungssoftware mit Cloud-Backend**

> 💡 **Download → Install → Loslegen** • 🚀 **Multi-User ready** • ☁️ **Cloud-basiert**

[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge&logo=github)](https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)](https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/latest)

---

## 🎯 Features

### ✅ Zeiterfassung
- **Manuelle Zeiterfassung** (Start/Ende/Pause)
- **Arbeitsort-Tracking** (Büro, Home-Office, Außendienst)
- **Projekt- und Aktivitätszuordnung**
- **Automatische Stundenberechnung**
- **Überstunden-Tracking & Überstundenabbau**
- **Sollstunden-Verwaltung** (pro Benutzer individuell)

### ✅ Abwesenheiten
- **Urlaubsanträge** mit Admin-Genehmigung
- **Krankmeldungen** (mit/ohne Attest)
- **Überstundenausgleich**
- **Sonderurlaub & Unbezahlter Urlaub**
- **Desktop-Benachrichtigungen** bei Status-Änderungen
- **Automatische Urlaubstage-Berechnung**

### ✅ Kalender & Berichte
- **Kalenderansichten**: Monat, Woche, Jahr, Team
- **Feiertage-Verwaltung** (automatisch & manuell)
- **Stunden-Reports** mit CSV Export
- **Team-Übersicht** (nur Admin)
- **Individuelle Statistiken** (Soll/Ist, Überstunden, Urlaub)

### ✅ Multi-User & Cloud
- **Oracle Cloud Backend** (Frankfurt)
- **Echtzeit-Synchronisation** aller Clients
- **Zero-Configuration** - keine IT-Setup nötig!
- **Role-based Access** (Admin/Employee)
- **Parallele Nutzung** durch mehrere User

### ✅ Desktop-App Features
- **Tauri 2.x** (~15 MB statt 100+ MB bei Electron)
- **Native Performance** (Rust Backend)
- **System Tray Integration**
- **Dark Mode** (automatisch & manuell)
- **Keyboard Shortcuts**
- **Auto-Update System** (kryptografisch signiert)

### ✅ Admin-Features
- **Benutzerverwaltung** (Erstellen, Bearbeiten, Deaktivieren)
- **Überstunden-Verwaltung** (Manuelles Hinzufügen/Entfernen)
- **Urlaubstage-Verwaltung** (Resturlaub, Vorjahresurlaub)
- **Abwesenheits-Genehmigung** (Genehmigen/Ablehnen)
- **Team-Dashboard** mit Übersicht aller Mitarbeiter
- **Backup & Restore** System

---

## 🚀 Quick Start (für Endbenutzer)

### 1️⃣ Download

**[📥 Download Latest Release](https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/latest)**

- **Windows:** `TimeTracking-System_1.0.1_x64-en-US.msi`
- **macOS:** `TimeTracking-System_1.0.1_universal.dmg` (Intel + Apple Silicon)
- **Linux:** `time-tracking-system_1.0.1_amd64.AppImage`

### 2️⃣ Installation

1. **Doppelklick** auf Installer
2. **"Installieren"** klicken
3. **App öffnen**
4. **Login** mit deinen Zugangsdaten
5. **Fertig!** 🎉

Die App verbindet sich automatisch mit dem Oracle Cloud Server - **keine weitere Konfiguration nötig!**

### 3️⃣ Multi-User

**Alle weiteren Benutzer:**
1. Download & Installation wie oben
2. Login mit vom Admin angelegten Zugangsdaten
3. **Das war's!** - Mehrere User können parallel arbeiten

---

## 💡 Architektur

### Cloud-First Design (wie Slack/Teams)

```
Desktop-App (Windows)        Desktop-App (macOS)        Desktop-App (Linux)
┌──────────────┐             ┌──────────────┐          ┌──────────────┐
│ TimeTracking │             │ TimeTracking │          │ TimeTracking │
│   Client     │             │   Client     │          │   Client     │
└──────┬───────┘             └──────┬───────┘          └──────┬───────┘
       │                            │                         │
       └────────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                         ☁️ Oracle Cloud Server
                         (Frankfurt, Germany)
                         ┌──────────────────────┐
                         │ Node.js + Express    │
                         │ SQLite Database      │
                         │ WebSocket (Real-time)│
                         └──────────────────────┘
```

**✅ Zero Configuration** • **✅ Automatische Verbindung** • **✅ Immer verfügbar**

---

## 🛠️ Tech Stack

### Frontend (Desktop-App)
- **Tauri 2.x** - Desktop Framework (Rust)
- **React 18** - UI Framework
- **TypeScript** - Type Safety (strict mode)
- **TanStack Query v5** - Server State Management
- **Zustand** - UI State Management
- **Tailwind CSS 4** - Styling
- **Lucide React** - Icons
- **Sonner** - Toast Notifications

### Backend (Oracle Cloud)
- **Node.js 20** - Runtime
- **Express** - REST API Server
- **SQLite** - Database (WAL mode für Multi-User)
- **Bcrypt** - Password Hashing (10 rounds)
- **WebSocket** - Real-time Updates
- **PM2** - Process Manager

### DevOps & Deployment
- **GitHub Actions** - CI/CD Pipeline
- **Tauri Bundler** - Cross-platform Builds
- **Auto-Updater** - Seamless Updates (minisign)
- **Oracle Cloud** - Free Tier Hosting (Frankfurt)

---

## 📊 System Requirements

### Desktop-App (Client)
- **OS:** Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **RAM:** 2 GB
- **Speicher:** 100 MB
- **Internet:** Verbindung zum Oracle Server

### Server (bereits deployed auf Oracle Cloud)
- **OS:** Ubuntu 22.04 LTS
- **RAM:** 1 GB (Oracle Free Tier)
- **Speicher:** 50 GB
- **Netzwerk:** Stabile Internetverbindung

---

## 👨‍💻 Entwicklung

### Requirements

- **Node.js** v20.19.5 (LTS)
- **npm** 10.8.2+
- **Rust** 1.90+ (für Tauri)
- **Git**

### Projekt Setup

```bash
# Repository klonen
git clone https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
cd TimeTracking-Clean

# Dependencies installieren
npm install
```

### Development Mode

**Einfach mit einem Befehl:**

```bash
./SIMPLE-START.sh
```

Startet automatisch:
1. Backend Server (Port 3000)
2. Desktop App mit Vite Dev Server (Port 1420)

**Oder manuell:**

```bash
# Terminal 1: Backend Server
cd server
npm run dev

# Terminal 2: Desktop App
cd desktop
npm run tauri dev
```

### Production Build

```bash
# Desktop-App bauen (lokal)
cd desktop
npm run tauri build
```

**Output:**
- **Windows:** `desktop/src-tauri/target/release/bundle/nsis/*.msi`
- **macOS:** `desktop/src-tauri/target/release/bundle/dmg/*.dmg`
- **Linux:** `desktop/src-tauri/target/release/bundle/appimage/*.AppImage`

**Oder automatisch via GitHub Actions:**
1. Tag erstellen: `git tag v1.0.2`
2. Pushen: `git push origin v1.0.2`
3. GitHub Actions baut für alle Plattformen
4. Draft Release wird automatisch erstellt

---

## 🔒 Sicherheit

### Built-in Security Features

✅ **Bcrypt Password Hashing** (10 rounds, Salt)
✅ **HttpOnly Session Cookies** (XSS Protection)
✅ **HTTPS** (Oracle Cloud)
✅ **SQL Injection Protection** (Prepared Statements)
✅ **Role-based Access Control** (RBAC)
✅ **Input Validation** (Frontend + Backend)
✅ **Audit Log** (alle kritischen Aktionen)
✅ **Auto-Update Signing** (minisign, cryptographically secure)

### Datenschutz

- ✅ **Server in Deutschland** (Oracle Cloud Frankfurt)
- ✅ **Keine externen Services** (außer Update-Checks)
- ✅ **Kein Tracking**
- ✅ **Open Source** (vollständig einsehbar)
- ✅ **DSGVO-konform**

---

## 📖 Dokumentation

- **[Oracle Cloud Setup](ORACLE_CLOUD_SETUP.md)** - Server Deployment Guide
- **[Production Deployment](DEPLOYMENT-PRODUCTION.md)** - Production Checklist
- **[Development Guidelines](.claude/CLAUDE.md)** - Code Standards & Best Practices

---

## 🗺️ Status & Roadmap

### ✅ **v1.0 - Production Ready!**

**Core Features:**
- [x] Backend API (REST + WebSocket)
- [x] User Management (CRUD, Roles)
- [x] Time Tracking (Manuelle Erfassung)
- [x] Absence Management (Urlaub, Krankheit)
- [x] Überstunden-System (Tracking & Ausgleich)
- [x] Kalender (Monat/Woche/Jahr/Team)
- [x] Reports & Export (CSV)
- [x] Dark Mode
- [x] Keyboard Shortcuts
- [x] Desktop Notifications

**Production:**
- [x] Oracle Cloud Deployment
- [x] GitHub Actions CI/CD
- [x] Auto-Update System
- [x] Cross-platform Builds
- [x] Security Hardening
- [x] Audit Logging

### 🔮 **v2.0 - Future (optional)**

- [ ] Mobile Apps (iOS/Android via Tauri Mobile)
- [ ] Biometric Time Tracking (NFC/QR)
- [ ] Advanced Analytics & Charts
- [ ] Export: PDF Reports
- [ ] API für Drittanbieter
- [ ] Slack/Teams Integration
- [ ] Multi-Tenant (mehrere Organisationen)

---

## 🤝 Mitwirken

Contributions sind willkommen!

1. **Fork** das Repository
2. **Feature Branch** erstellen (`git checkout -b feature/amazing-feature`)
3. **Änderungen committen** (`git commit -m 'Add amazing feature'`)
4. **Pushen** (`git push origin feature/amazing-feature`)
5. **Pull Request** öffnen

**Bitte beachte:**
- [Development Guidelines](.claude/CLAUDE.md)
- TypeScript strict mode
- Code Style (ESLint + Prettier)
- Keine `any` Types
- Tests für neue Features

---

## 📝 Lizenz

Dieses Projekt ist unter der **MIT Lizenz** lizenziert.

---

## 🙏 Credits & Thanks

**Frameworks & Libraries:**
- [Tauri](https://tauri.app/) - Amazing Desktop Framework
- [React](https://react.dev/) - UI Library
- [TanStack Query](https://tanstack.com/query) - Server State Management
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Lucide](https://lucide.dev/) - Beautiful Icons

**Infrastructure:**
- [Oracle Cloud](https://www.oracle.com/cloud/) - Free Tier Hosting
- [GitHub Actions](https://github.com/features/actions) - CI/CD Pipeline

---

## 📞 Support

**Bugs oder Feature-Requests?**
- 🐛 [Issue erstellen](https://github.com/Maxwellbadger-1/TimeTracking-Clean/issues/new)

**Fragen?**
- 💬 [Discussions](https://github.com/Maxwellbadger-1/TimeTracking-Clean/discussions)

**Sicherheitslücken?**
- 🔒 Bitte **NICHT** öffentlich melden! Kontaktiere die Maintainer privat.

---

<div align="center">

**Made with ❤️ using Tauri, React, and TypeScript**

🌟 **Star dieses Repo wenn es dir gefällt!** 🌟

</div>
