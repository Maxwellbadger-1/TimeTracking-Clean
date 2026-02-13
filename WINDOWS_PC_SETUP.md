# Windows PC Setup - Komplettanleitung

**Zweck:** Erstes Setup des TimeTracking-Projekts auf Windows PC
**Dauer:** ~15 Minuten (beim ersten Mal)
**Voraussetzungen:** Git, Node.js, Rust (für Tauri)

---

## 📋 COPY-PASTE FÜR CLAUDE CODE AUF WINDOWS PC:

```
Bitte richte das TimeTracking-Projekt auf diesem Windows PC ein:

1. Clone das Projekt von GitHub:
   Repository: https://github.com/Maxwellbadger-1/TimeTracking-Clean.git

2. Installiere alle Dependencies (npm install in root, desktop/, server/)

3. Erstelle die .env Dateien (siehe unten)

4. Starte Server und Desktop App

Das Projekt ist ein Full-Stack Tauri Desktop App mit Node.js Backend.
```

---

## 🔧 Prerequisites Check

**WICHTIG: Führe diese Commands in PowerShell aus BEVOR du startest:**

```powershell
# Git installiert?
git --version
# Sollte zeigen: git version 2.x.x

# Node.js installiert?
node --version
npm --version
# Sollte zeigen: v20.x.x und 10.x.x

# Rust installiert? (für Tauri)
rustc --version
# Sollte zeigen: rustc 1.x.x
```

**Falls nicht installiert:**
- **Git:** https://git-scm.com/download/win
- **Node.js:** https://nodejs.org/ (LTS Version)
- **Rust:** https://rustup.rs/
- **Visual Studio Build Tools:** https://visualstudio.microsoft.com/downloads/ (für Tauri)

---

## 📂 Setup Steps

### 1. Projekt clonen

```powershell
# Erstelle Projektordner (falls nicht vorhanden)
mkdir C:\Projects
cd C:\Projects

# Clone Projekt (lädt ~90 MB Source Code)
git clone https://github.com/Maxwellbadger-1/TimeTracking-Clean.git

# Gehe ins Projekt
cd TimeTracking-Clean
```

### 2. Dependencies installieren

```powershell
# Root Dependencies
npm install

# Desktop Dependencies
cd desktop
npm install

# Server Dependencies
cd ..\server
npm install

# Zurück zum Root
cd ..
```

**Dauer:** ~3-4 Minuten

### 3. .env Dateien erstellen

**3.1 Server .env (server/.env.development):**

Erstelle Datei `server\.env.development` mit diesem Inhalt:

```env
# Development Environment Configuration
# Local server for fast testing with small dataset

NODE_ENV=development
PORT=3000
TZ=Europe/Berlin
SESSION_SECRET=dev-secret-local-only-not-for-production
DATABASE_PATH=./database/development.db
```

**3.2 Desktop .env (desktop/.env.development):**

Erstelle Datei `desktop\.env.development` mit diesem Inhalt:

```env
# Development Environment Configuration
# Desktop App connects to LOCAL server (localhost:3000)

VITE_API_URL=http://localhost:3000/api
VITE_PORT=1420
VITE_ENV=development
```

**3.3 Root .env (OPTIONAL - nur wenn du Production/SSH brauchst):**

Erstelle Datei `.env` im Root mit diesem Inhalt:

```env
# ============================================
# TimeTracking System - Master Environment Configuration
# ============================================

# GitHub Credentials
# WICHTIG: Ersetze YOUR_GITHUB_TOKEN mit echtem Token von Mac!
GITHUB_TOKEN=YOUR_GITHUB_TOKEN
GITHUB_REPO=Maxwellbadger-1/TimeTracking-Clean
GITHUB_USER=Maxwellbadger-1

# Server Configuration
PORT=3000
NODE_ENV=development
# Generiere neues Secret mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=YOUR_SESSION_SECRET_HERE
ALLOWED_ORIGINS=tauri://localhost,https://tauri.localhost,http://localhost:1420
DATABASE_PATH=./database.db
LOG_LEVEL=debug

# Frontend Configuration
VITE_API_URL=http://localhost:3000/api
VITE_API_URL_PRODUCTION=http://129.159.8.19:3000/api

# SSH / Production Server (Oracle Cloud)
SSH_HOST=129.159.8.19
SSH_USER=ubuntu
SSH_PORT=22
SSH_KEY_PATH=.ssh/oracle_server.key
PROD_DB_PATH=/home/ubuntu/TimeTracking-Clean/server/database.db
PROD_SERVER_PATH=/home/ubuntu/TimeTracking-Clean/server
PM2_SERVICE_NAME=timetracking-server
PROD_API_URL=http://129.159.8.19:3000

# Database Settings
DB_WAL_MODE=true
DB_TIMEOUT=5000
DB_CACHE_SIZE=2000

# Development Settings
DISABLE_AUTH=false
DEBUG=false
HOT_RELOAD=true
BUILD_ENV=development
```

**HINWEIS:** Root .env ist nur nötig wenn du:
- Production Deployment machst
- SSH zu Oracle Cloud Server brauchst
- GitHub API nutzen willst

Für **lokale Entwicklung** reichen die ersten beiden .env Dateien!

---

## 🚀 Entwicklung starten

**Öffne 2 separate PowerShell/Command Prompt Fenster:**

**Terminal 1 - Server:**
```powershell
cd C:\Projects\TimeTracking-Clean\server
npm run dev
```

Server läuft dann auf: http://localhost:3000

**Terminal 2 - Desktop App:**
```powershell
cd C:\Projects\TimeTracking-Clean\desktop
npm run dev
```

Desktop App startet automatisch.

