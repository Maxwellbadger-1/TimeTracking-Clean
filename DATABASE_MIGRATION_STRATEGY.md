# Database Migration Strategy für Blue-Green Deployment

**Status:** 🟢 ACTIVE - Shared Database Approach Empfohlen
**Letzte Aktualisierung:** 2026-02-09
**Vollständiger Plan:** Siehe [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md)

---

## 📊 Aktuelle Situation (Updated 2026-02-09)

Nach umfassender Analyse des Systems haben wir folgende Struktur:

### 1. Deployment Struktur
- **BLUE Environment**: `/home/ubuntu/TimeTracking-BLUE/server/database.db`
  - Status: Alte Production-Version
  - Server Port: Unbekannt (nicht 3000)
  - PM2 Name: `timetracking-blue` (vermutlich)

- **GREEN Environment** (AKTUELL LIVE): `/home/ubuntu/TimeTracking-Clean/server/database.db`
  - Status: ❌ FEHLER - Missing `position` column
  - Server Port: 3000 (aktuelle Production)
  - PM2 Name: `timetracking-server`

### 2. Migration System ✅
- **Migration Script**: `server/scripts/migrate.ts` (SQL-basiert)
- **Migration Directory**: `server/database/migrations/*.sql`
- **Migration Commands**:
  - `npm run migrate` - Dev Umgebung
  - `npm run migrate:prod` - Production Umgebung
  - `npm run migrate:create <name>` - Neue Migration erstellen
- **Migration Tracking**: `migrations` Tabelle in jeder DB
- **Schema Validation**: entfallen am 30.08.2026 — `validateSchema.ts` prüfte gegen ein Erwartungsschema von vor Februar 2026 und meldete auch gegen intakte Datenbanken "VALIDATION FAILED". Schutz liegt beim blockierenden `migrate:prod`.

### 3. Aktuelles Problem ❌
**GREEN DB fehlt `position` Column** → 500 Error beim `/api/auth/me` Call

**Root Cause:**
- Migration `20260208_add_position_column.sql` existiert
- Migration wurde NICHT auf GREEN Production DB ausgeführt
- Development DB hat die Column → funktioniert
- GREEN DB fehlt die Column → bricht Production

### 4. Grundproblem: Zwei separate Datenbanken
Bei Blue-Green Deployments haben wir **ZWEI separate Datenbanken**, die synchron gehalten werden müssen!

**Herausforderungen:**
- ❌ Migrations müssen auf BEIDEN DBs ausgeführt werden
- ❌ Daten müssen synchronisiert werden
- ❌ Fehleranfällig bei manuellem Process
- ❌ Risiko von Diskrepanzen (wie aktuell!)

## Migration Strategy

### Option 1: Shared Database (EMPFOHLEN) ✅

**Konzept**: Beide Environments nutzen EINE gemeinsame Datenbank

```
┌──────────┐     ┌──────────┐
│  BLUE    │────▶│          │◀────│  GREEN   │
│  Server  │     │    DB    │     │  Server  │
│  :3000   │     │  SHARED  │     │  :3001   │
└──────────┘     └──────────┘     └──────────┘
```

**Vorteile:**
- Keine Datensynchronisation nötig
- Einfache Migration (nur 1x ausführen)
- Kein Datenverlust beim Switch
- Echtzeit-Daten in beiden Environments

**Nachteile:**
- Schema-Changes müssen rückwärtskompatibel sein
- Beide Server-Versionen müssen mit gleichem Schema arbeiten können

**Implementation:**
```bash
# 1. Backup erstellen
cp /home/ubuntu/TimeTracking-BLUE/server/database.db /home/ubuntu/database-shared.db

# 2. Symlinks erstellen
ln -sf /home/ubuntu/database-shared.db /home/ubuntu/TimeTracking-BLUE/server/database.db
ln -sf /home/ubuntu/database-shared.db /home/ubuntu/TimeTracking-GREEN/server/database.db

# 3. Migrations nur 1x ausführen
cd /home/ubuntu/TimeTracking-BLUE/server
npm run migrate:prod
```

### Option 2: Separate Databases mit Sync

