# TimeTracking System - Scripts

Alle Automatisierungs-Scripts für Development, Production und Database Management.

## 📂 Ordnerstruktur

```
scripts/
├── dev/              # Development Scripts (lokale Entwicklung)
├── production/       # Production Scripts (Oracle Cloud Server)
├── database/         # Database Management Scripts
└── README.md         # Diese Datei
```

---

## 🖥️ Development Scripts (`scripts/dev/`)

### `start.sh` - Hauptscript für lokale Entwicklung

**EMPFOHLEN:** Bestes Cleanup-Handling, automatischer Server + Desktop Start

```bash
./scripts/dev/start.sh
```

**Was passiert:**
- Stoppt alte Prozesse (Node, npm, Tauri)
- Startet Server auf Port 3000
- Health Check
- Startet Desktop App (Tauri)
- Cleanup bei Ctrl+C

**Features:**
- Lockfile-Handling (verhindert mehrfache Instanzen)
- Automatisches Cleanup bei Exit
- Process Group Management

---

### `start-legacy.sh` - Alternative Start-Methode

```bash
./scripts/dev/start-legacy.sh
```

Einfachere Variante ohne Lockfile. Nutze `start.sh` für besseres Handling!

---

### `stop.sh` - Development Server stoppen

```bash
./scripts/dev/stop.sh
```

Stoppt ALLE Development-Prozesse:
- Node.js Server
- npm Prozesse
- Vite Dev Server
- Tauri Prozesse
- Cargo Builds

**Ports freigeben:**
- 3000 (Backend API)
- 1420 (Tauri Frontend)
- 1421 (Tauri IPC)

---

## 🌐 Production Scripts (`scripts/production/`)

### Voraussetzungen

- SSH-Keys im `.ssh/` Verzeichnis
- `.env.ssh` File mit Verbindungsdaten
- Zugriff auf Oracle Cloud Server (129.159.8.19)

---

### `deploy.sh` - Deploy zu Oracle Cloud

```bash
./scripts/production/deploy.sh
```

**Automatischer Deployment-Prozess:**
1. SSH Connection Test
2. Git Pull (origin/main)
3. npm install + TypeScript Build
4. PM2 Neustart (Zero-Downtime)
5. Health Check

**WICHTIG:** Deployed den aktuellen `main` Branch vom GitHub Repo!

---

### `connect.sh` - SSH zum Server

```bash
./scripts/production/connect.sh
```

Öffnet direkte SSH-Verbindung zum Production Server.

**Manuell:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

---

### `backup-db.sh` - Database Backup

```bash
./scripts/production/backup-db.sh
```

Lädt Production Database herunter und speichert im `backups/` Verzeichnis mit Timestamp.

**Output:**
```
📦 Backing up production database...
✅ Backup successful: backups/database-20250115-120000.db
📊 File size: 2.3M
```

---

### `query-db.sh` - SQL Queries (sqlite3 CLI)

```bash
./scripts/production/query-db.sh "SELECT * FROM users"
```

**HINWEIS:** Nutze `query-db-node.sh` wenn `sqlite3` CLI nicht auf Server installiert ist!

---

### `query-db-node.sh` - SQL Queries (Node.js)

```bash
./scripts/production/query-db-node.sh "SELECT * FROM users WHERE deletedAt IS NULL"
```

**Empfohlen!** Nutzt Node.js + better-sqlite3 (immer verfügbar).

**Beispiele:**
```bash
# Alle Benutzer
./scripts/production/query-db-node.sh "SELECT id, firstName, lastName, email FROM users WHERE deletedAt IS NULL"

# Anzahl Benutzer
./scripts/production/query-db-node.sh "SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL"

# Zeiteinträge heute
./scripts/production/query-db-node.sh "SELECT * FROM time_entries WHERE date = date('now')"

# Standard-Query (ohne Parameter)
./scripts/production/query-db-node.sh
```

---

### `auto-setup.sh` - Fresh Server Setup

```bash
./scripts/production/auto-setup.sh
```

