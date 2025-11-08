# 🚀 PRODUCTION DEPLOYMENT GUIDE
**TimeTracking System - Enterprise Deployment**

---

## 📋 ÜBERBLICK

Dieses TimeTracking System besteht aus **2 Komponenten**:

1. **Server** (Node.js + Express + SQLite) - Läuft auf **1 zentralen Server**
2. **Desktop-App** (Tauri) - Wird auf **allen Mitarbeiter-PCs** installiert

---

## ✅ VORAUSSETZUNGEN

### Auf deinem Entwicklungs-Computer (für Build):
- ✅ Node.js 18+ (`node -v`)
- ✅ npm 9+ (`npm -v`)
- ✅ Rust (für Tauri Build): https://rustup.rs/
- ✅ Git

### Auf dem Production Server:
- ✅ Node.js 18+
- ✅ PM2 (Process Manager): `npm install -g pm2`
- ✅ (Optional) nginx für HTTPS Reverse Proxy

---

## 🎯 DEPLOYMENT-SZENARIEN

### Szenario 1: Lokales Netzwerk (LAN)
Server läuft auf einem PC im Büro-Netzwerk (z.B. `192.168.1.100`)

### Szenario 2: Internet Server (Remote)
Server läuft auf VPS/Cloud mit Domain (z.B. `timetracking.deine-domain.de`)

---

## 📦 SCHRITT 1: SERVER KONFIGURATION

### 1.1 Environment Variables erstellen

```bash
cd server
cp .env.example .env
nano .env
```

**Wichtig! `.env` Inhalt anpassen:**

```env
# Production Mode
NODE_ENV=production

# Server Port
PORT=3000

# CRITICAL: SESSION_SECRET generieren!
# Führe aus: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=<dein-generierter-64-zeichen-hex-string>

# CORS: Erlaubte Origins (Tauri Apps)
ALLOWED_ORIGINS=tauri://localhost,https://tauri.localhost

# Logging
LOG_LEVEL=info

# Database
DATABASE_PATH=./database.db

# Backups
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
```

**SESSION_SECRET generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output z.B.: a1b2c3d4e5f6789... (64 Zeichen)
```

### 1.2 Server bauen

```bash
cd server
npm install
npm run build
```

### 1.3 Server mit PM2 starten

```bash
# PM2 installieren (falls noch nicht installiert)
npm install -g pm2

# Server starten
pm2 start ecosystem.config.js

# PM2 Status prüfen
pm2 status

# PM2 Logs ansehen
pm2 logs timetracking-server

# PM2 bei System-Restart automatisch starten
pm2 startup
pm2 save
```

**Server läuft jetzt!** 🎉
- Port: `3000`
- Health Check: `http://localhost:3000/api/health`

---

## 🖥️ SCHRITT 2: DESKTOP-APP BAUEN

### 2.1 Production Server-URL konfigurieren

```bash
cd desktop
cp .env.production.example .env.production
nano .env.production
```

**Szenario 1 (LAN):**
```env
VITE_API_URL=http://192.168.1.100:3000/api
```

**Szenario 2 (Internet mit HTTPS):**
```env
VITE_API_URL=https://timetracking.deine-domain.de/api
```

### 2.2 Desktop-App bauen

**Option A: Automatisches Build-Script (empfohlen)**
```bash
cd /pfad/zum/projekt
./build-production.sh
```

**Option B: Manueller Build**
```bash
cd desktop
npm install
npm run tauri build
```

⏰ **Dauer:** 5-10 Minuten

### 2.3 Installer-Dateien finden

**macOS:**
```bash
desktop/src-tauri/target/release/bundle/dmg/*.dmg
desktop/src-tauri/target/release/bundle/macos/*.app
```

**Windows:**
```bash
desktop/src-tauri/target/release/bundle/msi/*.msi
desktop/src-tauri/target/release/bundle/nsis/*.exe
```

**Linux:**
```bash
desktop/src-tauri/target/release/bundle/appimage/*.AppImage
desktop/src-tauri/target/release/bundle/deb/*.deb
```

---

## 📤 SCHRITT 3: APP AN MITARBEITER VERTEILEN

### 3.1 Installer verteilen

Die `.msi` / `.dmg` / `.AppImage` Dateien können jetzt verteilt werden:

- Per E-Mail
- Per Netzwerk-Share
- Per USB-Stick
- Per Download-Link (intern)

### 3.2 Installation durch Mitarbeiter

**Windows:**
1. Doppelklick auf `.msi` Datei
2. Setup-Assistent folgen
3. App starten

**macOS:**
1. Doppelklick auf `.dmg` Datei
2. App in `Applications` Ordner ziehen
3. App starten (ggf. Sicherheitswarnung bestätigen)

**Linux:**
1. `.AppImage` ausführbar machen: `chmod +x *.AppImage`
2. Doppelklick auf `.AppImage`

### 3.3 Erster Start

- App verbindet sich **automatisch** zum konfigurierten Server
- Login mit Admin-Credentials:
  - Username: `admin`
  - Password: `admin` (BITTE ÄNDERN!)

---

## 🔒 SCHRITT 4: SICHERHEITS-CHECKLISTE

Nach dem Deployment prüfen:

