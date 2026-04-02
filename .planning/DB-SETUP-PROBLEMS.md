# Database Setup Problems - Analysis & Solutions

**Datum:** 2026-04-02
**Kontext:** Overtime-Fix Deployment zu Green/Blue Server
**Schweregrad:** 🔴 KRITISCH - Verhindert produktives Arbeiten

---

## 🔥 Kern-Problem

**Das aktuelle DB-Setup ist ein chaotisches Durcheinander, das jeden Deployment-Versuch zu einem mehrstündigen Debugging-Marathon macht.**

---

## 📋 Konkrete Probleme (heute erlebt)

### Problem 1: Database liegt AUSSERHALB des Projekts

**Symptom:**
```bash
/home/ubuntu/
├── database-shared.db          # Production DB (812KB)
├── database-staging.db         # Staging DB (492KB, veraltet!)
├── TimeTracking-Clean/         # Production Code
│   └── server/
│       └── database.db         # ??? Welche DB???
├── TimeTracking-Green/         # Staging Code
│   └── server/
│       └── database.db         # ??? Keine DB beim Clone!
```

**Impact:**
- Frisch geclontes Repo hat **KEINE DATABASE** → Deployment schlägt sofort fehl
- Migration schlägt fehl: `SqliteError: no such table: users`
- Manuelle Intervention nötig bei JEDEM Deployment

**Root Cause:**
- Database wird NICHT im Git-Repo getrackt (richtig!)
- ABER: Deployment-Workflow geht davon aus, dass DB automatisch existiert (falsch!)
- Keine automatische DB-Synchronisation

---

### Problem 2: Staging-Workflow war komplett kaputt

**Symptom:**
```yaml
# FALSCH (alter Workflow):
git clone https://github.com/Maxwellbadger-1/TimeTracking-Staging.git
cd /home/ubuntu/TimeTracking-Staging
git fetch origin main

# ERROR: Repository existiert nicht!
```

**Impact:**
- Deployment failed: "Repository not found"
- 3 fehlgeschlagene Deployment-Versuche
- 30+ Minuten verschwendet

**Root Cause:**
- Workflow referenzierte nicht-existierendes Repository
- Copy-Paste-Fehler von Production-Workflow ohne Anpassung

---

### Problem 3: PORT-Variable wird ignoriert

**Symptom:**
```bash
# PM2 Start Command:
TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=$SECRET \
  pm2 start dist/server.js --name timetracking-staging

# .env file enthält:
PORT=3001

# Server startet aber auf:
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

**Impact:**
- Green Server crasht sofort (Port 3000 bereits von Blue Server belegt)
- Health Check schlägt fehl
- Deployment marked as "failed"
- 95 Restarts in PM2!

**Root Cause:**
- PM2 lädt `.env` files **NICHT automatisch**
- ENV-Variablen müssen **PREFIX** zum PM2-Command sein
- Workflow setzt Variablen in `.env` statt als PREFIX

---

### Problem 4: Mehrere DB-Kopien, keine Synchronisation

**Aktuelle Situation:**
```bash
# Production Server (Blue):
/home/ubuntu/database-shared.db              # 812KB, LIVE Daten
/home/ubuntu/TimeTracking-Clean/server/database.db  # ??? Symlink? Kopie?

# Staging Server (Green):
/home/ubuntu/database-staging.db             # 492KB, VERALTET (Feb 2026)
/home/ubuntu/TimeTracking-Green/server/database.db # ??? Keine DB!

# Local (Mac):
server/database.db                           # ??? Test-Daten?
server/database_dev.db                       # ??? Development?
server/database.green.db                     # ??? Was ist das?
```

**Impact:**
- Niemand weiß, welche DB wo liegt
- Staging nutzt veraltete Daten (Februar statt aktuell)
- Keine automatische Synchronisation Production → Staging
- Manuelle Kopier-Befehle nötig bei jedem Test

**Root Cause:**
- Kein klares DB-Management-Konzept
- Keine Dokumentation, welche DB wo liegt
- Kein automatischer Sync-Mechanismus

---

### Problem 5: macOS Extended Attributes korruptieren DB

**Symptom:**
```bash
# Kopiere DB von Production zu Mac:
scp ubuntu@server:database-shared.db server/database.db

# Versuche DB zu lesen:
sqlite3 server/database.db "SELECT * FROM users"
# Error: database disk image is malformed (11)

