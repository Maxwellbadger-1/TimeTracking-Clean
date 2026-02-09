# 🚀 Quick Start: Blue-Green Database Fix

**Zeitaufwand:** 15 Minuten
**Risiko:** 🟢 Niedrig (Backups vorhanden)
**Ziel:** GREEN DB sofort funktionsfähig machen

---

## ⚡ Phase 1: Sofort-Fix (Copy-Paste Ready)

### Schritt 1: SSH Verbindung
```bash
ssh ubuntu@129.159.8.19
```

### Schritt 2: Backup erstellen (KRITISCH!)
```bash
cd /home/ubuntu
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# GREEN DB Backup
cp TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.backup.$TIMESTAMP

# BLUE DB Backup (zur Sicherheit)
cp TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP

# Verify
ls -lh TimeTracking-Clean/server/database.db.backup.$TIMESTAMP
```

**Erwarte:** `-rw-r--r-- 1 ubuntu ubuntu 48M Feb  9 10:30 ...`

### Schritt 3: Migration ausführen
```bash
cd /home/ubuntu/TimeTracking-Clean/server
NODE_ENV=production npm run migrate:prod
```

**Erwarte:**
```
✅ Migration applied: 20260208_add_position_column.sql
✅ All migrations applied successfully! (1/1 total)
```

### Schritt 4: Schema validieren
```bash
cd /home/ubuntu/TimeTracking-Clean/server
NODE_ENV=production npm run validate:schema
```

**Erwarte:**
```
🔐 Critical Checks:
  ✅ users.position column exists
✅ VALIDATION PASSED: Database schema is up to date!
```

### Schritt 5: Server neu starten
```bash
pm2 restart timetracking-server
sleep 5
pm2 logs timetracking-server --lines 30
```

**Erwarte:**
```
✅ Database connected successfully
🚀 Server running on http://localhost:3000
```

### Schritt 6: Health Check
```bash
curl http://localhost:3000/api/health
```

**Erwarte:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-02-09T..."
}
```

### Schritt 7: Test mit Production App
```bash
# Lokal - Terminal öffnen
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/desktop
npm run dev

# Im Browser/App:
# 1. Login testen
# 2. Überstunden prüfen
# 3. Zeit erfassen
```

**Erwarte:** ✅ Keine 500 Errors, alles funktioniert

---

## ✅ Erfolgs-Checkliste

- [ ] SSH Verbindung hergestellt
- [ ] Backup erstellt (Timestamp notiert: ________________)
- [ ] Migration ausgeführt (✅ in Output gesehen)
- [ ] Schema Validation gibt ✅
- [ ] Server neu gestartet
- [ ] Health Check gibt 200 OK
- [ ] Production App funktioniert (Login OK)
- [ ] Keine 500 Errors mehr

---

## 🚨 Rollback (Falls Probleme)

```bash
# Auf dem Server
cd /home/ubuntu/TimeTracking-Clean/server
pm2 stop timetracking-server

# Dein Backup-Timestamp hier einfügen:
TIMESTAMP=20260209_103045

# Backup wiederherstellen
cp database.db.backup.$TIMESTAMP database.db

# Server neu starten
pm2 start timetracking-server

# Verify
curl http://localhost:3000/api/health
```

---

## 📚 Vollständige Dokumentation

- **Ausführlicher Plan:** [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md) (~700 Zeilen)
- **Migration Strategy:** [DATABASE_MIGRATION_STRATEGY.md](DATABASE_MIGRATION_STRATEGY.md)
- **Project Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## 🔄 Nächste Schritte (Optional, später)

**Phase 2:** Shared Database Setup (30 Min)
- Beide Environments nutzen eine DB
- Nie wieder Sync-Probleme
- Siehe: [BLUE_GREEN_FIX_PLAN.md Phase 2](BLUE_GREEN_FIX_PLAN.md#phase-2-shared-database-setup--30-min)

---

**Status:** 📋 Ready to Execute
**Risiko:** 🟢 Niedrig
**Backup:** ✅ Vorhanden (Rollback möglich)

**LOS GEHT'S!** 🚀
