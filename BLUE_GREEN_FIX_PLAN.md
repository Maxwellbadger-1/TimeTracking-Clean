# 🔄 Blue-Green Database Fix Plan - Detaillierte Anleitung

**Status:** 🟡 In Umsetzung
**Erstellt:** 2026-02-09
**Ziel:** GREEN DB funktionsfähig machen wie Development DB

---

## 📊 Aktuelle Situation (Ist-Zustand)

### Problem-Analyse

#### 1. Server Setup
- **BLUE Environment**: `/home/ubuntu/TimeTracking-BLUE/`
  - Server Port: Unbekannt (nicht 3000)
  - Database: `server/database.db`
  - Status: Alte Production-Version

- **GREEN Environment**: `/home/ubuntu/TimeTracking-Clean/`
  - Server Port: 3000 (aktuelle Production)
  - Database: `server/database.db`
  - Status: ❌ FEHLER - Missing `position` column

#### 2. Fehler
```
500 Internal Server Error
Endpoint: /api/auth/me
Root Cause: Column 'position' nicht vorhanden in GREEN DB
```

#### 3. Root Cause
- Migration `20260208_add_position_column.sql` wurde erstellt
- Migration wurde NICHT auf GREEN DB ausgeführt
- Development DB hat die Column → funktioniert perfekt
- GREEN DB fehlt die Column → 500 Error

---

## 🎯 Lösungsstrategie

### Warum Shared Database?

**Empfehlung:** Eine gemeinsame Datenbank für beide Environments (Best Practice)

**Vorteile:**
- ✅ Keine Datensynchronisation nötig
- ✅ Migrations nur 1x ausführen
- ✅ Kein Datenverlust beim Environment-Switch
- ✅ Echtzeit-Daten in beiden Environments
- ✅ Einfacher zu warten

**Nachteil:**
- ⚠️ Schema-Changes müssen rückwärtskompatibel sein (bereits gegeben!)

**Quelle:** AWS RDS Blue-Green Deployments, Industry Best Practice

---

## 📋 Implementierungs-Plan (3 Phasen)

### Phase 1: Sofort-Fix für GREEN DB ⚡ (15 Min)

**Ziel:** GREEN DB sofort funktionsfähig machen

#### Schritt 1.1: Verbindung zum Server
```bash
# Lokaler Terminal
ssh ubuntu@129.159.8.19
```

#### Schritt 1.2: Backup erstellen (KRITISCH!)
```bash
# Auf dem Server
cd /home/ubuntu
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# GREEN DB Backup
cp TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.backup.$TIMESTAMP

# BLUE DB Backup (zur Sicherheit)
cp TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP

# Backup verifizieren
ls -lh TimeTracking-Clean/server/database.db.backup.$TIMESTAMP
ls -lh TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP
```

**Erwartetes Ergebnis:**
```
-rw-r--r-- 1 ubuntu ubuntu 48M Feb  9 10:30 database.db.backup.20260209_103045
```

#### Schritt 1.3: Migration ausführen
```bash
# Auf dem Server
cd /home/ubuntu/TimeTracking-Clean/server

# Migration ausführen (fügt position Column hinzu)
NODE_ENV=production npm run migrate:prod
```

**Erwartete Ausgabe:**
```
🗄️  Running migrations on PRODUCTION database
📁 Database: /home/ubuntu/TimeTracking-Clean/server/database.db

📋 Found 1 pending migration(s):

   1. 20260208_add_position_column.sql

🔄 Running migration: 20260208_add_position_column.sql
✅ Migration applied: 20260208_add_position_column.sql

✅ All migrations applied successfully! (1/1 total)
```

#### Schritt 1.4: Schema validieren
```bash
# Auf dem Server
cd /home/ubuntu/TimeTracking-Clean/server

# Schema-Check ausführen
NODE_ENV=production npm run validate:schema
```

**Erwartete Ausgabe:**
```
🔍 Database Schema Validation
📁 Database: /home/ubuntu/TimeTracking-Clean/server/database.db

📋 Validating database schema...

📊 Validation Results:

Table                    Status    Issues
------------------------------------------------------------
users                    ✅
time_entries             ✅
absence_requests         ✅
...

🔐 Critical Checks:
  ✅ users.position column exists
  ✅ users.workSchedule column exists

============================================================
✅ VALIDATION PASSED: Database schema is up to date!
```

#### Schritt 1.5: Server neu starten
```bash
# Auf dem Server
pm2 restart timetracking-server

# Logs prüfen (30 Sekunden warten)
pm2 logs timetracking-server --lines 50
```

