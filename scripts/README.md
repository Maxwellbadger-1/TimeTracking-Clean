# Production Server Scripts

Diese Scripts erleichtern den Zugriff auf den Oracle Cloud Production Server.

## Voraussetzungen

- SSH-Keys müssen im `.ssh/` Verzeichnis liegen (bereits vorhanden)
- `.env.ssh` File mit Verbindungsdaten (bereits vorhanden)

## Verfügbare Scripts

### 1. `connect-to-prod.sh` - SSH-Verbindung zum Server

```bash
./scripts/connect-to-prod.sh
```

Stellt eine direkte SSH-Verbindung zum Production Server her.

**Alternativ (manuell):**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

---

### 2. `query-prod-db-node.sh` - Datenbank-Abfragen (Node.js)

```bash
./scripts/query-prod-db-node.sh "SELECT * FROM users WHERE deletedAt IS NULL"
```

Führt SQL-Queries auf der Production Database aus (nutzt Node.js + better-sqlite3).

**WICHTIG:** Nutze dieses Script, da `sqlite3` CLI nicht auf dem Server installiert ist!

**Beispiele:**

```bash
# Alle aktiven Benutzer anzeigen
./scripts/query-prod-db-node.sh "SELECT id, firstName, lastName, email, role FROM users WHERE deletedAt IS NULL ORDER BY id"

# Anzahl der Benutzer
./scripts/query-prod-db-node.sh "SELECT COUNT(*) as user_count FROM users WHERE deletedAt IS NULL"

# Zeiteinträge heute
./scripts/query-prod-db-node.sh "SELECT * FROM time_entries WHERE date = date('now')"

# Offene Urlaubsanträge
./scripts/query-prod-db-node.sh "SELECT * FROM absence_requests WHERE status = 'pending'"

# Standard-Query (ohne Parameter)
./scripts/query-prod-db-node.sh
# Zeigt: SELECT id, firstName, lastName, email FROM users WHERE deletedAt IS NULL LIMIT 10
```

**Output Format:** JSON (pretty-printed)

---

### 2b. `query-prod-db.sh` - Datenbank-Abfragen (sqlite3 CLI)

```bash
./scripts/query-prod-db.sh "SELECT * FROM users WHERE deletedAt IS NULL"
```

**HINWEIS:** Dieses Script funktioniert NUR, wenn `sqlite3` CLI auf dem Server installiert ist (derzeit NICHT der Fall!). Nutze stattdessen `query-prod-db-node.sh`.

---

### 3. `backup-prod-db.sh` - Database Backup

```bash
./scripts/backup-prod-db.sh
```

Erstellt ein Backup der Production Database im `backups/` Verzeichnis mit Timestamp.

**Output:**
```
📦 Backing up production database...
✅ Backup successful: backups/database-20250114-143022.db
📊 File size: 2.3M
```

---

## Weitere nützliche Commands

### PM2 Status & Logs

```bash
# Server-Status
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 status"

# Logs anzeigen (letzte 50 Zeilen)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 logs timetracking-server --lines 50 --nostream"

# Live-Logs (Strg+C zum Beenden)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 logs timetracking-server --lines 20"

# Server neustarten
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 restart timetracking-server"
```

### System-Monitoring

```bash
# Disk Space + Memory
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "df -h && echo '---' && free -h"

# CPU & Prozesse
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "top -bn1 | head -20"

# Netzwerk-Verbindungen
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "ss -tulpn | grep :3000"
```

### Diagnose-Script

```bash
# Vollständige Diagnose ausführen
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "bash /home/ubuntu/TimeTracking-Clean/diagnose-production.sh"
```

---

## Sicherheit

- SSH-Keys sind in `.gitignore` und werden NIEMALS committed
- Private Key hat 600 Permissions (nur Owner lesen/schreiben)
- Public Key hat 644 Permissions (Owner + Others lesen)

**Key-Permissions prüfen:**
```bash
ls -la .ssh/
# Sollte zeigen:
# -rw------- oracle_server.key (600)
# -rw-r--r-- oracle_server.key.pub (644)
```

---

## Troubleshooting

### "Permission denied (publickey)"

```bash
# 1. Key-Permissions fixen
chmod 600 .ssh/oracle_server.key
chmod 644 .ssh/oracle_server.key.pub

# 2. Key-Fingerprint prüfen
ssh-keygen -l -f .ssh/oracle_server.key.pub

# 3. Verbose SSH für Details
ssh -v -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

### "Database locked"

Die Production DB nutzt WAL Mode (Write-Ahead Logging) für Multi-User Access. Wenn trotzdem "locked" Fehler auftreten:

```bash
# WAL-Checkpoint ausführen
./scripts/query-prod-db.sh "PRAGMA wal_checkpoint(TRUNCATE);"

# WAL Mode prüfen
./scripts/query-prod-db.sh "PRAGMA journal_mode;"
# Sollte "wal" zurückgeben
```

---

## Connection Details

Alle Verbindungsdaten sind in `.env.ssh` gespeichert:

- **Host:** 129.159.8.19
- **User:** ubuntu
- **Port:** 22
- **Key:** .ssh/oracle_server.key
- **DB Path:** /home/ubuntu/TimeTracking-Clean/server/database.db
- **PM2 Service:** timetracking-server
- **API URL:** http://129.159.8.19:3000
