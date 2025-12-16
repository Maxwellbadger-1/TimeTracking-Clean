# 🚨 DATABASE SYNCHRONIZATION - KRITISCHE REGELN

**WICHTIGSTE REGEL ÜBERHAUPT:**
> Dev DB und Production DB müssen IMMER auf dem selben aktuellsten Stand sein!

---

## ⚠️ WARUM IST DAS SO WICHTIG?

**Problem ohne Sync:**
- ❌ Tests in Dev zeigen falsche Ergebnisse
- ❌ Bugs werden nicht erkannt, weil Dev DB andere Daten hat
- ❌ Overtime-Berechnungen unterschiedlich
- ❌ Entwickler arbeiten mit veralteten Test-Daten

**Was wir gelernt haben:**
- Timezone-Bugs wurden nur gefunden, weil Dev DB veraltet war
- Database Path Bug wurde nur gefunden, weil unterschiedliche DBs verwendet wurden
- **OHNE SYNC = VERSTECKTE BUGS!**

---

## 📋 PFLICHT-REGELN (IMMER BEFOLGEN!)

### Regel 1: Nach JEDEM Production Update → Dev DB Sync!

**Wann:**
- ✅ Nach `git push origin main` (Production Deployment)
- ✅ Nach Änderungen an Production DB (manuell oder via Script)
- ✅ Nach `fix-overtime.ts` auf Production
- ✅ VOR Beginn neuer Features
- ✅ JEDEN MORGEN vor der Arbeit

**Wie:**
```bash
# IMMER diese Schritte ausführen:

# 1. Backup der aktuellen Dev DB erstellen
cp database/development.db database/development.backup.$(date +%Y%m%d_%H%M%S).db

# 2. Production DB herunterladen
scp -i "/Users/maximilianfegg/Desktop/ssh-key-2025-11-02 (2).key" \
  ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/server/database.db \
  /tmp/production.db

# 3. Überschreiben der Dev DB
cp /tmp/production.db database/development.db

# 4. Verification: Zeige letzte Änderung
sqlite3 database/development.db "SELECT datetime(MAX(createdAt), 'localtime') as last_update FROM time_entries;"

# 5. Aufräumen
rm /tmp/production.db
```

---

### Regel 2: VOR jedem Feature → Schema-Check!

**Wann:**
- ✅ VOR Beginn jedes Features
- ✅ NACH jedem Production Deployment
- ✅ NACH jedem DB Schema Change

**Wie:**
```bash
# Schema Comparison Script ausführen
npm run db:compare-schemas

# Wenn unterschiedlich → STOPP! Erst synchronisieren!
```

---

### Regel 3: Auto-Sync Script erstellen (PFLICHT!)

**Erstelle `/server/scripts/sync-dev-db.ts`:**

