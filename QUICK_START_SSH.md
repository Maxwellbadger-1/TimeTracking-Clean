# Quick Start: SSH-Zugriff auf Production Server

## Voraussetzungen

Alle benötigten Files sind bereits im Projekt:
- ✅ SSH-Keys: `.ssh/oracle_server.key` + `.ssh/oracle_server.key.pub`
- ✅ Config: `.env.ssh`
- ✅ Scripts: `scripts/*.sh`

## Schnellstart

### 1. Server-Verbindung (SSH)

```bash
./scripts/connect-to-prod.sh
```

**Alternativ (manuell):**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

---

### 2. Datenbank-Abfragen

```bash
# Alle Benutzer
./scripts/query-prod-db-node.sh "SELECT id, firstName, lastName, email FROM users WHERE deletedAt IS NULL"

# Anzahl der Benutzer
./scripts/query-prod-db-node.sh "SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL"

# Zeiteinträge heute
./scripts/query-prod-db-node.sh "SELECT * FROM time_entries WHERE date = date('now')"
```

**Output:** JSON Format

---

### 3. Database Backup

```bash
./scripts/backup-prod-db.sh
```

Erstellt automatisch: `backups/database-YYYYMMDD-HHMMSS.db`

---

## Häufige Aufgaben

### PM2 Server-Status

```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 status"
```

### Server-Logs anzeigen

```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 logs timetracking-server --lines 50 --nostream"
```

### Server neustarten

```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "pm2 restart timetracking-server"
```

### Diagnose-Script ausführen

```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "bash /home/ubuntu/TimeTracking-Clean/diagnose-production.sh"
```

---

## Connection Details

```
Host:     129.159.8.19
User:     ubuntu
Port:     22
Key:      .ssh/oracle_server.key
DB Path:  /home/ubuntu/TimeTracking-Clean/server/database.db
API:      http://129.159.8.19:3000
```

Alle Details sind in `.env.ssh` gespeichert.

---

## Troubleshooting

### "Permission denied (publickey)"

```bash
# Fix Key-Permissions
chmod 600 .ssh/oracle_server.key
chmod 644 .ssh/oracle_server.key.pub

# Verbose SSH für Details
ssh -v -i .ssh/oracle_server.key ubuntu@129.159.8.19
```

### "sqlite3: command not found"

Nutze `query-prod-db-node.sh` statt `query-prod-db.sh` - sqlite3 CLI ist nicht auf dem Server installiert!

---

## Sicherheit

- SSH-Keys sind in `.gitignore` (werden NIEMALS committed)
- Backups sind in `.gitignore` (Production-Daten bleiben privat)
- Private Key hat 600 Permissions (nur Owner lesen/schreiben)

---

## Weitere Dokumentation

Siehe `scripts/README.md` für detaillierte Beschreibungen aller Scripts.
