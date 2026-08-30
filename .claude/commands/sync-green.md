# Sync Green Server with Production (Manual)

**Command:** `/sync-green`

**Purpose:** Manually synchronize Green Server (Staging) database with Production (Blue) - copies latest production data + schema to staging

**⚠️ CRITICAL:** This syncs **DATA ONLY**, NOT code! Code is deployed via `git push origin staging`.

---

## ⚠️ IMPORTANT: When to use this

**Use `/sync-green` when:**
- Green Server has schema mismatch (500 errors, "no such column" errors)
- Before testing new database migrations on Green
- After significant production data changes
- When Green Server is out-of-date

**DO NOT use if:**
- You have unsaved test data on Green Server (will be overwritten!)
- Green Server is currently in use by other developers
- You're not sure if Production (Blue) is stable

---

## What this command does:

1. **Connects to Oracle Cloud Server** via SSH
2. **Creates timestamped backup** of current staging.db
3. **Copies Blue (production) → Green (staging)**
4. **Restarts Green Server** (PM2)
5. **Runs Health Check** to verify success
6. **Verifies schema** (position column exists)

---

## Execute the sync:

```bash
# ═══════════════════════════════════════
# 🔄 SYNC GREEN SERVER WITH PRODUCTION
# ═══════════════════════════════════════

ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "
echo '═══════════════════════════════════════════════'
echo '🔄 GREEN SERVER SYNC - Manual Synchronization'
echo '═══════════════════════════════════════════════'
echo ''

# ─────────────────────────────────────
# STEP 1: Verify Source Database
# ─────────────────────────────────────
echo '📊 Step 1: Checking source database (Blue/Production)...'
if [ -f /home/ubuntu/database-shared.db ]; then
  BLUE_SIZE=\$(du -h /home/ubuntu/database-shared.db | cut -f1)
  BLUE_MODIFIED=\$(stat -c '%y' /home/ubuntu/database-shared.db)
  echo \"✅ Blue Server DB found\"
  echo \"   Size: \$BLUE_SIZE\"
  echo \"   Last Modified: \$BLUE_MODIFIED\"
else
  echo '❌ ERROR: database-shared.db not found!'
  exit 1
fi
echo ''

# ─────────────────────────────────────
# STEP 2: Create Backup of Green DB
# ─────────────────────────────────────
echo '💾 Step 2: Creating backup of current staging.db...'
TIMESTAMP=\$(date +%Y%m%d-%H%M%S)
cp /home/ubuntu/database-staging.db /home/ubuntu/database-staging.db.backup-\$TIMESTAMP
if [ \$? -eq 0 ]; then
  BACKUP_SIZE=\$(du -h /home/ubuntu/database-staging.db.backup-\$TIMESTAMP | cut -f1)
  echo \"✅ Backup created: database-staging.db.backup-\$TIMESTAMP\"
  echo \"   Size: \$BACKUP_SIZE\"
else
  echo '❌ ERROR: Backup failed!'
  exit 1
fi
echo ''

# ─────────────────────────────────────
# STEP 3: Copy Blue → Green
# ─────────────────────────────────────
echo '📋 Step 3: Syncing Blue (production) → Green (staging)...'
cp /home/ubuntu/database-shared.db /home/ubuntu/database-staging.db
if [ \$? -eq 0 ]; then
  NEW_SIZE=\$(du -h /home/ubuntu/database-staging.db | cut -f1)
  echo \"✅ Database synced successfully\"
  echo \"   New staging.db size: \$NEW_SIZE\"
else
  echo '❌ ERROR: Sync failed!'
  echo '🔄 Restoring backup...'
  cp /home/ubuntu/database-staging.db.backup-\$TIMESTAMP /home/ubuntu/database-staging.db
  echo '✅ Backup restored'
  exit 1
fi
echo ''

# ─────────────────────────────────────
# STEP 4: Restart Green Server
# ─────────────────────────────────────
echo '🔄 Step 4: Restarting Green Server (PM2)...'
pm2 restart timetracking-staging --update-env
echo ''
sleep 3

# ─────────────────────────────────────
# STEP 5: Health Check
# ─────────────────────────────────────
echo '🏥 Step 5: Running health check...'
HEALTH=\$(curl -s http://localhost:3001/api/health)
if echo \"\$HEALTH\" | grep -q '\"status\":\"ok\"'; then
  echo '✅ Green Server is healthy!'
  echo \"\$HEALTH\"
else
  echo '❌ Health check failed!'
  echo \"\$HEALTH\"
  exit 1
fi
echo ''

# ─────────────────────────────────────
# STEP 6: Verify Schema (position column)
# ─────────────────────────────────────
echo '🔍 Step 6: Verifying schema (position column)...'
cd /home/ubuntu/TimeTracking-Staging/server
node -e \"
const Database = require('better-sqlite3');
const db = new Database('/home/ubuntu/database-staging.db', { readonly: true });
const schema = db.prepare('PRAGMA table_info(users)').all();
const hasPosition = schema.find(col => col.name === 'position');
if (hasPosition) {
  console.log('✅ Schema verified: position column exists');
  console.log('   Type:', hasPosition.type);
  console.log('   Nullable:', hasPosition.notnull === 0 ? 'YES' : 'NO');
} else {
  console.log('❌ ERROR: position column missing!');
  process.exit(1);
}
db.close();
\" 2>&1
echo ''

# ─────────────────────────────────────
# STEP 7: Summary
# ─────────────────────────────────────
echo '═══════════════════════════════════════════════'
echo '✅ GREEN SERVER SYNC COMPLETED SUCCESSFULLY'
echo '═══════════════════════════════════════════════'
echo ''
echo '📊 Summary:'
echo \"   • Backup created: database-staging.db.backup-\$TIMESTAMP\"
echo \"   • Source: /home/ubuntu/database-shared.db (\$BLUE_SIZE)\"
echo \"   • Target: /home/ubuntu/database-staging.db (\$NEW_SIZE)\"
echo '   • Green Server: Restarted & Healthy ✅'
echo '   • Schema: Verified ✅'
echo ''
echo '📝 Next Steps:'
echo '   1. If using Desktop App on Green Server, restart it:'
echo '      cd desktop && npm run dev'
echo '   2. Test critical features to ensure everything works'
echo '   3. Check for any unexpected behavior'
echo ''
echo '🔄 Rollback (if needed):'
echo \"   cp /home/ubuntu/database-staging.db.backup-\$TIMESTAMP /home/ubuntu/database-staging.db\"
echo '   pm2 restart timetracking-staging'
echo ''
"
```