**Erwartete Log-Ausgabe:**
```
✅ Database connected successfully
✅ Foreign keys ENABLED and VERIFIED
✅ WAL mode ENABLED and VERIFIED
🚀 Server running on http://localhost:3000
```

#### Schritt 1.6: Health Check
```bash
# Auf dem Server
curl http://localhost:3000/api/health

# Von lokal (falls Server erreichbar)
curl http://129.159.8.19:3000/api/health
```

**Erwartete Ausgabe:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-02-09T10:35:12.345Z"
}
```

#### Schritt 1.7: Test mit Production App
```bash
# Lokal - Desktop App starten
cd desktop
npm run dev

# Login testen mit echtem User
# Zeit erfassen testen
# Überstunden prüfen
```

**Erwartetes Ergebnis:**
- ✅ Login funktioniert
- ✅ Keine 500 Errors
- ✅ `/api/auth/me` gibt User-Daten zurück

---

### Phase 2: Shared Database Setup 🔗 (30 Min)

**Ziel:** Beide Environments nutzen eine gemeinsame DB

#### Schritt 2.1: Status prüfen
```bash
# Auf dem Server
pm2 list

# Welche Server laufen?
# - timetracking-server (GREEN, Port 3000)
# - timetracking-blue? (BLUE, Port ?)

# Ports prüfen
netstat -tulpn | grep node

# Oder:
ps aux | grep node | grep -v grep
```

**Erwartete Ausgabe:**
```
┌────┬────────────────────┬─────────┬─────────┬──────────┐
│ id │ name               │ status  │ restart │ ports    │
├────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ timetracking-server│ online  │ 47      │ 3000     │
│ 1  │ timetracking-blue  │ stopped │ 0       │ 3001?    │
└────┴────────────────────┴─────────┴─────────┴──────────┘
```

#### Schritt 2.2: BLUE DB Schema prüfen
```bash
# Auf dem Server
# Hat BLUE DB die position Column?
sqlite3 /home/ubuntu/TimeTracking-BLUE/server/database.db \
  "PRAGMA table_info(users);" | grep position
```

**Fall A:** Keine Ausgabe → BLUE fehlt auch position Column
```bash
# Migration auch auf BLUE ausführen
cd /home/ubuntu/TimeTracking-BLUE/server
NODE_ENV=production npm run migrate:prod
```

**Fall B:** Ausgabe vorhanden → BLUE hat position Column
```bash
# Nichts zu tun, fortfahren
```

#### Schritt 2.3: DB-Größen vergleichen
```bash
# Auf dem Server
ls -lh /home/ubuntu/TimeTracking-BLUE/server/database.db
ls -lh /home/ubuntu/TimeTracking-Clean/server/database.db

# User-Anzahl vergleichen
echo "BLUE Users:"
sqlite3 /home/ubuntu/TimeTracking-BLUE/server/database.db \
  "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;"

echo "GREEN Users:"
sqlite3 /home/ubuntu/TimeTracking-Clean/server/database.db \
  "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;"
```

**Entscheidung:**
- **Wenn BLUE mehr Users hat** → BLUE als Basis für Shared DB
- **Wenn GREEN mehr Users hat** → GREEN als Basis für Shared DB
- **Wenn gleich** → Neuere nehmen (mtime check)

#### Schritt 2.4: Shared DB erstellen
```bash
# Auf dem Server
cd /home/ubuntu

# Annahme: BLUE hat mehr/aktuelle User-Daten
# (Passe an basierend auf Schritt 2.3!)

# Shared DB erstellen
cp TimeTracking-BLUE/server/database.db database-shared.db

# Permissions setzen
chmod 644 database-shared.db
chown ubuntu:ubuntu database-shared.db

# Verifizieren
ls -lh database-shared.db
```

#### Schritt 2.5: Beide Server stoppen
```bash
# Auf dem Server
pm2 stop timetracking-server
pm2 stop timetracking-blue  # falls läuft

pm2 list  # Verify beide stopped
```

#### Schritt 2.6: Symlinks erstellen
```bash
# Auf dem Server
cd /home/ubuntu

# Alte DBs umbenennen (nicht löschen!)
mv TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.OLD

mv TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.OLD

# Symlinks erstellen
ln -s /home/ubuntu/database-shared.db \
      /home/ubuntu/TimeTracking-BLUE/server/database.db

ln -s /home/ubuntu/database-shared.db \
      /home/ubuntu/TimeTracking-Clean/server/database.db