**Vollautomatisches Setup auf neuem Ubuntu 22.04 Server:**
- System Update/Upgrade
- Node.js 20.x Installation
- Git + PM2 Installation
- UFW Firewall Setup
- Repository Clone + Build
- PM2 Auto-Start
- Daily Backups (Cronjob)

**Nutzung:**
```bash
# Lokal ausführen
curl -fsSL https://raw.githubusercontent.com/Maxwellbadger-1/TimeTracking-Clean/main/scripts/production/auto-setup.sh | bash

# Oder manuell
chmod +x scripts/production/auto-setup.sh
./scripts/production/auto-setup.sh
```

---

### Config Files

**`ecosystem.config.js`** - PM2 Configuration
**`nginx-timetracking.conf`** - Nginx Reverse Proxy Config (falls benötigt)

---

## 🗄️ Database Scripts (`scripts/database/`)

### `backup.sh` - Enterprise-Grade Backup

```bash
./scripts/database/backup.sh [daily|weekly|monthly]
```

**Features:**
- GFS Rotation (Grandfather-Father-Son)
- SQLite Online Backup API (sicher während Server läuft!)
- Integrity Checks (PRAGMA integrity_check)
- Email Notifications (optional)
- Health Check Logging

**Retention:**
- Daily: 7 Tage
- Weekly: 4 Wochen
- Monthly: 12 Monate

**Cronjob Setup:**
```bash
# Daily (2 AM)
0 2 * * * /path/to/scripts/database/backup.sh daily

# Weekly (Sunday 3 AM)
0 3 * * 0 /path/to/scripts/database/backup.sh weekly

# Monthly (1st of month, 4 AM)
0 4 1 * * /path/to/scripts/database/backup.sh monthly
```

**Backup-Verzeichnisse:**
```
backups/
├── daily/
│   ├── database_daily_20250115_020000.db
│   └── ...
├── weekly/
│   ├── database_week02_2025.db
│   └── ...
└── monthly/
    ├── database_2025-01.db
    └── ...
```

---

### `restore.sh` - Database Restore

```bash
./scripts/database/restore.sh <backup-file>
./scripts/database/restore.sh --list  # Liste aller Backups
```

**Safety Features:**
- Pre-Restore Safety Backup
- Integrity Verification
- Automatic Rollback bei Fehler
- Server-Running Check

**Beispiel:**
```bash
# Liste anzeigen
./scripts/database/restore.sh --list

# Restore
./scripts/database/restore.sh database_daily_20250115_020000.db
```

**Rollback bei Problemen:**
```bash
# Safety backup liegt in:
backups/pre-restore/database_pre_restore_<timestamp>.db

# Manueller Rollback
cp backups/pre-restore/database_pre_restore_20250115_120000.db server/database.db
```

---

### `cleanup.sh` - DSGVO Data Cleanup

```bash
./scripts/database/cleanup.sh [--dry-run]
```

**DSGVO-Compliance:** Löscht Daten älter als 4 Jahre (gesetzliche Aufbewahrungspflicht)

**Betroffene Tabellen:**
- `time_entries` (date < 4 Jahre)
- `absence_requests` (startDate < 4 Jahre)
- `audit_log` (timestamp < 4 Jahre)

**Dry-Run Mode:**
```bash
# Zeigt was gelöscht würde (ohne zu löschen)
./scripts/database/cleanup.sh --dry-run
```

**Ausführung:**
```bash
# Tatsächliches Löschen
./scripts/database/cleanup.sh
```

**Cronjob (jährlich am 1. Januar):**
```bash
0 3 1 1 * /path/to/scripts/database/cleanup.sh
```

---

### `sync-prod.sh` - Sync Production zu Dev

```bash
./scripts/database/sync-prod.sh
```

**WICHTIG:** Überschreibt lokale Development Database mit Production-Daten!

**Prozess:**
1. SSH Connection Check
2. Backup der aktuellen Dev DB
3. Production DB Download
4. Dev DB ersetzen
5. Migration Scripts ausführen
6. Data Integrity Check