**Konzept**: Jedes Environment hat eigene DB, werden synchronisiert

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  BLUE    │────▶│  BLUE    │ ~~~▶│  GREEN   │◀────│  GREEN   │
│  Server  │     │    DB    │sync │    DB    │     │  Server  │
│  :3000   │     │          │     │  (copy)  │     │  :3001   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**Vorteile:**
- Vollständige Isolation
- Testbar ohne Production-Impact
- Rollback einfacher

**Nachteile:**
- Komplexe Synchronisation
- Potentieller Datenverlust beim Switch
- Doppelte Migrations nötig

### Option 3: Migration-Only Sync (AKTUELL) ⚠️

**Konzept**: Nur Schema-Migrations werden synchronisiert, keine Daten

**Aktuelles Vorgehen:**
```bash
# 1. Migration in Dev erstellen & testen
cd server
npm run migrate:create

# 2. Migration auf BEIDE Production DBs anwenden
# GREEN:
ssh ubuntu@server "cd TimeTracking-GREEN/server && npm run migrate:prod"

# BLUE:
ssh ubuntu@server "cd TimeTracking-BLUE/server && npm run migrate:prod"
```

## Empfohlenes Vorgehen für aktuelle Migration

### 1. Was wurde in Dev migriert?
```bash
# Lokal prüfen:
cd server
sqlite3 database.db "SELECT * FROM migrations;"

# Welche Tabellen/Spalten wurden geändert?
sqlite3 database.db ".schema" > schema-new.sql
git diff schema-new.sql
```

### 2. Migration Script erstellen (falls noch nicht vorhanden)
```bash
# Neues Migration File erstellen
mkdir -p server/database/migrations
cat > server/database/migrations/001_your_migration.sql << 'EOF'
-- Ihre SQL Migration hier
-- z.B.:
ALTER TABLE users ADD COLUMN new_field TEXT;
CREATE INDEX idx_new_field ON users(new_field);
EOF
```

### 3. Migration auf BEIDE Production DBs anwenden

```bash
# Backup erstellen
ssh ubuntu@129.159.8.19 "
  cd /home/ubuntu
  cp TimeTracking-BLUE/server/database.db TimeTracking-BLUE/server/database.db.backup-$(date +%Y%m%d-%H%M%S)
  cp TimeTracking-GREEN/server/database.db TimeTracking-GREEN/server/database.db.backup-$(date +%Y%m%d-%H%M%S)
"

# Migration auf GREEN testen
ssh ubuntu@129.159.8.19 "
  cd TimeTracking-GREEN/server
  npm run migrate:prod
"

# Wenn erfolgreich, auch auf BLUE
ssh ubuntu@129.159.8.19 "
  cd TimeTracking-BLUE/server
  npm run migrate:prod
"
```

### 4. Verify Migration
```bash
# Check beide DBs haben gleiche Struktur
ssh ubuntu@129.159.8.19 "
  echo '=== BLUE DB Schema ==='
  sqlite3 TimeTracking-BLUE/server/database.db '.schema' | md5sum

  echo '=== GREEN DB Schema ==='
  sqlite3 TimeTracking-GREEN/server/database.db '.schema' | md5sum

  echo 'Schemas sollten identische MD5 haben!'
"
```

## Langfristige Lösung: Shared Database Setup

### Implementation Script
```bash
#!/bin/bash
# setup-shared-db.sh

# 1. Backup beide DBs
echo "Creating backups..."
cp TimeTracking-BLUE/server/database.db backup-blue-$(date +%Y%m%d).db
cp TimeTracking-GREEN/server/database.db backup-green-$(date +%Y%m%d).db

# 2. Wähle neueste/vollständigste DB
echo "Creating shared database..."
cp TimeTracking-BLUE/server/database.db /home/ubuntu/database-shared.db

# 3. Remove alte DBs und create Symlinks
echo "Setting up symlinks..."
rm TimeTracking-BLUE/server/database.db
rm TimeTracking-GREEN/server/database.db
ln -s /home/ubuntu/database-shared.db TimeTracking-BLUE/server/database.db
ln -s /home/ubuntu/database-shared.db TimeTracking-GREEN/server/database.db

# 4. Restart beide Server
echo "Restarting servers..."
pm2 restart timetracking-server
pm2 restart timetracking-green

echo "✅ Shared database setup complete!"
```

## Best Practices für Migrations

