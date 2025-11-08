#!/bin/bash

# SIMPLE START - NUR FOREGROUND
# Kein Background-Prozess-Chaos mehr!

set -e

echo "🧹 Cleaning up..."
killall -9 node npm vite cargo tauri tsx 2>/dev/null || true
sleep 2

echo "🚀 Starting Server (Port 3000)..."
cd server
npm start &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

sleep 5

echo "✅ Checking Server Health..."
curl -s http://localhost:3000/api/health || echo "❌ Server not responding"

echo ""
echo "🖥️  Starting Desktop App..."
cd ..
cd desktop
cargo tauri dev

echo ""
echo "To stop: killall -9 node npm vite cargo tauri"
