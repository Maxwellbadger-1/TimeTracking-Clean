# Development Guide - TimeTracking System

## 🚀 Quick Start (EINFACH!)

### Option 1: Mit Start-Script (EMPFOHLEN)
```bash
./start-dev.sh
```

**Das war's!** Der Script macht ALLES automatisch:
- Stoppt alte Prozesse
- Startet Backend-Server
- Wartet bis Server bereit ist
- Startet Desktop-App
- Hot-Reload funktioniert sofort

### Option 2: Manuell (wenn du es kompliziert magst)
```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Desktop App (in neuem Terminal!)
npm run dev:desktop
```

### Stoppen
```bash
./stop-dev.sh
```

---

## ⚡ Wie funktioniert Hot-Reload?

### Frontend (React/TypeScript)
- **Änderungen in `desktop/src/`** → Automatisches Reload in **1-2 Sekunden**
- **Keine Rust-Kompilierung** nötig
- **Vite HMR** funktioniert out-of-the-box

### Backend (Node.js/Express)
- **Server-Änderungen** → Manueller Restart nötig
  ```bash
  # Stoppe Server (Ctrl+C)
  # Starte neu
  cd server && npm start
  ```

### Rust-Code (Tauri Backend)
- **Änderungen in `desktop/src-tauri/`** → Automatische Neu-Kompilierung
- **Dauert 3-5 Minuten** beim ersten Mal
- **Danach nur betroffene Crates** (schneller)

---

## 🔧 Architektur-Überblick

```
┌─────────────────────────────────────────┐
│  Desktop App (Tauri)                    │
│  - Vite Dev Server: http://localhost:1420│
│  - Frontend: React + TypeScript         │
│  - Hot Reload: ✅ Instant                 │
└─────────────────────────────────────────┘
           ↓ HTTP/WebSocket
┌─────────────────────────────────────────┐
│  Backend Server (Node.js)               │
│  - Express API: http://localhost:3000   │
│  - Database: SQLite (WAL mode)          │
│  - Hot Reload: ❌ Manual restart needed   │
└─────────────────────────────────────────┘
```

---

## 📁 Wichtige Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Vite Dev Server | 1420 | http://localhost:1420 |
| Vite HMR WebSocket | 1421 | ws://localhost:1421 |

**WICHTIG:** Wenn Port 3000 oder 1420 belegt ist, nutze `./stop-dev.sh` um alte Prozesse zu killen!

---

## 🐛 Probleme lösen

### Problem: "Could not connect to server"

**Ursache:** Backend-Server läuft nicht oder ist noch am Starten

**Lösung:**
```bash
# 1. Stoppe alles
./stop-dev.sh

# 2. Starte neu
./start-dev.sh
```

### Problem: "Port 3000 already in use"

**Ursache:** Alter Server-Prozess läuft noch

**Lösung:**
```bash
./stop-dev.sh
# oder
killall -9 node
```

### Problem: "Port 1420 already in use"

**Ursache:** Alte Vite-Instanz läuft noch

**Lösung:**
```bash
./stop-dev.sh
# oder
killall -9 vite
```

### Problem: Tauri kompiliert ewig

**Ursache:** Erste Kompilierung (normal!)

**Lösung:**
- Beim ersten `cargo build` dauert es 3-5 Minuten
- Danach sind Rebuilds schneller (30-60 Sekunden)
- `.taurignore` Datei verhindert unnötige Rebuilds

**Tipp:** Ändere nur Frontend-Code während Entwicklung, dann keine Rust-Kompilierung!

---

## 💡 Pro-Tips für schnelles Entwickeln

### 1. **Nur Frontend ändern? Tauri im Hintergrund lassen!**
```bash
# Einmal starten:
./start-dev.sh

# Jetzt ändern in desktop/src/...
# → Automatisches Reload in 1-2 Sekunden!
# KEIN Neustart nötig!
```

### 2. **Backend-Änderungen? Nur Server neu starten!**
```bash
# Desktop-App läuft weiter!
# Nur Server neu starten:
cd server
# Ctrl+C
npm start
```

### 3. **TypeScript-Fehler? Ignore während Development!**
```bash
# In desktop/tsconfig.json:
"skipLibCheck": true  # ← Schon gesetzt!
```

### 4. **Zombie-Prozesse? Ein Befehl!**
```bash
./stop-dev.sh
```

---

## 📚 Nützliche Befehle

```bash
# Development starten
./start-dev.sh

# Development stoppen
./stop-dev.sh

# Nur Backend
cd server && npm start

# Nur Desktop App (erwartet Backend auf :3000)
npm run dev:desktop

# Production Build
npm run build  # Baut Server + Desktop

# TypeScript prüfen
cd desktop && npm run build  # Nur checken, kein Vite build

# Database Reset
cd server && rm database.db && npm start
```

---

## 🎯 Was du NICHT tun solltest

❌ **NICHT**: `tauri build` während Development
   → Dauert ewig und ist unnötig

❌ **NICHT**: Mehrere `npm start` parallel im gleichen Ordner
   → Port-Konflikte garantiert

❌ **NICHT**: Frontend-Dev-Server manuell starten
   → Tauri macht das automatisch

❌ **NICHT**: `npm install` in `desktop/src-tauri/`
   → Ist ein Rust-Projekt, kein Node-Projekt!

---

## ✅ Best Practices

✅ **IMMER**: `./start-dev.sh` nutzen
✅ **IMMER**: `./stop-dev.sh` vor neuem Start
✅ **IMMER**: Nur Frontend-Code ändern für schnelle Iteration
✅ **IMMER**: Browser-Console checken bei Login-Problemen
✅ **IMMER**: Git-Commit nach funktionierendem Feature

---

## 🔍 Debug-Tipps

### Frontend-Logs
```
Desktop App → Rechtsklick → Inspect → Console
```

### Backend-Logs
```
Terminal wo `npm start` läuft
```

### Network-Requests checken
```
Desktop App → Rechtsklick → Inspect → Network Tab
```

### Database-Inhalt prüfen
```bash
cd server
sqlite3 database.db
sqlite> SELECT * FROM users;
sqlite> .exit
```

---

## 🚀 Performance-Optimierung

### Schnellerer Tauri-Start
- `.taurignore` File nutzen (schon vorhanden)
- Nur nötige Tauri-Features aktivieren
- Cargo.toml dependencies minimal halten

### Schnellerer Vite-Start
- `desktop/src-tauri/` wird schon ignoriert (vite.config.ts)
- Source maps nur in dev mode
- Tailwind JIT mode (schon aktiv)

### Schnellerer Server-Start
- SQLite WAL mode (schon aktiv)
- Kein DB-Migration während dev
- Sessions in Memory (für dev ok)

---

## 📖 Weitere Infos

- Tauri Docs: https://v2.tauri.app/
- Vite Docs: https://vite.dev/
- React Query Docs: https://tanstack.com/query/latest

**Bei Problemen:**
1. `./stop-dev.sh`
2. `./start-dev.sh`
3. Wenn das nicht hilft → Git Issue oder Claude fragen!
