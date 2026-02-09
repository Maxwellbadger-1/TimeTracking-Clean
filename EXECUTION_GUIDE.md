# 🚀 Execution Guide - GREEN Database Fix

**Erstellt:** 2026-02-09
**Status:** 🟢 Ready to Execute
**Geschätzter Zeitaufwand:** 15 Minuten
**Risiko:** Niedrig (Automatische Backups)

---

## ✅ Was du JETZT machen kannst

### Schritt 1: Phase 1 ausführen (SOFORT-FIX)

**Öffne ein Terminal** und führe aus:

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

# Phase 1 Script ausführen
./scripts/production/fix-green-db-phase1.sh
```

**Das passiert automatisch:**
1. ✅ SSH zum Production Server (129.159.8.19)
2. ✅ Backup von GREEN und BLUE DBs erstellen
3. ✅ Migration `20260208_add_position_column.sql` ausführen
4. ✅ Schema validieren (position column vorhanden?)
5. ✅ Server neu starten
6. ✅ Health Check

**Erwartete Ausgabe:**
```
🔄 Phase 1: GREEN Database Sofort-Fix
======================================

📍 Auf Server: ip-XXX-XXX-XXX-XXX
👤 User: ubuntu

💾 Schritt 1/5: Backups erstellen...
   ✅ Backups erstellt:
   -rw-r--r-- 1 ubuntu ubuntu 48M Feb  9 10:30 database.db.backup.20260209_103045

🔄 Schritt 2/5: Migration ausführen...
   ✅ Migration applied: 20260208_add_position_column.sql

🔍 Schritt 3/5: Schema validieren...
   ✅ users.position column exists
   ✅ VALIDATION PASSED

🔄 Schritt 4/5: Server neu starten...
   ✅ GREEN server started

🏥 Schritt 5/5: Health Check...
   ✅ Health Check passed (HTTP 200)

================================================
✅ Phase 1 erfolgreich abgeschlossen!
================================================
```

**Dauer:** ~3-5 Minuten (abhängig von Server-Response)

---

### Schritt 2: Testen

**Öffne ein neues Terminal** und teste die Production App:

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/desktop

# Desktop App starten
npm run dev
```

**Teste folgendes:**
- [ ] Login funktioniert
- [ ] `/api/auth/me` gibt keine 500 Error mehr
- [ ] User-Profil öffnen (sollte position field haben)
- [ ] Zeiterfassung funktioniert
- [ ] Überstunden anzeigen funktioniert
- [ ] Keine Console-Errors

**Wenn alles OK:** ✅ Phase 1 erfolgreich! GREEN DB funktioniert jetzt.

---

### Schritt 3: Phase 2 (Optional, später)

**Wann:** Diese Woche, wenn Zeit ist (30 Min)
**Warum:** Langfristige Lösung - Keine DB-Sync Probleme mehr

```bash
# Phase 2 Script ausführen
./scripts/production/fix-green-db-phase2.sh
```

**Vorteile von Phase 2:**
- ✅ Nur noch EINE Datenbank (statt 2)
- ✅ Migrations nur 1x ausführen
- ✅ Keine Sync-Probleme zwischen BLUE/GREEN
- ✅ Einfacheres Deployment

---

## 🚨 Falls etwas schief geht

### Problem: Script schlägt fehl

**Lösung:** Logs prüfen
```bash
# Check was schief ging
ssh ubuntu@129.159.8.19
pm2 logs timetracking-server --lines 100
```

### Problem: Health Check failed

**Rollback für Phase 1:**
```bash
# SSH zum Server
ssh ubuntu@129.159.8.19

# Server stoppen
pm2 stop timetracking-server

# Backup wiederherstellen (Timestamp anpassen!)
cd /home/ubuntu/TimeTracking-Clean/server
cp database.db.backup.20260209_103045 database.db

# Server neu starten
pm2 start timetracking-server

# Verify
curl http://localhost:3000/api/health
```

### Problem: 500 Error bleibt

**Manuell prüfen:**
```bash
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean/server

# Schema manuell prüfen
sqlite3 database.db "PRAGMA table_info(users);" | grep position

# Falls position fehlt:
sqlite3 database.db "ALTER TABLE users ADD COLUMN position TEXT;"

# Server neu starten
pm2 restart timetracking-server
```

---

## 📊 Monitoring (Optional)

**Nach erfolgreicher Phase 1:**

```bash
# Schema Monitoring einrichten
./scripts/production/monitor-db-schema.sh

# Oder via Cron (täglich um 2 Uhr)
# Bearbeite auf dem Server: crontab -e
# Füge hinzu:
# 0 2 * * * /home/ubuntu/TimeTracking-Clean/scripts/production/monitor-db-schema.sh --cron
```

---

## 📚 Dokumentation

- **Vollständiger Plan:** [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md)
- **Quick Start:** [QUICK_START_BLUE_GREEN_FIX.md](QUICK_START_BLUE_GREEN_FIX.md)
- **Strategy:** [DATABASE_MIGRATION_STRATEGY.md](DATABASE_MIGRATION_STRATEGY.md)
- **Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

## ✅ Checkliste

### Phase 1 (Heute):
- [ ] Script ausgeführt: `./scripts/production/fix-green-db-phase1.sh`
- [ ] Alle Schritte erfolgreich (✅ im Output)
- [ ] Health Check passed (HTTP 200)
- [ ] Production App getestet
- [ ] Login funktioniert
- [ ] Keine 500 Errors

### Phase 2 (Diese Woche, Optional):
- [ ] Script ausgeführt: `./scripts/production/fix-green-db-phase2.sh`
- [ ] Shared Database erstellt
- [ ] GREEN Server läuft mit Shared DB
- [ ] Production App getestet (ausführlich!)
- [ ] Alles funktioniert

### Phase 3 (Optional):
- [ ] Monitoring Script getestet
- [ ] Cron Job eingerichtet (optional)
- [ ] Alte .OLD DBs gelöscht (nach 1 Woche)

---

## 🎯 Erfolg!

**Nach Phase 1:**
- ✅ GREEN DB hat position column
- ✅ Keine 500 Errors mehr
- ✅ Kann auf v1.6.x upgraden

**Nach Phase 2:**
- ✅ Nur noch eine DB zu pflegen
- ✅ Nie wieder Sync-Probleme
- ✅ Einfacheres Deployment

---

**Viel Erfolg! 🚀**

Bei Fragen: Siehe Troubleshooting in [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md)
