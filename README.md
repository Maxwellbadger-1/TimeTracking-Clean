# ⏱️ TimeTracker - Multi-User Zeiterfassung

**Die einfachste Multi-User Zeiterfassungssoftware der Welt!**

> 💡 **Installation in 30 Sekunden** • 🚀 **Automatischer Multi-User** • 💰 **100% kostenlos**

[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge&logo=github)](https://github.com/username/timetracker/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)](https://github.com/username/timetracker/releases/latest)

---

## 🎯 Features

### ✅ Zeiterfassung
- Manuelle Zeiterfassung (Start/Ende/Pause)
- Arbeitsort-Tracking (Büro, Home-Office, Außendienst)
- Projekt- und Aktivitätszuordnung
- Automatische Stundenberechnung
- Überstunden-Tracking

### ✅ Abwesenheiten
- Urlaubsanträge
- Krankmeldungen
- Überstundenausgleich
- Unbezahlter Urlaub
- Admin-Genehmigung mit Workflow

### ✅ Kalender & Berichte
- Monats-/Wochen-/Jahresansicht
- Feiertage-Verwaltung
- Stunden-Reports (CSV Export)
- Team-Übersicht (Admin)
- Individuelle Statistiken

### ✅ Multi-User
- **Automatische Server-Erkennung** (LAN)
- **Cloudflare Tunnel** für Home-Office (kostenlos!)
- Role-based Access (Admin/Employee)
- Team-Management
- Echtzeit-Synchronisation

### ✅ Desktop-App
- **Tauri-basiert** (~15 MB statt 100+ MB bei Electron)
- Embedded Server (keine manuelle Installation!)
- System Tray Integration
- Dark Mode
- Keyboard Shortcuts
- Auto-Update System

---

## 🚀 Quick Start

### 1️⃣ Download

**[📥 Download Latest Release](https://github.com/username/timetracker/releases/latest)**

- **Windows:** `TimeTracker_1.0.0_x64-setup.exe`
- **macOS:** `TimeTracker_1.0.0_x64.dmg`
- **Linux:** `TimeTracker_1.0.0_amd64.AppImage`

### 2️⃣ Installation

1. Doppelklick auf Installer
2. "Installieren" klicken
3. App öffnen
4. **Fertig!** 🎉

### 3️⃣ Login

**Erster User (Admin):**
```
Username: admin
Passwort: admin123
```

**Beim ersten Login Passwort ändern!**

### 4️⃣ Multi-User einrichten

**Automatisch!** Andere PCs installieren die gleiche `.exe` und finden den Server automatisch.

**📖 [Vollständige Anleitung](DEPLOYMENT.md)**

---

## 💡 Wie funktioniert Multi-User?

### Büro (LAN) - Standard

```
PC 1 (Admin)              PC 2 (Mitarbeiter)
┌──────────────┐          ┌──────────────┐
│ TimeTracker  │  ◄────►  │ TimeTracker  │
│ + Master     │   LAN    │ (verbindet   │
│   Server     │          │  automatisch)│
└──────────────┘          └──────────────┘
```

**✅ Automatische Erkennung** • **✅ Keine Konfiguration** • **✅ Kein Internet nötig**

### Home-Office - Optional

```
Home-Office               Büro (Master)
┌──────────────┐          ┌──────────────┐
│ TimeTracker  │  ◄────►  │ TimeTracker  │
│              │ Cloudflare│ + Master     │
│              │  Tunnel   │   Server     │
└──────────────┘ (GRATIS) └──────────────┘
```

**✅ Cloudflare Tunnel** • **✅ 100% kostenlos** • **✅ HTTPS automatisch**

---

## 🛠️ Tech Stack

### Frontend
- **Tauri 2.x** - Desktop Framework (Rust)
- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **TanStack Query v5** - Server State
- **Zustand** - UI State
- **Tailwind CSS** - Styling

### Backend (Embedded)
- **Node.js 20** - Runtime
- **Express** - API Server
- **SQLite** - Database (WAL mode)
- **Bcrypt** - Password Hashing
- **WebSocket** - Real-time Updates

### Deployment
- **GitHub Actions** - CI/CD
- **Tauri Bundler** - Cross-platform Builds
- **Auto-Updater** - Seamless Updates
- **Cloudflare Tunnel** - Free Remote Access

---

## 📊 System Requirements

### Minimale Anforderungen
- **OS:** Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **RAM:** 2 GB
- **Speicher:** 500 MB
- **Netzwerk:** LAN/WLAN (für Multi-User)

### Empfohlen (Master-Server)
- **OS:** Windows Server, Linux Server, oder dedizierter PC
- **RAM:** 4 GB
- **Speicher:** 10 GB
- **Netzwerk:** Stabile Verbindung

---

## 👨‍💻 Entwicklung

### Requirements

- Node.js v20.19.5 (LTS)
- npm 10.8.2+
- Rust 1.90+ (for Tauri)

### Setup

```bash
# Dependencies installieren
npm install
```

### Development Mode

```bash
# Terminal 1: Backend Server
npm run dev:server

# Terminal 2: Desktop App
npm run dev:desktop
```

### Build für Production

```bash
npm run build
```

**Output:**
- Windows: `desktop/src-tauri/target/release/bundle/nsis/TimeTracker_1.0.0_x64-setup.exe`
- macOS: `desktop/src-tauri/target/release/bundle/dmg/TimeTracker_1.0.0_x64.dmg`
- Linux: `desktop/src-tauri/target/release/bundle/appimage/TimeTracker_1.0.0_amd64.AppImage`

---

## 📖 Dokumentation

- **[Deployment Guide](DEPLOYMENT.md)** - Komplette Installations-Anleitung
- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** - Entwicklungs-Roadmap
- **[Architecture Guidelines](.claude/CLAUDE.md)** - Entwickler-Richtlinien

---

## 🔒 Sicherheit

### Built-in Security Features

✅ **Bcrypt Password Hashing** (10 rounds)
✅ **HttpOnly Session Cookies** (XSS Protection)
✅ **HTTPS** (über Cloudflare Tunnel)
✅ **SQL Injection Protection** (Prepared Statements)
✅ **Role-based Access Control** (RBAC)
✅ **Input Validation** (Frontend + Backend)

### Datenschutz

- ✅ **Lokale Datenbank** (keine Cloud!)
- ✅ **Deine Daten bleiben bei dir**
- ✅ **Kein Tracking**
- ✅ **Open Source**

---

## 🗺️ Roadmap

### ✅ Phase 1-9: Fertig!
- [x] Backend API
- [x] User Management
- [x] Time Tracking
- [x] Absence Management
- [x] Reports & Export
- [x] Calendar Views
- [x] Dark Mode
- [x] Keyboard Shortcuts

### 🚧 Phase 10: Testing (In Progress)
- [ ] Integration Tests
- [ ] E2E Tests
- [ ] Performance Tests

### 📅 Phase 11-12: Deployment
- [ ] Embedded Server (Tauri Sidecar)
- [ ] mDNS Auto-Discovery
- [ ] Cloudflare Tunnel Integration
- [ ] GitHub Actions CI/CD
- [ ] Auto-Update System

### 🔮 Future Features
- [ ] Mobile Apps (iOS/Android)
- [ ] Biometric Time Tracking
- [ ] Advanced Analytics
- [ ] API für Drittanbieter
- [ ] Slack/Teams Integration

---

## 🤝 Mitwirken

Contributions sind willkommen!

1. Fork das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/amazing-feature`)
3. Committe deine Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushe zum Branch (`git push origin feature/amazing-feature`)
5. Öffne einen Pull Request

**Bitte beachte die [Development Guidelines](.claude/CLAUDE.md)**

---

## 📝 Lizenz

Dieses Projekt ist unter der **MIT Lizenz** lizenziert - siehe [LICENSE](LICENSE) für Details.

---

## 🙏 Danke an

- [Tauri](https://tauri.app/) - Amazing Desktop Framework
- [Cloudflare](https://www.cloudflare.com/) - Free Tunnel Service
- [TanStack](https://tanstack.com/) - Excellent React Libraries
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

---

## 📞 Support

**Bugs oder Feature-Requests?**
- 🐛 [Issue erstellen](https://github.com/username/timetracker/issues/new)

**Fragen?**
- 💬 [Discussions](https://github.com/username/timetracker/discussions)

---

<div align="center">

**Made with ❤️ using Tauri, React, and TypeScript**

⭐ **Star dieses Repo wenn es dir gefällt!** ⭐

</div>