# Fix:
xattr -c server/database.db  # Muss bei JEDER Kopie gemacht werden!
```

**Impact:**
- Lokales Testing mit Production-Daten unmöglich
- Jede DB-Kopie zu Mac wird korrupt
- Manuelle Bereinigung nötig (xattr -c)

**Root Cause:**
- macOS fügt erweiterte Attribute zu allen Dateien hinzu
- SQLite interpretiert diese als Datei-Korruption
- Keine automatische Bereinigung im Workflow

---

### Problem 6: Keine klare Umgebungs-Trennung

**Was wir WOLLEN:**
```
Development (Local)     Staging (Green)           Production (Blue)
development.db          ← Copy from Blue          database-shared.db
localhost:3000          localhost:3001            129.159.8.19:3000
Test-Daten              Prod-Copy (testing)       LIVE Kundendaten
```

**Was wir HABEN:**
```
Development (Local)     Staging (Green)           Production (Blue)
??? (mehrere DBs)       database-staging.db       database-shared.db
localhost:3000          ??? (crasht)              ??? (manchmal)
??? (korrupt)           (veraltet Feb 2026)       (hoffentlich OK)
```

**Impact:**
- Kein sicherer Weg, Features zu testen
- Staging ist unbrauchbar (crasht oder veraltete Daten)
- Direkt auf Production deployen = Russian Roulette

---

## 🎯 Was wir BRAUCHEN (Lösungsvorschläge)

### Lösung 1: DB im Projekt-Verzeichnis (mit Symlinks)

```bash
# Production Server:
/home/ubuntu/databases/
├── production.db          # Master-DB (LIVE)
└── production.backup/     # Automatische Backups

/home/ubuntu/TimeTracking-Clean/server/
└── database.db → /home/ubuntu/databases/production.db  # Symlink

# Staging Server:
/home/ubuntu/databases/
└── staging.db             # Kopie von Production (täglich sync)

/home/ubuntu/TimeTracking-Green/server/
└── database.db → /home/ubuntu/databases/staging.db  # Symlink
```

**Vorteile:**
- Klare Struktur: DB liegt IMMER an gleichem Ort
- Projekt-Clone findet DB automatisch (via Symlink)
- Backups zentral organisiert
- Einfach zu synchronisieren

---

### Lösung 2: Automatischer DB-Sync im Deployment

```yaml
# .github/workflows/deploy-staging.yml

# VOR dem Build:
- name: Sync Production DB to Staging
  run: |
    ssh ubuntu@server "
      # Backup Production DB
      cp /home/ubuntu/databases/production.db \
         /home/ubuntu/databases/production.backup.$(date +%Y%m%d_%H%M%S).db

      # Sync to Staging (mit Anonymisierung falls nötig)
      cp /home/ubuntu/databases/production.db \
         /home/ubuntu/databases/staging.db

      echo '✅ Staging DB synchronized'
    "
```

**Vorteile:**
- Staging hat IMMER aktuelle Daten
- Automatisch bei jedem Deployment
- Kein manueller Eingriff nötig

---

### Lösung 3: ENV-Variablen RICHTIG setzen

```yaml
# FALSCH (aktuell):
pm2 start dist/server.js --name timetracking-staging

# RICHTIG (mit ENV als PREFIX):
PORT=3001 NODE_ENV=staging TZ=Europe/Berlin SESSION_SECRET=$SECRET \
  pm2 start dist/server.js \
  --name timetracking-staging \
  --update-env
```

**Oder noch besser: Ecosystem File**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'timetracking-production',
      script: './dist/server.js',
      cwd: '/home/ubuntu/TimeTracking-Clean/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'Europe/Berlin',
      },
    },
    {
      name: 'timetracking-staging',
      script: './dist/server.js',
      cwd: '/home/ubuntu/TimeTracking-Green/server',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
        TZ: 'Europe/Berlin',
      },
    },
  ],
};

// Deployment:
pm2 start ecosystem.config.js --only timetracking-staging
```

**Vorteile:**
- ENV-Variablen sind explizit und versioniert
- Kein ".env file loading" Rätselraten
- PM2 managed Configuration

---

### Lösung 4: Local Development DB-Setup

```bash
# .github/workflows/setup-dev-db.yml
# Triggered: Manual workflow_dispatch

- name: Download anonymized Production DB
  run: |
    # Download DB von Production
    scp ubuntu@server:database-shared.db /tmp/prod.db

    # Anonymisiere sensible Daten
    sqlite3 /tmp/prod.db "
      UPDATE users SET
        email = 'user' || id || '@example.com',
        password = '$2b$10$TEST_HASH';
      DELETE FROM audit_log WHERE action LIKE '%password%';
    "

    # Kopiere zu Local (mit xattr cleanup)
    mv /tmp/prod.db server/database_dev.db
    xattr -c server/database_dev.db

    echo "✅ Development DB ready (anonymized)"
```