---

## What happens during sync:

### Before Sync:
```
Blue Server (Production):
├── database-shared.db          → 503KB (Latest, All migrations)
├── PM2: timetracking-server    → Running ✅

Green Server (Staging):
├── database-staging.db         → 495KB (Outdated, Missing migrations)
├── PM2: timetracking-staging   → Running ❌ (Schema mismatch errors)
```

### After Sync:
```
Blue Server (Production):
├── database-shared.db          → 503KB (Unchanged)
├── PM2: timetracking-server    → Running ✅

Green Server (Staging):
├── database-staging.db         → 503KB (✅ Synced from Blue!)
├── database-staging.db.backup-20260211-103045 → 495KB (Old backup)
├── PM2: timetracking-staging   → Restarted ✅ (No more errors)
```

---

## Verification:

After running `/sync-green`, verify:

**1. Green Server Health:**
```bash
curl http://129.159.8.19:3001/api/health
# Expected: {"status":"ok","message":"TimeTracking Server is running"}
```

**2. Desktop App (if using Green):**
- **IMPORTANT:** Switch to Green Server first: `cd desktop && /green && npm run dev`
- Open http://localhost:1420
- F12 → Console
- Should see NO 500 errors
- Privacy Policy modal should work
- All API calls succeed

**3. Schema Match:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Staging/server
DATABASE_PATH=<pfad> npx tsx src/scripts/protectedTablesChecksum.ts
# Expected: Zeilenzahl und SHA-256 der geschuetzten Tabellen wie vor dem Deployment
```

> `npm run validate:schema` stand hier bis 30.08.2026 mit dem Vermerk
> "Expected: All checks pass ✅". Das konnte nie eintreten — das Erwartungsschema des
> Skripts war seit Februar 2026 nicht nachgezogen und meldete bei jedem Lauf
> "VALIDATION FAILED", auch gegen nachweislich intakte Datenbanken. Skript und
> Deployment-Aufrufe sind entfernt; den Schema-Schutz leistet der blockierende
> Migrationsschritt im Deployment.

---

## Rollback (if something goes wrong):

```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "
  # Find latest backup:
  ls -lt /home/ubuntu/database-staging.db.backup-* | head -1

  # Restore it (replace TIMESTAMP with actual timestamp):
  cp /home/ubuntu/database-staging.db.backup-<TIMESTAMP> /home/ubuntu/database-staging.db

  # Restart Green Server:
  pm2 restart timetracking-staging
"
```

---

## Troubleshooting:

### Issue: SSH Permission Denied

**Solution:**
```bash
# Check SSH key exists:
ls -l .ssh/oracle_server.key

# If missing, check ENV.md for SSH key location
```

### Issue: Sync failed during copy

**Solution:**
- Automatic rollback occurs (backup is restored)
- Check Blue Server is accessible
- Check disk space: `df -h`

### Issue: Green Server won't restart

**Solution:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
pm2 logs timetracking-staging --lines 50
# Check logs for errors
```

### Issue: Schema verification fails

**Problem:** Even after sync, position column missing

**Solution:**
```bash
# Manually run migration on Green:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Staging/server
npm run migrate:prod
pm2 restart timetracking-staging
```

---

## Safety Features:

✅ **Automatic Backup:** Current staging.db is backed up before sync
✅ **Rollback on Failure:** Backup is restored if sync fails
✅ **Health Check:** Verifies Green Server is healthy after sync
✅ **Schema Verification:** Confirms critical columns exist
✅ **Timestamped Backups:** Easy to identify and restore specific versions

---

## Maintenance:

**Cleanup old backups:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "
  # Keep only last 5 backups:
  cd /home/ubuntu
  ls -t database-staging.db.backup-* | tail -n +6 | xargs rm -f
  echo 'Old backups cleaned'
"
```

---

## Integration with `/green` command:

When switching to Green Server with `/green`:
1. Desktop App connects to Green Server (Port 3001)
2. If you get 500 errors or schema mismatches:
   - Run `/sync-green` to update Green Server database
   - Restart Desktop App: `npm run dev`
   - Errors should be resolved ✅

---

**Last Updated:** 2026-02-11
**Database Sync Strategy:** Manual (On-Demand)
**Related Commands:** `/dev`, `/green`