**Output:**
```
✅✅✅ SYNC COMPLETED SUCCESSFULLY ✅✅✅

📊 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dev Database: ./database/development.db
  Backup saved: ./database/backups/development_backup_20250115.db
  Users: 18
  Time Entries: 1247
  Transactions: 523
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT: This is production data!
   - Do NOT commit this database
   - Be careful when testing
```

---

### `setup-cron.sh` - Cronjob Setup

```bash
./scripts/database/setup-cron.sh
```

Richtet automatische Backup-Cronjobs ein (Daily + Weekly + Monthly).

---

## 🔒 Sicherheit

### SSH-Keys

- Keys liegen in `.ssh/` (in `.gitignore`)
- NIEMALS committen!
- Korrekte Permissions:
  - Private Key: `600` (nur Owner lesen/schreiben)
  - Public Key: `644` (Owner + Others lesen)

**Permissions prüfen:**
```bash
ls -la .ssh/
# -rw------- oracle_server.key (600)
# -rw-r--r-- oracle_server.key.pub (644)
```

**Permissions fixen:**
```bash
chmod 600 .ssh/oracle_server.key
chmod 644 .ssh/oracle_server.key.pub
```

---

## 🐛 Troubleshooting

### "Permission denied (publickey)"

```bash
# 1. Permissions fixen
chmod 600 .ssh/oracle_server.key

# 2. Key-Fingerprint prüfen
ssh-keygen -l -f .ssh/oracle_server.key.pub

# 3. Verbose SSH
ssh -v -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

---

### "Database locked"

Production DB nutzt WAL Mode für Multi-User Access:

```bash
# WAL-Checkpoint
./scripts/production/query-db.sh "PRAGMA wal_checkpoint(TRUNCATE);"

# WAL Mode prüfen (sollte "wal" sein)
./scripts/production/query-db.sh "PRAGMA journal_mode;"
```

---

### Server läuft nicht

```bash
# PM2 Status
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 status"

# Logs (letzte 50 Zeilen)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 logs timetracking-server --lines 50 --nostream"

# Server neustarten
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 restart timetracking-server"
```

---

## 📊 Server Monitoring

### PM2 Commands

```bash
# Status aller Services
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 status"

# Live-Logs (Ctrl+C zum Beenden)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 logs timetracking-server --lines 20"

# Memory/CPU Usage
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 monit"

# Server neustarten
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 restart timetracking-server"

# Server stoppen
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 stop timetracking-server"
```

---

### System Monitoring

```bash
# Disk Space + Memory
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "df -h && echo '---' && free -h"

# CPU & Prozesse
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "top -bn1 | head -20"

# Netzwerk (Port 3000)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "ss -tulpn | grep :3000"
```

---

## 📝 Connection Details

**Production Server:**
- Host: `129.159.8.19`
- User: `ubuntu`
- Port: `22`
- SSH Key: `.ssh/oracle_server.key`
- DB Path: `/home/ubuntu/TimeTracking-Clean/server/database.db`
- PM2 Service: `timetracking-server`
- API URL: `http://129.159.8.19:3000`

**Environment Variables:**
- Definiert in `.env.ssh` (lokal)
- Definiert in `/home/ubuntu/TimeTracking-Clean/server/.env` (prod)

---

## 🚀 Quick Reference

**Lokale Entwicklung:**
```bash
./scripts/dev/start.sh         # Server + Desktop starten
./scripts/dev/stop.sh          # Alles stoppen
```

**Production Deploy:**
```bash
./scripts/production/deploy.sh           # Deployment
./scripts/production/connect.sh          # SSH
./scripts/production/backup-db.sh        # DB Backup
```

**Database Management:**
```bash
./scripts/database/backup.sh daily       # Backup erstellen
./scripts/database/restore.sh --list     # Backups anzeigen
./scripts/database/sync-prod.sh          # Prod → Dev sync
```

---

**Letzte Aktualisierung:** 2025-01-15