**⚠️ WICHTIG:** Beim ersten Mal dauert der Tauri Build ~5-10 Minuten!
Rust kompiliert alle Dependencies und erstellt den `target/` Ordner (~6-8 GB).
Bei weiteren Starts dauert es nur noch ~30 Sekunden.

---

## 📊 Was du erwarten kannst:

| Schritt | Dauer | Ergebnis |
|---------|-------|----------|
| Git Clone | ~2-3 Min | Projekt (~90 MB) |
| npm install | ~3-4 Min | node_modules (~500 MB) |
| Server Start | ~5 Sek | localhost:3000 |
| Desktop Build (1. Mal) | ~5-10 Min | target/ (~6-8 GB) |
| Desktop Build (danach) | ~30 Sek | Schnell! |
| **GESAMT (1. Mal)** | **~15 Min** | ✅ |
| **GESAMT (danach)** | **~1 Min** | ✅ |

---

## 🔄 Täglicher Workflow (nach erstem Setup)

**Wenn du später vom Mac gewechselt hast:**

```powershell
# 1. Gehe ins Projekt
cd C:\Projects\TimeTracking-Clean

# 2. Hole neueste Änderungen
git pull origin main

# 3. Falls package.json geändert:
npm install
cd desktop && npm install
cd ..\server && npm install

# 4. Starte Entwicklung (2 Terminals)
# Terminal 1:
cd server && npm run dev

# Terminal 2:
cd desktop && npm run dev
```

**Dauer:** ~1-2 Minuten (statt vorher 10 Minuten kopieren!)

---

## ⚠️ Troubleshooting

### Problem: Rust nicht installiert
```
Error: cargo not found
```
**Lösung:**
- Installiere Rust: https://rustup.rs/
- Restart Terminal nach Installation

### Problem: Visual Studio Build Tools fehlen
```
Error: MSVC not found
```
**Lösung:**
- Installiere Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
- Wähle "Desktop development with C++"

### Problem: WebView2 fehlt
```
Error: WebView2 not found
```
**Lösung:**
- Installiere WebView2: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- Oder: Neuestes Windows Update installieren (enthält WebView2)

### Problem: Port 3000 schon belegt
```
Error: EADDRINUSE: address already in use :::3000
```
**Lösung:**
```powershell
# Finde Prozess der Port 3000 nutzt:
netstat -ano | findstr :3000

# Kill den Prozess (PID aus Output nehmen):
taskkill /PID <PID> /F
```

### Problem: Git SSL Certificate Fehler
```
Error: SSL certificate problem
```
**Lösung:**
```powershell
git config --global http.sslVerify false
# Oder: Update Git zu neuester Version
```

---

## 📁 Projekt-Struktur (Nach Setup)

```
C:\Projects\TimeTracking-Clean\
├── server/                    # Backend (Node.js + Express)
│   ├── src/                   # Source Code
│   ├── database.db            # SQLite Database (wird automatisch erstellt)
│   ├── .env.development       # ✅ ERSTELLT
│   └── node_modules/          # ~50 MB
├── desktop/                   # Frontend (Tauri + React)
│   ├── src/                   # React Source Code
│   ├── src-tauri/             # Tauri (Rust)
│   │   └── target/            # Build Cache (~6-8 GB, wird beim 1. Build erstellt)
│   ├── .env.development       # ✅ ERSTELLT
│   └── node_modules/          # ~15 MB
├── node_modules/              # Root Dependencies (~500 MB)
├── .env                       # ✅ OPTIONAL (für Production/SSH)
└── README.md
```

**Gesamt-Größe nach Setup:**
- Ohne Build: ~500 MB
- Mit Tauri Build: ~7 GB (aber nur lokal, nicht in Git!)

---

## 🎓 Was ist anders als auf dem Mac?

| Aspekt | Mac | Windows PC |
|--------|-----|------------|
| **Projektordner** | `~/Desktop/TimeTracking-Clean` | `C:\Projects\TimeTracking-Clean` |
| **Terminal** | Terminal.app / iTerm | PowerShell / Command Prompt |
| **Line Endings** | LF | CRLF (Git konvertiert automatisch) |
| **Pfade** | `/` | `\` (aber Git nimmt `/` auch) |
| **Rust Target** | `x86_64-apple-darwin` | `x86_64-pc-windows-msvc` |

**WICHTIG:** Git kümmert sich automatisch um Line-Endings!
Du musst nichts manuell konvertieren.

---

## ✅ Verification

**Nach Setup solltest du haben:**
- ✅ Server läuft auf http://localhost:3000
- ✅ Desktop App öffnet sich automatisch
- ✅ Login funktioniert mit bereitgestellten Credentials
- ✅ Git status zeigt: "nothing to commit, working tree clean"

**Test:**
1. Öffne Desktop App
2. Login mit bereitgestellten Credentials
3. Erstelle einen Test-Zeiteintrag
4. Check ob er gespeichert wird

---

## 🔐 Security Notes

**WICHTIG:**
- ✅ `.env` Dateien sind in `.gitignore` → werden NICHT committed
- ✅ Teile niemals deine .env Dateien oder GITHUB_TOKEN
- ✅ SESSION_SECRET ist nur für Development → in Production anders!

---

## 🚀 Nächste Schritte

Nach erfolgreichem Setup kannst du:
1. ✅ Mit Entwicklung starten
2. ✅ Änderungen machen
3. ✅ Committen: `git add . && git commit -m "feat: ..."`
4. ✅ Pushen: `git push origin main`
5. ✅ Zurück zu Mac: `git pull origin main`

**Git-Workflow ist jetzt dein Freund!** 🎉

---

**Version:** 1.0 (2026-02-11)
**Status:** ✅ Production Ready
**Erstellt für:** Windows PC Setup vom Mac aus
