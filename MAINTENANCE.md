# 🛠️ MAINTENANCE GUIDE
**Stiftung der DPolG TimeTracker**
**Version:** 1.0
**Last Updated:** 2025-11-04

---

## 📋 Table of Contents

1. [Backup & Restore](#backup--restore)
2. [Data Cleanup (DSGVO)](#data-cleanup-dsgvo)
3. [Database Maintenance](#database-maintenance)
4. [Monitoring & Health](#monitoring--health)
5. [Cronjob Setup](#cronjob-setup)
6. [Troubleshooting](#troubleshooting)

---

## 💾 Backup & Restore

### Automatic Backup System

Das System verwendet **GFS-Rotation** (Grandfather-Father-Son):
- **Daily:** 7 Tage behalten
- **Weekly:** 4 Wochen behalten
- **Monthly:** 12 Monate behalten

### Manual Backup

```bash
# Daily Backup erstellen
./server/scripts/backup.sh daily

# Weekly Backup erstellen (z.B. Sonntags)
./server/scripts/backup.sh weekly

# Monthly Backup erstellen (z.B. am 1. des Monats)
./server/scripts/backup.sh monthly
```

**Output:**
```
================================================
🚀 Enterprise Backup System
   Stiftung der DPolG TimeTracker
================================================
✅ Backup completed: database_daily_20251104_221547.db
📊 Database size: 140K
📦 Backup size: 152K
================================================
```

### Backup-Verzeichnisstruktur

```
backups/
├── daily/
│   ├── database_daily_20251104_020000.db
│   ├── database_daily_20251103_020000.db
│   └── ... (letzte 7 Tage)
├── weekly/
│   ├── database_week45_2025.db
│   ├── database_week44_2025.db
│   └── ... (letzte 4 Wochen)
├── monthly/
│   ├── database_2025-11.db
│   ├── database_2025-10.db
│   └── ... (letzte 12 Monate)
├── pre-restore/          # Safety Backups vor Restore
├── pre-cleanup/          # Safety Backups vor Cleanup
└── backup-health.log     # Health Check Log
```

### Verfügbare Backups anzeigen

```bash
./server/scripts/restore.sh --list
```

**Output:**
```
================================================
📂 Available Backups
================================================

📅 Daily Backups:
   database_daily_20251104_020000.db (152K) - 20251104_020000
   database_daily_20251103_020000.db (148K) - 20251103_020000
   ...

📆 Weekly Backups:
   database_week45_2025.db (152K)
   ...

📊 Monthly Backups:
   database_2025-11.db (152K)
   ...
================================================
```

### Datenbank wiederherstellen

⚠️ **WICHTIG:** Server muss gestoppt sein!

```bash
# 1. Server stoppen
./stop-dev.sh

# 2. Backup wiederherstellen
./server/scripts/restore.sh database_daily_20251104_020000.db

# 3. Bestätigung eingeben
Are you sure you want to restore? (yes/NO): yes

# 4. Server neu starten
./SIMPLE-START.sh
```

**Der Restore-Prozess:**
1. ✅ Erstellt automatisch Safety-Backup der aktuellen DB
2. ✅ Verifiziert das Backup (Integrity Check)
3. ✅ Stellt die Datenbank wieder her
4. ✅ Verifiziert die wiederhergestellte DB
5. ✅ Rollback bei Fehler

**Rollback bei Problemen:**

Wenn nach dem Restore etwas schief geht, kannst du zur vorherigen Version zurück:

```bash
# Safety Backup finden
ls -lh backups/pre-restore/

# Zurück zur vorherigen Version
cp backups/pre-restore/database_pre_restore_TIMESTAMP.db server/database.db
```

---

## 🗑️ Data Cleanup (DSGVO)

### 4-Jahres-Aufbewahrungspflicht

Gemäß DSGVO müssen Daten älter als 4 Jahre gelöscht werden.

### Dry-Run (Vorschau ohne Änderungen)

```bash
# Zeige was gelöscht würde (KEINE Änderungen!)
./server/scripts/cleanup-old-data.sh --dry-run
```

**Output:**
```
================================================
🗑️  DSGVO Data Cleanup Script
   Stiftung der DPolG TimeTracker
================================================
📋 Retention Period: 4 years
📅 Delete data older than: 2021-11-04

📊 Current Database State:
⏱️  Time Entries: 1234
📅 Absence Requests: 56
📝 Audit Log Entries: 890

================================================
🗑️  Starting Cleanup
================================================

📋 Table: time_entries
   ⚠️  Found 234 old records
   🔍 DRY-RUN: Would delete 234 records

📋 Table: absence_requests
   ⚠️  Found 12 old records
   🔍 DRY-RUN: Would delete 12 records

📋 Table: audit_log
   ⚠️  Found 145 old records
   🔍 DRY-RUN: Would delete 145 records

🔍 DRY-RUN: Would run VACUUM to reclaim disk space
================================================
```

### Cleanup ausführen

⚠️ **WICHTIG:** Erstellt automatisch Backup vor Löschung!

```bash
# Daten löschen (mit Backup)
./server/scripts/cleanup-old-data.sh
```

**Der Cleanup-Prozess:**
1. ✅ Erstellt automatisch Backup vor Cleanup
2. ✅ Löscht Daten älter als 4 Jahre aus:
   - `time_entries` (Zeiterfassungen)
   - `absence_requests` (Urlaubs-/Krankheitsmeldungen)
   - `audit_log` (Audit-Protokoll)
3. ✅ Führt VACUUM aus (Speicherplatz zurückgewinnen)
4. ✅ Zeigt Vorher/Nachher-Statistik

**Welche Daten werden NICHT gelöscht:**
- ✅ `users` - Benutzerdaten (werden NIEMALS automatisch gelöscht)
- ✅ `vacation_balance` - Urlaubssalden (aktuelle Zustände)
- ✅ `overtime_balance` - Überstunden (aktuelle Zustände)
- ✅ `departments`, `projects`, `activities` - Stammdaten
- ✅ `holidays` - Feiertage

### Empfohlene Ausführung

```bash
# Cronjob: Jährlich am 1. Januar um 3:00 Uhr
0 3 1 1 * /path/to/server/scripts/cleanup-old-data.sh
```

---

## 🔧 Database Maintenance

### SQLite VACUUM

VACUUM komprimiert die Datenbank und gibt ungenutzten Speicherplatz frei.

```bash
# Manuelles VACUUM
sqlite3 server/database.db "VACUUM;"
```

⚠️ **Server sollte gestoppt sein!**

### Integrity Check

```bash
# Datenbank-Integrität prüfen
sqlite3 server/database.db "PRAGMA integrity_check;"

# Output bei gesunder DB:
ok
```

### Database Info

```bash
# Tabellen anzeigen
sqlite3 server/database.db ".tables"

# Tabellen-Struktur anzeigen
sqlite3 server/database.db ".schema users"

# Anzahl Einträge pro Tabelle
sqlite3 server/database.db "
  SELECT name,
         (SELECT COUNT(*) FROM sqlite_master AS sm WHERE sm.name = t.name) AS count
  FROM sqlite_master AS t
  WHERE type='table'
  ORDER BY name;
"
```

### Database Size

```bash
# Datenbankgröße anzeigen
du -h server/database.db

# Detaillierte Statistiken
sqlite3 server/database.db "
  SELECT
    SUM(pgsize) AS total_bytes,
    ROUND(SUM(pgsize) / 1024.0 / 1024.0, 2) AS total_mb
  FROM dbstat;
"
```

---

## 📊 Monitoring & Health

### Backup Health Log

```bash
# Letzte Backup-Logs anzeigen
tail -50 backups/backup-health.log

# Nach Fehlern suchen
grep "ERROR" backups/backup-health.log
grep "FAILED" backups/backup-health.log
```

### Database Health Check

```bash
# Schneller Health Check
./server/scripts/backup.sh daily > /dev/null 2>&1 && echo "✅ Backup OK" || echo "❌ Backup FAILED"
```

### Backup Status prüfen

```bash
# Letztes Backup-Datum
ls -lht backups/daily/ | head -2

# Backup älter als 48h?
find backups/daily/ -name "*.db" -mtime +2 -ls
```

### Server Logs

```bash
# Server-Logs anzeigen (wenn PM2 verwendet wird)
pm2 logs timetracker-server

# Fehler in Logs suchen
grep -i "error" server/logs/*.log
```

---

## ⏰ Cronjob Setup

### Empfohlene Cronjobs

```crontab
# Crontab editieren
crontab -e

# Folgende Jobs hinzufügen:

# Daily Backup (02:00 Uhr)
0 2 * * * /path/to/TimeTracking-Clean/server/scripts/backup.sh daily >> /path/to/logs/backup.log 2>&1

# Weekly Backup (Sonntag 03:00 Uhr)
0 3 * * 0 /path/to/TimeTracking-Clean/server/scripts/backup.sh weekly >> /path/to/logs/backup.log 2>&1

# Monthly Backup (1. des Monats 04:00 Uhr)
0 4 1 * * /path/to/TimeTracking-Clean/server/scripts/backup.sh monthly >> /path/to/logs/backup.log 2>&1

# Yearly Data Cleanup (1. Januar 05:00 Uhr)
0 5 1 1 * /path/to/TimeTracking-Clean/server/scripts/cleanup-old-data.sh >> /path/to/logs/cleanup.log 2>&1
```

### Cronjob-Logs überprüfen

```bash
# Cron-Logs auf macOS
log show --predicate 'eventMessage contains "cron"' --last 24h

# Cron-Logs auf Linux
grep CRON /var/log/syslog

# Eigene Backup-Logs
tail -100 /path/to/logs/backup.log
```

---

## 🚨 Troubleshooting

### Backup schlägt fehl

**Problem:** Backup-Script gibt Fehler

**Lösung:**
```bash
# 1. Prüfe ob sqlite3 installiert ist
which sqlite3
# Falls nicht: brew install sqlite3 (macOS) oder apt install sqlite3 (Linux)

# 2. Prüfe Berechtigungen
ls -lh server/database.db
ls -lhd backups/

# 3. Prüfe Festplattenspeicher
df -h

# 4. Prüfe Database Integrity
sqlite3 server/database.db "PRAGMA integrity_check;"
```

### Restore schlägt fehl

**Problem:** Restore liefert Fehler "Backup file corrupted"

**Lösung:**
```bash
# 1. Backup verifizieren
sqlite3 backups/daily/database_XXX.db "PRAGMA integrity_check;"

# 2. Anderes Backup versuchen
./server/scripts/restore.sh --list

# 3. Älteres Backup verwenden
./server/scripts/restore.sh database_daily_ÄLTERES_DATUM.db
```

### Datenbank ist gesperrt

**Problem:** `database is locked`

**Lösung:**
```bash
# 1. Server stoppen
./stop-dev.sh

# 2. Warten (WAL-Mode Checkpoint)
sleep 5

# 3. Prüfe ob Prozesse noch laufen
lsof server/database.db

# 4. Prozesse killen falls nötig
kill -9 <PID>

# 5. Operation wiederholen
```

### Backup-Rotation funktioniert nicht

**Problem:** Zu viele alte Backups

**Lösung:**
```bash
# Manuell alte Backups löschen
cd backups/daily/
ls -lt | tail -n +8 | awk '{print $9}' | xargs rm -f

# Script-Variablen prüfen
grep "RETENTION" server/scripts/backup.sh
```

### Cronjob läuft nicht

**Problem:** Backups werden nicht automatisch erstellt

**Lösung:**
```bash
# 1. Cronjob-Syntax prüfen
crontab -l

# 2. Pfade absolut setzen (nicht relativ!)
# FALSCH: ./server/scripts/backup.sh
# RICHTIG: /full/path/to/server/scripts/backup.sh

# 3. Berechtigungen prüfen
ls -lh /path/to/server/scripts/backup.sh

# 4. Manuell testen
/full/path/to/server/scripts/backup.sh daily
```

---

## 📞 Support & Kontakt

**Bei Problemen:**
1. Überprüfe die Health-Logs: `backups/backup-health.log`
2. Überprüfe die Server-Logs
3. Führe Manual Backup durch
4. Erstelle Backup VOR Änderungen

**Wichtige Dateien:**
- `/server/database.db` - Haupt-Datenbank
- `/backups/` - Alle Backups
- `/backups/backup-health.log` - Backup-Log
- `/server/scripts/` - Maintenance-Scripts

---

## ✅ Maintenance Checklist

### Täglich (automatisch)
- [x] Daily Backup (02:00 Uhr via Cronjob)

### Wöchentlich
- [ ] Backup-Logs prüfen
- [ ] Database Size prüfen

### Monatlich
- [ ] Monthly Backup verifizieren
- [ ] Backup Restore testen (in Test-Environment!)
- [ ] Database Integrity Check

### Jährlich
- [ ] Data Cleanup (>4 Jahre löschen)
- [ ] Backup-Strategie überprüfen
- [ ] Speicherplatz prüfen

---

**Version:** 1.0
**Last Updated:** 2025-11-04
**Maintained by:** Maxflow Software