- [ ] **SESSION_SECRET gesetzt** (nicht Default!)
- [ ] **NODE_ENV=production** gesetzt
- [ ] **Admin Passwort geändert**
- [ ] **HTTPS aktiviert** (wenn Internet-Server)
- [ ] **Firewall konfiguriert** (nur Port 3000/443 offen)
- [ ] **Backup-System getestet**
- [ ] **PM2 Autostart aktiviert**

---

## 🔄 SCHRITT 5: HTTPS SETUP (Optional - Internet Server)

### 5.1 SSL-Zertifikat mit Let's Encrypt

```bash
# nginx installieren
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Zertifikat generieren
sudo certbot --nginx -d timetracking.deine-domain.de

# Auto-Renewal aktivieren
sudo certbot renew --dry-run
```

### 5.2 nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/timetracking

server {
    listen 443 ssl http2;
    server_name timetracking.deine-domain.de;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/timetracking.deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/timetracking.deine-domain.de/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Node.js Server
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP to HTTPS Redirect
server {
    listen 80;
    server_name timetracking.deine-domain.de;
    return 301 https://$server_name$request_uri;
}
```

```bash
# nginx Config aktivieren
sudo ln -s /etc/nginx/sites-available/timetracking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔧 WARTUNG & UPDATES

### Server neu starten

```bash
pm2 restart timetracking-server
```

### Server Logs ansehen

```bash
pm2 logs timetracking-server
pm2 logs timetracking-server --lines 100
```

### Backup manuell erstellen

```bash
cd server
npm run backup
```

### Backup wiederherstellen

```bash
cd server
cp backups/backup-YYYY-MM-DD.db database.db
pm2 restart timetracking-server
```

### Update deployen

```bash
# Code aktualisieren
git pull

# Server neu bauen
cd server
npm install
npm run build
pm2 restart timetracking-server

# Desktop-App neu bauen (nur bei Client-Changes)
cd ../desktop
npm install
npm run tauri build
# Neue Installer an Mitarbeiter verteilen
```

---

## 🐛 TROUBLESHOOTING

### Problem: Server startet nicht

**Prüfen:**
```bash
pm2 logs timetracking-server
```

**Häufige Ursachen:**
- `.env` fehlt
- `SESSION_SECRET` nicht gesetzt
- Port 3000 bereits belegt: `lsof -i :3000`

### Problem: Desktop-App kann sich nicht verbinden

**Prüfen:**
1. Server läuft? `pm2 status`
2. Firewall blockiert Port 3000?
3. Server-URL korrekt in `.env.production`?
4. CORS Origins korrekt in `server/.env`?

### Problem: Session Cookies funktionieren nicht

**Prüfen:**
1. HTTPS aktiviert? (erforderlich in Production)
2. `secure: true` in `server/src/server.ts`?
3. CORS `credentials: true` gesetzt?

### Problem: Database locked

**Lösung:**
```bash
pm2 restart timetracking-server
```

WAL Mode ist aktiviert, sollte selten vorkommen.

---

## 📊 MONITORING

### PM2 Monitoring Dashboard

```bash
# Terminal Dashboard
pm2 monit

# Web Dashboard (Optional)
pm2 plus
```

### System Resources prüfen

```bash
# CPU & RAM Usage
pm2 status

# Detailed Stats
pm2 show timetracking-server
```

### Health Check API

```bash
curl http://localhost:3000/api/health

# Expected Response:
# {"status":"ok","message":"TimeTracking Server is running","version":"0.1.0"}
```

---

## 📝 CHECKLISTE: ERSTES DEPLOYMENT

### Vor dem Deployment

- [ ] `server/.env` erstellt & konfiguriert
- [ ] `SESSION_SECRET` generiert
- [ ] `desktop/.env.production` erstellt & Server-URL gesetzt
- [ ] Server-Computer/VPS bereit
- [ ] (Optional) Domain & HTTPS konfiguriert

### Server Setup

- [ ] Code auf Server kopiert/gecloned
- [ ] `npm install` ausgeführt
- [ ] `npm run build` ausgeführt
- [ ] PM2 installiert
- [ ] `pm2 start ecosystem.config.js`
- [ ] `pm2 startup` & `pm2 save`
- [ ] Server erreichbar (Health Check)

### Desktop-App Build

- [ ] `./build-production.sh` ausgeführt
- [ ] Installer-Dateien gefunden
- [ ] Installer getestet (mindestens 1x)

### Distribution

- [ ] Installer an Mitarbeiter verteilt
- [ ] Installations-Anleitung mitgeschickt
- [ ] Admin-Credentials mitgeteilt
- [ ] Support-Kontakt kommuniziert

### Post-Deployment

- [ ] Admin-Passwort geändert
- [ ] Backup-System getestet
- [ ] Monitoring aktiv
- [ ] Users angelegt
- [ ] Test-Zeiterfassung durchgeführt

---

## 🎉 FERTIG!

Dein TimeTracking System ist jetzt production-ready und deployed!

**Nächste Schritte:**
1. Mitarbeiter-Accounts anlegen
2. Urlaubstage konfigurieren
3. Feiertage prüfen (werden automatisch geladen)
4. Regelmäßige Backups prüfen

**Support:**
- 📖 Dokumentation: `README.md`
- 🔒 Security: `PRODUCTION_AUDIT_REPORT.md`
- 📋 Features: `CLAUDE.md`

---

**Viel Erfolg! 🚀**
