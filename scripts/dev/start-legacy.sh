#!/bin/bash

# TimeTracking Development Startup Script
# Dieser Script startet automatisch Server + Desktop App

set -e  # Exit on error

echo "🧹 Cleaning up old processes..."
killall -9 node npm vite cargo tauri 2>/dev/null || true
sleep 2

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Backend Server..."
cd "$PROJECT_ROOT/server"
npm start &
SERVER_PID=$!

echo "⏳ Waiting for server to start..."
sleep 4

# Check if server is running
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Server failed to start!"
    exit 1
fi

echo "✅ Server running on http://localhost:3000"

echo "🖥️  Starting Desktop App..."
cd "$PROJECT_ROOT"
exec npm run dev:desktop