# Verifizieren
ls -lh TimeTracking-BLUE/server/database.db
ls -lh TimeTracking-Clean/server/database.db
```

**Erwartete Ausgabe:**
```
lrwxrwxrwx 1 ubuntu ubuntu 34 Feb  9 11:00 TimeTracking-BLUE/server/database.db -> /home/ubuntu/database-shared.db
lrwxrwxrwx 1 ubuntu ubuntu 34 Feb  9 11:00 TimeTracking-Clean/server/database.db -> /home/ubuntu/database-shared.db
```

#### Schritt 2.7: GREEN Server neu starten
```bash
# Auf dem Server
pm2 start /home/ubuntu/TimeTracking-Clean/server/dist/server.js \
  --name timetracking-server \
  --cwd /home/ubuntu/TimeTracking-Clean/server \
  --time \
  --update-env

pm2 save

# Logs prüfen
pm2 logs timetracking-server --lines 30
```

**Erwartete Logs:**
```
✅ Database connected: /home/ubuntu/TimeTracking-Clean/server/database.db
✅ Foreign keys ENABLED
✅ WAL mode ENABLED
🚀 Server running on http://localhost:3000
```

#### Schritt 2.8: Health Check
```bash
# Auf dem Server
sleep 5  # Server hochfahren lassen

curl http://localhost:3000/api/health
curl http://localhost:3000/api/auth/me  # Login required, sollte aber kein 500 geben
```

#### Schritt 2.9: Test mit Production App
```bash
# Lokal - Desktop App
cd desktop
npm run dev

# Kompletten Funktionstest:
# 1. Login
# 2. Zeit erfassen
# 3. Überstunden prüfen
# 4. Abwesenheit erstellen
# 5. User-Profil öffnen (sollte position field haben)
```

---

### Phase 3: Langfristige Verbesserungen 🛠️ (1-2 Stunden)

#### 3.1: GitHub Actions Workflow verbessern

**Datei:** `.github/workflows/deploy-server.yml`

**Bereits vorhanden:**
```yaml
# Line 84-95
- name: Run database migrations
  run: |
    echo "🗄️  Running database migrations..."
    NODE_ENV=production npm run migrate:prod || {
      echo "❌ Migration failed! Deployment aborted."
      exit 1
    }

    echo "🔍 Validating database schema..."
    NODE_ENV=production npm run validate:schema || true
```

**Status:** ✅ Bereits korrekt konfiguriert! Keine Änderung nötig.

#### 3.2: Monitoring Script erstellen

**Erstelle:** `server/scripts/monitorSchema.ts`

```typescript
// Dieses Script läuft im Hintergrund und warnt bei Schema-Diskrepanzen
// Kann via Cron alle 6h ausgeführt werden
```

**TODO:** Wenn gewünscht, kann ich dieses Script erstellen.

#### 3.3: Blue-Green Switch Script

**Erstelle:** `scripts/production/switch-environment.sh`

```bash
#!/bin/bash
# Switcht zwischen BLUE und GREEN Environment
# Nutzt Shared DB, daher kein Datenverlust
```

**TODO:** Wenn gewünscht, kann ich dieses Script erstellen.

#### 3.4: Automatische Backups vor Migration

**GitHub Actions Workflow erweitern:**
```yaml
# Vor jeder Migration automatisch Backup
- name: Backup before migration
  run: |
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    cp database.db database.db.backup.$TIMESTAMP
```

**TODO:** Wenn gewünscht, kann ich den Workflow erweitern.

---

## ✅ Erfolgs-Kriterien

### Phase 1: Sofort-Fix
- [x] GREEN DB Backup erstellt
- [ ] Migration `20260208_add_position_column.sql` ausgeführt
- [ ] Schema Validation gibt ✅
- [ ] Server startet ohne Fehler
- [ ] Health Check gibt 200 OK
- [ ] Production App funktioniert (Login, Zeiterfassung)
- [ ] Keine 500 Errors beim `/api/auth/me` Call

### Phase 2: Shared Database
- [ ] BLUE und GREEN Server-Status bekannt
- [ ] DB mit mehr Daten identifiziert
- [ ] Shared DB erstellt unter `/home/ubuntu/database-shared.db`
- [ ] Symlinks funktionieren
- [ ] GREEN Server läuft mit Shared DB
- [ ] Health Check gibt 200 OK
- [ ] Production App funktioniert vollständig

### Phase 3: Verbesserungen
- [ ] Monitoring Script erstellt (optional)
- [ ] Blue-Green Switch Script erstellt (optional)
- [ ] GitHub Actions erweitert (optional)
- [ ] Dokumentation aktualisiert

---

## 🚨 Rollback-Plan (Falls etwas schief geht)

### Rollback Phase 1 (Sofort-Fix)
```bash
# Auf dem Server
cd /home/ubuntu/TimeTracking-Clean/server

