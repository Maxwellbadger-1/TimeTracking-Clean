# Switch Desktop App to Green Server (Staging)

**Command:** `/green`

**Purpose:** Switches the Desktop App (localhost:1420) to connect to the Green Server (Staging - Port 3001) with real production data

---

## What this command does:

1. **Checks for Shell Environment Variable** (critical!)
2. **Updates `.env.development`** to Green Server
3. **Copies `.env.staging` → `.env`**
4. **Kills running Vite server**
5. **Tests Green Server connectivity**
6. **Displays next steps** and verification commands

---

## Execute the switch:

```bash
cd desktop

# ═══════════════════════════════════════
# 🔍 STEP 1: Check for Shell Variable
# ═══════════════════════════════════════
if [ ! -z "$VITE_API_URL" ]; then
  echo "⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️"
  echo ""
  echo "Shell environment variable VITE_API_URL is set!"
  echo "Current value: $VITE_API_URL"
  echo ""
  echo "❌ This OVERRIDES all .env files (highest priority in Vite)!"
  echo ""
  echo "🔧 FIX: Run these commands first:"
  echo "   unset VITE_API_URL"
  echo "   printenv | grep VITE    # Verify it's gone"
  echo ""
  echo "Then run /green again."
  echo ""
  exit 1
fi

# ═══════════════════════════════════════
# 🔧 STEP 2: Update .env.development
# ═══════════════════════════════════════
cat > .env.development << 'EOF'
# Development Environment Configuration
# Desktop App connects to GREEN SERVER (129.159.8.19:3001)
# Uses staging.db (Production snapshot with REAL data)

VITE_API_URL=http://129.159.8.19:3001/api
VITE_PORT=1420
VITE_ENV=development
EOF

echo "✅ Updated .env.development → Green Server (Port 3001)"

# ═══════════════════════════════════════
# 📄 STEP 3: Copy to .env
# ═══════════════════════════════════════
cp .env.staging .env
echo "✅ Copied .env.staging → .env"

# ═══════════════════════════════════════
# 🛑 STEP 4: Kill Vite Server
# ═══════════════════════════════════════
echo ""
echo "🛑 Stopping Vite server..."
pkill -f "vite" && echo "✅ Vite server stopped" || echo "ℹ️  No Vite server was running"

# ═══════════════════════════════════════
# 🌐 STEP 5: Test Green Server Connectivity
# ═══════════════════════════════════════
echo ""
echo "🔍 Testing Green Server connectivity..."
HEALTH_CHECK=$(curl -s http://129.159.8.19:3001/api/health)
if [ $? -eq 0 ]; then
  echo "✅ Green Server is reachable!"
  echo "$HEALTH_CHECK" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_CHECK"
else
  echo "❌ Green Server NOT reachable!"
  echo ""
  echo "🔧 Troubleshooting:"
  echo "1. Check if Green Server is running:"
  echo "   ssh ubuntu@129.159.8.19 'pm2 status timetracking-staging'"
  echo ""
  echo "2. Check Green Server logs:"
  echo "   ssh ubuntu@129.159.8.19 'pm2 logs timetracking-staging --lines 50'"
  echo ""
  echo "3. Restart Green Server if needed:"
  echo "   ssh ubuntu@129.159.8.19 'pm2 restart timetracking-staging'"
fi

# ═══════════════════════════════════════
# 📋 STEP 6: Display Instructions
# ═══════════════════════════════════════
echo ""
echo "══════════════════════════════════════════"
echo "✅ Desktop App → Green Server (Port 3001)"
echo "══════════════════════════════════════════"
echo ""
echo "📋 Next steps:"
echo "1. Start Desktop App:"
echo "   npm run dev"
echo ""
echo "2. Open Browser: http://localhost:1420"
echo ""
echo "3. Verify connection in Browser Console (F12):"
echo "   Look for: 🔍 Fetch wird gehen zu: http://129.159.8.19:3001/api"
echo ""
echo "4. Login with PRODUCTION credentials"
echo ""
echo "🔍 Troubleshooting:"
echo "If still connecting to wrong server, check:"
echo "   printenv | grep VITE"
echo ""
echo "If VITE_API_URL is set, run: unset VITE_API_URL"
echo ""
```

---

## Details:

**Target Server:** http://129.159.8.19:3001
**Port:** 3001 (Green Server - Staging)
**Database:** `/home/ubuntu/database-staging.db` (Separate file, not shared)
**PM2 Process:** `timetracking-staging`
**Use Case:** Pre-production testing with real production data

**Environment Variables:**
- `VITE_API_URL=http://129.159.8.19:3001/api`
- `VITE_PORT=1420`
- `VITE_ENV=staging`

---

## Database Sync Strategy:

**Current Setup:** Manual Sync (On-Demand)

Green Server uses a **SEPARATE** database (`database-staging.db`), not a symlink to shared DB.

To synchronize Green Server with Production (Blue):
```bash
/sync-green
```

This will:
1. Create backup of current staging.db
2. Copy production data → staging.db
3. Restart Green Server
4. Verify schema matches

**When to sync:**
- Before testing new migrations
- When Green Server schema is outdated
- After significant production data changes

---

## When to use Green Server:

1. **Bug Reproduction:** Test bugs with real production data
2. **Migration Testing:** Verify database migrations before production (sync first!)
3. **Feature Testing:** Validate features with realistic datasets
4. **Pre-Production QA:** Final testing before deploying to Blue (production)

---

## Next Steps:

After running this command:
1. Stop the Desktop App if running (Ctrl+C)
2. Start it again: `npm run dev`
3. The app will now connect to Green Server (Port 3001)
4. Login with your **production credentials** (same as Blue Server)
5. Test features with real production data

---

## Important Notes:

- Green Server has **SEPARATE** database (not shared with Blue)
- Changes to `staging.db` do **NOT** affect `production.db` ✅
- Green Server needs **manual sync** to stay up-to-date (use `/sync-green`)
- Green Server restarts automatically on `staging` branch push

---

## Health Check:

Verify Green Server is running:
```bash
curl http://129.159.8.19:3001/api/health
# Expected: {"status":"ok","message":"TimeTracking Server is running"}
```

View server logs:
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19
pm2 logs timetracking-staging --lines 50
```

---

## ⚠️ Known Issues:

### Issue #1: Shell Environment Variable Override

**Problem:** Even with correct .env files, app connects to wrong server

**Root Cause:** Shell environment variable `VITE_API_URL` overrides ALL .env files (Vite's highest priority!)

**Solution:**
```bash
# Check if set:
printenv | grep VITE_API_URL

# If found, unset it:
unset VITE_API_URL

# Run /green again
```

### Issue #2: Green Server Out of Sync

**Problem:** 500 Errors, "no such column" errors, schema mismatch

**Root Cause:** Green Server database is outdated (missing recent migrations)

**Solution:**
```bash
# Sync Green with Production:
/sync-green

# This will update staging.db with latest production data + schema
```

---

## Verification:

After starting `npm run dev`, you should see in **Vite Terminal Output**:
```
🔥 VITE CONFIG DEBUG START 🔥
VITE_API_URL: http://129.159.8.19:3001/api
```

In **Browser Console** (F12):
```
🔥 LAYER 2 DEBUG - Runtime Environment:
🔍 Fetch wird gehen zu: http://129.159.8.19:3001/api

✅ Green Server REACHABLE: {status: "ok", message: "TimeTracking Server is running"}
```
