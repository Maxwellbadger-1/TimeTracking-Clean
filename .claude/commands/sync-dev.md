# Sync Development DB with Staging (Manual)

**Command:** `/sync-dev`

**Purpose:** Synchronize local development.db with Green Server (Staging) - copies latest staging data + schema to local development

**Status:** 🚧 PLANNED (Not yet implemented - use manual workaround)

---

## ⚠️ IMPORTANT: When to use this

**Use `/sync-dev` when:**
- Development.db has schema mismatch ("no such column" errors locally)
- Before starting development after Production migrations
- When you need realistic production data for local testing
- Development.db is outdated or corrupted

**DO NOT use if:**
- You have unsaved test data in development.db (will be overwritten!)
- Green Server is down or unreachable
- You're not sure if Green Server is up-to-date

---

## What this command will do (when implemented):

1. **Downloads staging.db** from Green Server via SSH
2. **Creates timestamped backup** of current development.db
3. **Copies staging.db → development.db**
4. **Verifies schema** matches Green Server
5. **Confirms sync** successful

---

## Manual Workaround (until implemented):

```bash
# ═══════════════════════════════════════
# 🔄 MANUAL SYNC: Staging → Development
# ═══════════════════════════════════════

# Navigate to project root
cd ~/Desktop/TimeTracking-Clean

# Step 1: Backup current development.db
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp server/database/development.db server/database/development.db.backup-$TIMESTAMP
echo "✅ Backup created: development.db.backup-$TIMESTAMP"

# Step 2: Download staging.db from Green Server
scp -i .ssh/oracle_server.key ubuntu@129.159.8.19:/home/ubuntu/database-staging.db /tmp/staging.db
echo "✅ Downloaded staging.db from Green Server"

# Step 3: Copy to development.db
cp /tmp/staging.db server/database/development.db
echo "✅ Copied staging.db → development.db"

# Step 4: Verify size
DEV_SIZE=$(du -h server/database/development.db | cut -f1)
echo "✅ New development.db size: $DEV_SIZE"

# Step 5: Test local server
cd server
npm run dev  # Should start without errors
```

---

## What happens during sync:

### Before Sync:
```
Green Server (Staging):
├── database-staging.db         → 492KB (Latest, All migrations)
├── PM2: timetracking-staging   → Running ✅

Development (Local):
├── development.db              → 50KB (Outdated, Missing migrations)
├── npm run dev                 → Errors ❌ (Schema mismatch)
```

### After Sync:
```
Green Server (Staging):
├── database-staging.db         → 492KB (Unchanged)
├── PM2: timetracking-staging   → Running ✅

Development (Local):
├── development.db              → 492KB (✅ Synced from Green!)
├── development.db.backup-20260211-103045 → 50KB (Old backup)
├── npm run dev                 → Works ✅ (No more errors)
```

---

## Verification:

After syncing, verify:

**1. Local Server Starts:**
```bash
cd server
npm run dev
# Expected: Server starts on localhost:3000 without errors
```

**2. Desktop App Works:**
```bash
cd desktop
/dev              # Switch to localhost:3000
npm run dev       # Start Desktop App
# Expected: No 500 errors, all features work
```

**3. Check Database Size:**
```bash
du -h server/database/development.db
# Expected: ~492KB (similar to staging.db)
```

---

## Rollback (if something goes wrong):

```bash
# Restore backup (replace TIMESTAMP with actual timestamp):
cp server/database/development.db.backup-<TIMESTAMP> server/database/development.db

# Restart local server:
cd server
npm run dev
```

---

## Troubleshooting:

### Issue: SCP Permission Denied

**Solution:**
```bash
# Check SSH key exists:
ls -l .ssh/oracle_server.key

# Fix permissions if needed:
chmod 600 .ssh/oracle_server.key
```

### Issue: Download failed

**Solution:**
```bash
# Test SSH connection:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "echo 'Connection OK'"

# Check Green Server has staging.db:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "ls -lh /home/ubuntu/database-staging.db"
```

### Issue: Local server won't start after sync

**Problem:** Development.db might be corrupted

**Solution:**
```bash
# Restore backup:
cp server/database/development.db.backup-<TIMESTAMP> server/database/development.db

# Download fresh copy:
scp -i .ssh/oracle_server.key ubuntu@129.159.8.19:/home/ubuntu/database-staging.db server/database/development.db

# Try again:
cd server && npm run dev
```

---

## Future Implementation Plan:

When `/sync-dev` command is implemented, it will:

1. **Check SSH connection** to Green Server
2. **Verify Green Server is healthy** (health check)
3. **Create local backup** automatically
4. **Download staging.db** via SCP
5. **Verify download** (checksum)
6. **Replace development.db**
7. **Run schema validation**
8. **Confirm success** with summary

**Estimated Implementation:** Week 7, 2026

---

## ⚠️ Data Privacy Note:

**IMPORTANT:** After syncing development.db from Green Server, you'll have **REAL production data locally**!

- ✅ Use for testing only
- ❌ Do NOT commit to git
- ❌ Do NOT share with others
- ❌ Do NOT upload anywhere
- ✅ Keep on encrypted disk (FileVault on macOS)
- ✅ Delete when no longer needed

**DSGVO Compliance:** Production data contains real customer information!

---

## Integration with `/dev` command:

When switching to Development with `/dev`:
1. Desktop App connects to localhost:3000
2. If you get "no such column" errors:
   - Run `/sync-dev` (or manual workaround)
   - Restart local server: `cd server && npm run dev`
   - Restart Desktop App: `cd desktop && npm run dev`
   - Errors should be resolved ✅

---

## Related Commands:

- **`/dev`** - Switch Desktop App to localhost:3000 (Development)
- **`/green`** - Switch Desktop App to Green Server:3001 (Staging)
- **`/sync-green`** - Sync Production → Staging (implemented)

---

**Last Updated:** 2026-02-11
**Status:** 🚧 Planned Feature (use manual workaround for now)
**Implementation Priority:** Medium (use manual scp for now)