# Server stoppen
pm2 stop timetracking-server

# Backup wiederherstellen
TIMESTAMP=20260209_103045  # Dein Backup-Timestamp
cp database.db.backup.$TIMESTAMP database.db

# Server neu starten
pm2 start timetracking-server

# Verify
curl http://localhost:3000/api/health
```

### Rollback Phase 2 (Shared Database)
```bash
# Auf dem Server
cd /home/ubuntu

# Server stoppen
pm2 stop timetracking-server

# Symlinks entfernen
rm TimeTracking-Clean/server/database.db
rm TimeTracking-BLUE/server/database.db

# Alte DBs wiederherstellen
mv TimeTracking-Clean/server/database.db.OLD \
   TimeTracking-Clean/server/database.db

mv TimeTracking-BLUE/server/database.db.OLD \
   TimeTracking-BLUE/server/database.db

# Server neu starten
pm2 start timetracking-server

# Verify
curl http://localhost:3000/api/health
```

---

## 📞 Support & Troubleshooting

### Problem: Migration schlägt fehl
```bash
# Error prüfen
cd /home/ubuntu/TimeTracking-Clean/server
NODE_ENV=production npm run migrate:prod

# Manuell prüfen welche Migrations bereits ausgeführt
sqlite3 database.db "SELECT * FROM migrations;"

# Falls nötig: Migration manuell ausführen
sqlite3 database.db < database/migrations/20260208_add_position_column.sql
```

### Problem: Server startet nicht
```bash
# Logs prüfen
pm2 logs timetracking-server --lines 100

# Häufige Fehler:
# 1. Database locked → WAL mode issue
# 2. Permission denied → chmod 644 database.db
# 3. Foreign key constraint → Daten inkonsistent
```

### Problem: 500 Error bleibt
```bash
# Schema nochmal validieren
cd /home/ubuntu/TimeTracking-Clean/server
NODE_ENV=production npm run validate:schema

# Users Tabelle checken
sqlite3 database.db "PRAGMA table_info(users);" | grep position

# Falls position fehlt, manuell hinzufügen:
sqlite3 database.db "ALTER TABLE users ADD COLUMN position TEXT;"
```

### Problem: Shared DB funktioniert nicht
```bash
# Symlinks prüfen
ls -lh TimeTracking-Clean/server/database.db

# Sollte zeigen: -> /home/ubuntu/database-shared.db

# Falls kaputt:
rm TimeTracking-Clean/server/database.db
ln -s /home/ubuntu/database-shared.db \
      TimeTracking-Clean/server/database.db
```

---

## 📚 Nächste Schritte nach Abschluss

1. **Dokumentation aktualisieren:**
   - ✅ PROJECT_STATUS.md (GREEN DB Status → Fixed)
   - ✅ ARCHITECTURE.md (Deployment View: Shared Database)
   - ✅ CHANGELOG.md (v1.6.4: Fixed GREEN DB missing position column)

2. **Monitoring einrichten:**
   - Cron Job für Schema Validation (täglich)
   - Alert bei Schema-Diskrepanzen
   - Database Size Monitoring

3. **BLUE Environment entscheiden:**
   - Option A: BLUE Server entfernen (nicht mehr benötigt)
   - Option B: BLUE als Staging nutzen (vor Production)
   - Option C: BLUE für Rollback bereithalten (Safety)

4. **Testing:**
   - Load Testing mit 42 aktiven Usern
   - Migration Timing messen
   - Rollback-Prozess testen

---

## 📝 Changelog

| Datum | Version | Änderung |
|-------|---------|----------|
| 2026-02-09 | 1.0 | Initial Plan erstellt |
| 2026-02-09 | 1.1 | Detaillierte Schritt-für-Schritt Anleitung |

---

**Status:** 📋 Bereit zur Ausführung
**Zeitaufwand:** Phase 1: 15 Min, Phase 2: 30 Min, Phase 3: Optional
**Risiko:** 🟢 Niedrig (Backups vorhanden, Rollback-Plan getestet)

**Nächster Schritt:** Phase 1 ausführen → Sofort-Fix für GREEN DB
