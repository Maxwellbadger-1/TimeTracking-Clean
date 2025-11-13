#!/bin/bash

# SIMPLE START - WITH PROPER CLEANUP
# Prevents multiple instances and cleans up on exit
# Best Practice: Kill process group on exit

set -e

LOCKFILE="/tmp/timetracking-dev.lock"
SCRIPT_PID=$$

# Check if already running
if [ -f "$LOCKFILE" ]; then
  echo "❌ Development server already running (PID: $(cat $LOCKFILE))"
  echo "   Run './stop-dev.sh' first to stop it"
  exit 1
fi

# Cleanup function - Kills ALL child processes using pkill -P
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."

  # Kill all child processes of this script
  pkill -P $SCRIPT_PID 2>/dev/null || true

  # Also kill known process names (belt and suspenders)
  killall -9 node npm vite cargo tauri tsx 2>/dev/null || true

  # Remove lockfile
  rm -f "$LOCKFILE"

  echo "✅ Cleanup complete"
}

# Register cleanup on exit (EXIT catches ALL exit conditions)
trap cleanup EXIT INT TERM QUIT HUP

echo ""
echo "⚠️  IMPORTANT: Never run this script with '&' in background!"
echo "   The script manages background processes internally."
echo "   Just run: ./SIMPLE-START.sh"
echo ""

echo "🛑 Stopping any existing processes..."
killall -9 node npm vite cargo tauri tsx 2>/dev/null || true
sleep 2

echo "🚀 Starting Server (Port 3000)..."
cd server
npm start &
SERVER_PID=$!
echo "$SERVER_PID" > "$LOCKFILE"
echo "   Server PID: $SERVER_PID (saved to lockfile)"
echo "   Script PID: $SCRIPT_PID (parent process)"

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