**Vorteile:**
- Realistische Test-Daten lokal
- Automatische Anonymisierung
- Kein manuelles SCP + xattr nötig

---

## 🚀 Migrations-Plan (Schritt-für-Schritt)

### Phase 1: Cleanup & Struktur (1-2h)

```bash
# Auf Oracle Server:
ssh ubuntu@server

# 1. Erstelle zentrale DB-Struktur
mkdir -p /home/ubuntu/databases/backups
mv /home/ubuntu/database-shared.db /home/ubuntu/databases/production.db
mv /home/ubuntu/database-staging.db /home/ubuntu/databases/staging.db

# 2. Erstelle Symlinks
cd /home/ubuntu/TimeTracking-Clean/server
ln -sf /home/ubuntu/databases/production.db database.db

cd /home/ubuntu/TimeTracking-Green/server
ln -sf /home/ubuntu/databases/staging.db database.db

# 3. Teste
curl http://localhost:3000/api/health  # Blue Server
curl http://localhost:3001/api/health  # Green Server
```

---

### Phase 2: Workflow Updates (30 Min)

1. **Update `deploy-staging.yml`:**
   - Sync Production DB → Staging BEFORE build
   - Use PM2 Ecosystem File
   - Add health check retry logic

2. **Update `deploy-server.yml` (Production):**
   - Use PM2 Ecosystem File
   - Symlink-aware deployment

3. **Create `ecosystem.config.js`:**
   - Commit to repo
   - PM2 lädt aus Repo

---

### Phase 3: Documentation (20 Min)

Update `ENV.md`:
```markdown
## Database Locations

**Production Server (Blue):**
- Master DB: `/home/ubuntu/databases/production.db`
- Backups: `/home/ubuntu/databases/backups/`
- Symlink: `/home/ubuntu/TimeTracking-Clean/server/database.db → production.db`

**Staging Server (Green):**
- Staging DB: `/home/ubuntu/databases/staging.db` (daily sync from production)
- Symlink: `/home/ubuntu/TimeTracking-Green/server/database.db → staging.db`

**Local Development:**
- Dev DB: `server/database_dev.db` (anonymized production copy)
- Use: `npm run setup-dev-db` to download & anonymize latest production data
```

---

## ⏱️ Zeitaufwand heute (Deployment-Versuch)

| Aktivität | Zeit | Grund |
|-----------|------|-------|
| Staging Workflow debuggen | 45 Min | Falsches Repository |
| DB-Copy Probleme lösen | 30 Min | Keine DB im geclonten Repo |
| PORT-Variable fixen | 20 Min | PM2 lädt .env nicht |
| macOS xattr Issues | 15 Min | DB-Korruption bei lokaler Kopie |
| Manuelle DB-Sync | 10 Min | Kein automatischer Sync |
| **GESAMT** | **2h** | Für einen **2-Zeilen Code-Fix!** |

**Mit richtigem Setup:** 5-10 Minuten (git push → Auto-Deploy → Done)

---

## 💡 Empfehlung

**JETZT HANDELN!** Dieses Setup ist nicht wartbar.

**Priorität 1:**
1. ✅ Symlink-Struktur auf Server (Phase 1)
2. ✅ PM2 Ecosystem File (Phase 2)
3. ✅ Auto-Sync im Workflow (Phase 2)

**Priorität 2:**
4. Documentation Update (Phase 3)
5. Local Dev DB Setup Script

**Geschätzter Aufwand:** 2-3 Stunden
**ROI:** Spart 1-2 Stunden bei JEDEM Deployment (zahlt sich nach 2 Deployments aus!)

---

## 📎 Anhang: Heutige Fehler-Logs

```bash
# Fehler 1: Repository nicht gefunden
git clone https://github.com/Maxwellbadger-1/TimeTracking-Staging.git
# fatal: repository not found

# Fehler 2: Keine Database
SqliteError: no such table: users
# Deployment aborted

# Fehler 3: Port-Konflikt
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
# PM2 Restart-Loop (95 Restarts!)

# Fehler 4: macOS DB Corruption
sqlite3 server/database.db "SELECT * FROM users"
# Error: database disk image is malformed (11)
```

---

**Status:** 🔴 UNGELÖST - Requires immediate attention
**Next Steps:** Übergebe diese MD an neuen Claude Code Chat für Refactoring
**Ziel:** Professionelles, wartbares DB-Setup (wie es Personio, DATEV, SAP machen)
