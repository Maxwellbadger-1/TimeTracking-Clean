---
description: Start dev server + open app in browser (no Tauri build required)
tags: [dev, browser, server, vite]
---

# Start Dev Environment (Browser Mode)

Frees all ports, starts the backend server and Vite frontend, then opens the app in the browser. No Tauri build needed — ideal for quick testing.

## Step 1: Check & clean shell variable

```bash
if [ ! -z "$VITE_API_URL" ]; then
  echo "WARNING: VITE_API_URL shell variable detected: $VITE_API_URL"
  echo "Clearing it to avoid overriding .env files..."
  unset VITE_API_URL
  echo "Cleared."
fi
```

## Step 2: Free ports 3000, 1420, 5173 (Windows-compatible)

Kill ALL processes on these ports **including their parent watcher processes** (nodemon, PM2, etc.) to prevent auto-restart:

```bash
for PORT in 3000 1420 5173; do
  PIDS=$(powershell -Command "Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess" 2>/dev/null)
  if [ ! -z "$PIDS" ]; then
    for PID in $PIDS; do
      # Also kill parent process to stop auto-restarts (nodemon/PM2/watcher)
      PARENT=$(powershell -Command "(Get-WmiObject Win32_Process -Filter 'ProcessId=$PID').ParentProcessId" 2>/dev/null)
      powershell -Command "Stop-Process -Id $PID -Force -ErrorAction SilentlyContinue" && echo "✅ Port $PORT freed (PID $PID)"
      if [ ! -z "$PARENT" ] && [ "$PARENT" != "0" ]; then
        powershell -Command "Stop-Process -Id $PARENT -Force -ErrorAction SilentlyContinue" && echo "   └─ Parent watcher stopped (PID $PARENT)"
      fi
    done
  else
    echo "ℹ️  Port $PORT was already free"
  fi
done
echo "All ports cleared."
```

## Step 3: Start backend server in background

Run with `run_in_background: true`:

```bash
cd server && npm run dev
```

## Step 4: Wait for server to be healthy

```bash
echo "Waiting for server..."
MAX_RETRIES=30
RETRY=0
until curl -s http://localhost:3000/api/health | grep -q '"status":"ok"'; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Server did not start after 30s. Check server logs."
    exit 1
  fi
  sleep 1
  echo "  Attempt $RETRY/$MAX_RETRIES..."
done
echo "Server is healthy at http://localhost:3000"
```

## Step 5: Ensure .env.development points to localhost

```bash
cd desktop
cat > .env.development << 'EOF'
VITE_API_URL=http://localhost:3000/api
VITE_PORT=1420
VITE_ENV=development
EOF
cp .env.development .env
echo "VITE_API_URL set to http://localhost:3000/api"
cd ..
```

## Step 6: Start Vite dev server (browser mode) in background

Run with `run_in_background: true`:

```bash
cd desktop && npm run dev
```

## Step 7: Wait for Vite, then open browser

```bash
sleep 4
echo "Opening browser at http://localhost:1420..."
start http://localhost:1420
echo ""
echo "=============================="
echo "DEV ENVIRONMENT READY"
echo "=============================="
echo "Server:  http://localhost:3000"
echo "App:     http://localhost:1420"
echo ""
echo "Stop with: lsof -ti:3000,1420 | xargs kill -9"
```
