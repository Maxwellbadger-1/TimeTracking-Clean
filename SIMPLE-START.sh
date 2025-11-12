#!/bin/bash

# SIMPLE START - WITH PROPER CLEANUP
# Prevents multiple instances and cleans up on exit

set -e

LOCKFILE="/tmp/timetracking-dev.lock"

# Check if already running
if [ -f "$LOCKFILE" ]; then
  echo "❌ Development server already running (PID: $(cat $LOCKFILE))"
  echo "   Run './stop-dev.sh' first to stop it"
  exit 1
fi

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  if [ -f "$LOCKFILE" ]; then
    SERVER_PID=$(cat "$LOCKFILE")
    kill -TERM $SERVER_PID 2>/dev/null || true
    rm -f "$LOCKFILE"
  fi
  killall -9 node npm vite cargo tauri tsx 2>/dev/null || true
  echo "✅ Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

echo "🛑 Stopping any existing processes..."
killall -9 node npm vite cargo tauri tsx 2>/dev/null || true
sleep 2

echo "🚀 Starting Server (Port 3000)..."
cd server
npm start &
SERVER_PID=$!
echo "$SERVER_PID" > "$LOCKFILE"
echo "   Server PID: $SERVER_PID (saved to lockfile)"

sleep 5

echo "✅ Checking Server Health..."
curl -s http://localhost:3000/api/health || echo "❌ Server not responding"

echo ""
echo "🖥️  Starting Desktop App..."
echo "   (Press Ctrl+C to stop everything)"
cd ..
cd desktop
cargo tauri dev

# This line will only run if tauri exits normally (not Ctrl+C)
echo ""
echo "Desktop app closed"