```typescript
/**
 * SYNC DEV DB FROM PRODUCTION
 * Run this AFTER every production deployment!
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const SSH_KEY = '/Users/maximilianfegg/Desktop/ssh-key-2025-11-02 (2).key';
const PRODUCTION_HOST = 'ubuntu@129.159.8.19';
const PRODUCTION_DB_PATH = '/home/ubuntu/TimeTracking-Clean/server/database.db';
const LOCAL_DEV_DB = join(__dirname, '../database/development.db');
const LOCAL_TEMP = '/tmp/production-download.db';

console.log('🔄 Starting Production → Dev DB Sync...\n');

// Step 1: Backup current dev DB
const backupName = `development.backup.${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
const backupPath = join(__dirname, '../database', backupName);

if (existsSync(LOCAL_DEV_DB)) {
  console.log('📦 Creating backup:', backupName);
  copyFileSync(LOCAL_DEV_DB, backupPath);
  console.log('✅ Backup created\n');
}

// Step 2: Download from production
console.log('⬇️  Downloading from production...');
try {
  execSync(
    `scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${PRODUCTION_HOST}:${PRODUCTION_DB_PATH} ${LOCAL_TEMP}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Downloaded\n');
} catch (error) {
  console.error('❌ Download failed!', error);
  process.exit(1);
}

// Step 3: Replace dev DB
console.log('🔄 Replacing dev DB...');
copyFileSync(LOCAL_TEMP, LOCAL_DEV_DB);
console.log('✅ Replaced\n');

// Step 4: Verify
console.log('🔍 Verifying...');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3(LOCAL_DEV_DB);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL').get();
const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries').get();
const lastEntry = db.prepare('SELECT MAX(date) as last_date FROM time_entries').get();

console.log('   Active Users:', userCount.count);
console.log('   Time Entries:', entryCount.count);
console.log('   Latest Entry:', lastEntry.last_date);

db.close();

console.log('\n✅ SYNC COMPLETE!\n');
console.log('⚠️  IMPORTANT: Restart your dev server now!');
```

**Usage:**
```bash
npm run db:sync

# ODER direkt:
node scripts/sync-dev-db.ts
```

---

### Regel 4: Nach jedem Sync → Dev Server neustarten!

**WARUM:**
- Better-SQLite3 cached die DB im Memory
- Ohne Restart = alte Daten im Cache!

**Wie:**
```bash
# 1. Sync ausführen
npm run db:sync

# 2. SOFORT Dev Server neustarten
# CTRL+C (aktuellen Server stoppen)
npm run dev
```

---

### Regel 5: NIEMALS Production DB direkt bearbeiten!

**❌ VERBOTEN:**
```bash
# NIEMALS direkt auf Production DB arbeiten!
ssh ubuntu@129.159.8.19
sqlite3 database.db
# STOPP! Das ist gefährlich!
```

**✅ RICHTIG:**
```bash
# 1. Erst auf Dev testen
npm run db:sync                    # Dev DB aktualisieren
node scripts/fix-overtime.ts       # Auf Dev testen

# 2. Dann auf Production via SSH
ssh -i "..." ubuntu@129.159.8.19 \
  "cd /home/ubuntu/TimeTracking-Clean/server && \
   NODE_ENV=production npx tsx scripts/fix-overtime.ts"
```

---

## 📊 MONITORING & CHECKS

### Daily Check (JEDEN MORGEN!)

```bash
# Quick Check Script
npm run db:check-sync
```

**Erstelle `/server/scripts/check-db-sync.ts`:**

```typescript
/**
 * CHECK IF DEV DB IS IN SYNC WITH PRODUCTION
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';

const DEV_DB = './database/development.db';
const SSH_CMD = 'ssh -i "/Users/maximilianfegg/Desktop/ssh-key-2025-11-02 (2).key" ubuntu@129.159.8.19';

console.log('🔍 Checking DB Sync Status...\n');

// Get dev stats
const devDb = new Database(DEV_DB);
const devUsers = devDb.prepare('SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL').get();
const devEntries = devDb.prepare('SELECT COUNT(*) as count FROM time_entries').get();
const devLastEntry = devDb.prepare('SELECT MAX(date) as date FROM time_entries').get();
devDb.close();

console.log('📁 DEV DB:');
console.log('   Users:', devUsers.count);
console.log('   Entries:', devEntries.count);
console.log('   Last Entry:', devLastEntry.date);

// Get production stats via SSH
const prodCmd = `${SSH_CMD} "cd /home/ubuntu/TimeTracking-Clean/server && sqlite3 database.db 'SELECT COUNT(*) FROM users WHERE deletedAt IS NULL; SELECT COUNT(*) FROM time_entries; SELECT MAX(date) FROM time_entries;'"`;

console.log('\n☁️  PRODUCTION DB:');
try {
  const prodStats = execSync(prodCmd, { encoding: 'utf-8' }).trim().split('\n');
  console.log('   Users:', prodStats[0]);
  console.log('   Entries:', prodStats[1]);
  console.log('   Last Entry:', prodStats[2]);

  // Compare
  const inSync =
    devUsers.count === parseInt(prodStats[0]) &&
    devEntries.count === parseInt(prodStats[1]) &&
    devLastEntry.date === prodStats[2];

  if (inSync) {
    console.log('\n✅ SYNC STATUS: IN SYNC');
  } else {
    console.log('\n❌ SYNC STATUS: OUT OF SYNC!');
    console.log('\n⚠️  ACTION REQUIRED: Run `npm run db:sync`');
  }
} catch (error) {
  console.error('\n❌ Could not connect to production!');
}
```

---

## 🔧 PACKAGE.JSON SCRIPTS (HINZUFÜGEN!)

```json
{
  "scripts": {
    "db:sync": "npx tsx scripts/sync-dev-db.ts",
    "db:check-sync": "npx tsx scripts/check-db-sync.ts",
    "db:compare-schemas": "npx tsx scripts/compare-schemas.ts"
  }
}
```

---

## 📝 WORKFLOW INTEGRATION

### GitHub Actions: Auto-Notify on Production Deploy

**Erstelle `.github/workflows/notify-db-sync.yml`:**

```yaml
name: Notify DB Sync Required

on:
  workflow_run:
    workflows: ["CD - Deploy Server to Oracle Cloud"]
    types: [completed]
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - name: Create Issue
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔄 Dev DB Sync Required After Production Deployment',
              body: `
              ## Action Required: Sync Dev Database

              Production deployment completed successfully. Please sync your local dev database:

              \`\`\`bash
              cd server
              npm run db:sync
              # Then restart dev server
              \`\`\`

              **Deployment:** ${{ github.event.workflow_run.html_url }}
              **Commit:** ${{ github.event.workflow_run.head_sha }}
              `,
              labels: ['database', 'sync-required']
            });
```

---

## ⚠️ TROUBLESHOOTING

### Problem: "Dev DB hat andere Daten als Production"

**Lösung:**
```bash
npm run db:sync
# Restart dev server!
```

---

### Problem: "Sync schlägt fehl - Permission denied"

**Lösung:**
```bash
# SSH Key Permissions prüfen
chmod 400 /Users/maximilianfegg/Desktop/ssh-key-2025-11-02\ \(2\).key

# Erneut versuchen
npm run db:sync
```

---

### Problem: "Nach Sync immer noch alte Daten"

**Ursache:** Dev Server läuft noch und cached alte DB

**Lösung:**
```bash
# 1. Dev Server STOPPEN (CTRL+C)
# 2. Sync ausführen
npm run db:sync
# 3. Dev Server NEU STARTEN
npm run dev
```

---

## 📋 CHECKLISTE (TÄGLICH!)

Jeden Morgen VOR der Arbeit:

```
☐ 1. npm run db:check-sync ausführen
☐ 2. Wenn OUT OF SYNC: npm run db:sync
☐ 3. Dev Server neustarten
☐ 4. Quick Test: API aufrufen, Daten prüfen
☐ 5. ✅ Bereit für Development!
```

---

## 🎯 ZUSAMMENFASSUNG

**EINE REGEL - IMMER BEFOLGEN:**

> **Nach JEDEM Production Deployment:**
> 1. `npm run db:sync`
> 2. Dev Server neustarten
> 3. Testen
>
> **Das ist PFLICHT! KEINE Ausnahmen!**

---

**Version:** 1.0
**Letzte Aktualisierung:** 2025-12-16
**Status:** 🚨 KRITISCH - IMMER BEFOLGEN!
