# Switch to Development Environment (Full Stack)

**Command:** `/dev`

**Purpose:** Starts complete development environment (Server + Desktop App) connected to localhost:3000

---

## What this command does:

1. **Checks for Shell Environment Variable** (critical!)
2. **Frees port 3000** (kills existing server if running)
3. **Starts Development Server** (localhost:3000)
4. **Waits for Server Health** (with timeout)
5. **Updates `.env.development`** to localhost:3000
6. **Kills running Vite server**
7. **Starts Desktop App** (localhost:1420)

---

## Execute the full stack startup:

```bash
# ═══════════════════════════════════════
# 🔍 STEP 1: Check & Clean Shell Variable
# ═══════════════════════════════════════
if [ ! -z "$VITE_API_URL" ]; then
  echo "⚠️  WARNING: Shell environment variable VITE_API_URL detected!"
  echo "   Current value: $VITE_API_URL"
  echo ""
  echo "   ℹ️  This would OVERRIDE all .env files (Vite's highest priority)!"
  echo "   → Automatically clearing for this session..."
  unset VITE_API_URL
  echo "   ✅ Cleared! Continuing with /dev startup..."
  echo ""
fi

# ═══════════════════════════════════════
# 🛑 STEP 2: Free Port 3000 (Windows-kompatibel)
# ═══════════════════════════════════════
echo ""
echo "🛑 Freeing port 3000..."
PID_ON_3000=$(netstat -ano 2>/dev/null | grep ":3000 " | grep "LISTENING" | awk '{print $5}' | head -1)
if [ ! -z "$PID_ON_3000" ]; then
  taskkill //F //PID $PID_ON_3000 2>/dev/null && echo "✅ Port 3000 freed (PID $PID_ON_3000)" || echo "ℹ️  Port 3000 already free"
else
  echo "ℹ️  Port 3000 was already free"
fi

# ═══════════════════════════════════════
# 🚀 STEP 3: Start Development Server
# ═══════════════════════════════════════
echo ""
echo "🚀 Starting Development Server (localhost:3000)..."
cd server && npm run dev &
SERVER_PID=$!
echo "✅ Server started (PID: $SERVER_PID)"

# ═══════════════════════════════════════
# ⏳ STEP 4: Wait for Server Health
# ═══════════════════════════════════════
echo ""
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
SERVER_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    SERVER_READY=true
    echo "✅ Server is healthy!"
    echo "   Response: $HEALTH"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 1
done

if [ "$SERVER_READY" = false ]; then
  echo "❌ ERROR: Server did not respond after 30 seconds"
  echo "   Check server logs for errors"
  exit 1
fi

# ═══════════════════════════════════════
# 🔧 STEP 5: Update .env.development
# ═══════════════════════════════════════
cd ..
cd desktop
cat > .env.development << 'EOF'
# Development Environment Configuration
# Desktop App connects to LOCAL server (localhost:3000)
# Uses database/development.db (production data copy)

VITE_API_URL=http://localhost:3000/api
VITE_PORT=1420
VITE_ENV=development
EOF

echo "✅ Updated .env.development → localhost:3000"

# ═══════════════════════════════════════
# 📄 STEP 6: Copy to .env
# ═══════════════════════════════════════
cp .env.development .env
echo "✅ Copied .env.development → .env"

# ═══════════════════════════════════════
# 🎨 STEP 7: Start Desktop App (Tauri)
# ═══════════════════════════════════════
echo ""
echo "🎨 Starting Tauri Desktop App..."
npm run tauri:dev &
DESKTOP_PID=$!
echo "✅ Tauri Desktop App starting (PID: $DESKTOP_PID)"
echo "   (Erster Build kann 5-10 Min dauern)"

# ═══════════════════════════════════════
# 📋 STEP 8: Display Status
# ═══════════════════════════════════════
echo ""
echo "══════════════════════════════════════════"
echo "✅ DEVELOPMENT ENVIRONMENT READY"
echo "══════════════════════════════════════════"
echo ""
echo "🖥️  Server:       http://localhost:3000"
echo "    Health:      http://localhost:3000/api/health"
echo "    Database:    database/development.db"
echo "    PID:         $SERVER_PID"
echo ""
echo "🎨 Desktop App:  Tauri window (öffnet sich automatisch)"
echo "    Connected:   localhost:3000/api"
echo "    PID:         $DESKTOP_PID"
echo ""
echo "🛑 To stop all:"
echo "   taskkill //F //IM node.exe"
echo ""
```

---

## Details:

**Target Server:** localhost:3000
**Database:** development.db (small test dataset)
**Use Case:** Full stack local development and testing
**Automatic:** Server + Desktop App startup

**Environment Variables:**
- `VITE_API_URL=http://localhost:3000/api`
- `VITE_PORT=1420`
- `VITE_ENV=development`

**Background Processes:**
- Development Server (Port 3000)
- Desktop App (Port 1420)

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

# Run /dev again
```

**Why this happens:**
- Previous `export VITE_API_URL=...` command in shell
- Persists across terminal sessions (depending on shell config)
- Must be manually unset

**Prevention:**
- ❌ Never use: `export VITE_API_URL=...`
- ✅ Always use: .env files or slash commands

---

### Issue #2: Port Already in Use

**Problem:** "Error: listen EADDRINUSE: address already in use :::3000"

**Root Cause:** Previous server process still running

**Solution:** Command automatically frees port 3000 before starting!

**Manual Fix:**
```bash
# Kill process on port 3000:
lsof -ti:3000 | xargs kill -9

# Or find and kill manually:
lsof -i:3000
kill -9 <PID>
```

---

### Issue #3: Server Doesn't Start

**Problem:** Health check times out after 30 seconds

**Diagnosis:**
```bash
# Check server logs:
cd server
npm run dev

# Look for errors like:
# - Database locked
# - Missing dependencies
# - Port conflict
```

**Common Fixes:**
- Database locked: Close other SQLite connections
- Missing deps: `cd server && npm install`
- TypeScript errors: `cd server && npx tsc --noEmit`

---

## Verification:

After command completes, you should see:

**Terminal Output:**
```
✅ DEVELOPMENT ENVIRONMENT READY
🖥️  Server:       http://localhost:3000
🎨 Desktop App:  http://localhost:1420
```

**Server Health Check:**
```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","message":"TimeTracking Server is running",...}
```

**Vite Terminal Output:**
```
🔥 VITE CONFIG DEBUG START 🔥
VITE_API_URL: http://localhost:3000/api
```

**Browser Console** (F12):
```
🔥 LAYER 2 DEBUG - Runtime Environment:
🔍 Fetch wird gehen zu: http://localhost:3000/api
```

---

## Stop Development Environment:

**Kill all processes:**
```bash
# Kill server + desktop:
lsof -ti:3000,1420 | xargs kill -9

# Or by name:
pkill -f "npm run dev"
pkill -f "tsx watch"
```

**Verify stopped:**
```bash
lsof -i:3000  # Should show nothing
lsof -i:1420  # Should show nothing
```

---

**Last Updated:** 2026-02-11
**Auto-Start:** ✅ Server + Desktop App
**Port Cleanup:** ✅ Automatic
**Health Check:** ✅ 30s timeout