### 1. Immer rückwärtskompatibel
```sql
-- GOOD: Neue Spalte mit Default
ALTER TABLE users ADD COLUMN feature_flag BOOLEAN DEFAULT false;

-- BAD: Spalte umbenennen (bricht alte Version)
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

### 2. Two-Phase Migrations für Breaking Changes
```sql
-- Phase 1: Additive (Deploy mit GREEN)
ALTER TABLE users ADD COLUMN new_name TEXT;
UPDATE users SET new_name = old_name;

-- Phase 2: Cleanup (Nach Switch zu GREEN)
ALTER TABLE users DROP COLUMN old_name;
```

### 3. Migration Testing
```bash
# Immer auf GREEN testen vor BLUE
cd TimeTracking-GREEN/server
npm run migrate:prod

# Test Application
curl http://localhost:3001/api/health

# Dann auf BLUE
cd TimeTracking-BLUE/server
npm run migrate:prod
```

## Troubleshooting

### Problem: Migrations out of sync
```bash
# Check migration status
sqlite3 TimeTracking-BLUE/server/database.db "SELECT * FROM migrations;"
sqlite3 TimeTracking-GREEN/server/database.db "SELECT * FROM migrations;"

# Manual sync if needed
sqlite3 TimeTracking-GREEN/server/database.db ".dump migrations" | \
  sqlite3 TimeTracking-BLUE/server/database.db
```

### Problem: Schema Konflikt
```bash
# Compare schemas
diff <(sqlite3 TimeTracking-BLUE/server/database.db .schema) \
     <(sqlite3 TimeTracking-GREEN/server/database.db .schema)

# Fix by re-running migrations
cd TimeTracking-GREEN/server && npm run migrate:prod
cd TimeTracking-BLUE/server && npm run migrate:prod
```

## Nächste Schritte

1. **SOFORT**: Prüfen welche Migration in Dev gemacht wurde
2. **HEUTE**: Migration auf beide Production DBs anwenden
3. **DIESE WOCHE**: Entscheidung über Shared Database
4. **LANGFRISTIG**: CI/CD Pipeline für automatische Migrations

## Commands Cheat Sheet

```bash
# Local Dev
cd server
npm run migrate                    # Run migrations locally
npm run migrate:create             # Create new migration
sqlite3 database.db ".schema"      # Check schema

# Production
ssh ubuntu@129.159.8.19
cd TimeTracking-BLUE/server && npm run migrate:prod   # BLUE
cd TimeTracking-GREEN/server && npm run migrate:prod  # GREEN

# Backup
sqlite3 database.db ".backup backup.db"

# Restore
sqlite3 database.db ".restore backup.db"
```

---

## 🎯 Empfohlene Nächste Schritte

### Sofort (Heute):
1. **Führe Phase 1 aus** (15 Min): [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md#phase-1-sofort-fix-für-green-db--15-min)
   - Backup erstellen
   - Migration ausführen
   - Server neu starten
   - Testen

### Diese Woche:
2. **Führe Phase 2 aus** (30 Min): [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md#phase-2-shared-database-setup--30-min)
   - Shared Database Setup
   - Beide Environments auf eine DB
   - Nie wieder Sync-Probleme!

### Optional (Wenn Zeit):
3. **Phase 3 Verbesserungen**: [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md#phase-3-langfristige-verbesserungen--1-2-stunden)
   - Monitoring Scripts
   - Automatische Backups
   - Blue-Green Switch Script

---

## 📚 Zusätzliche Dokumentation

- **Vollständiger Fix-Plan**: [BLUE_GREEN_FIX_PLAN.md](BLUE_GREEN_FIX_PLAN.md) (~700 Zeilen, Schritt-für-Schritt)
- **Unverändertheitsnachweis**: `server/src/scripts/protectedTablesChecksum.ts` (Zeilenzahl + SHA-256 der geschützten Tabellen, öffnet readonly)
- **Migration System**: `server/scripts/migrate.ts`
- **Migration Files**: `server/database/migrations/*.sql`
- **GitHub Workflow**: `.github/workflows/deploy-server.yml` (bereits korrekt!)
- **Complete Migration Workflow**: `.github/workflows/complete-migration.yml`

---

**Author**: Claude
**Date**: 2026-02-07 (Created), 2026-02-09 (Updated)
**Status**: 🟡 IN PROGRESS - Phase 1 ready to execute
**Next Action**: Execute Phase 1 from BLUE_GREEN_FIX_PLAN.md