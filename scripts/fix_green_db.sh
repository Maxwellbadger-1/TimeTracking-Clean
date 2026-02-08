#!/bin/bash

# Script to fix GREEN server database
# This script will be run on the GREEN server to recreate the database with correct schema

echo "Starting GREEN database fix..."
echo "================================"

# Backup current database
echo "1. Creating backup of current database..."
cp /home/ubuntu/TimeTracking-Clean/server/database.db /home/ubuntu/TimeTracking-Clean/server/database.backup.$(date +%Y%m%d_%H%M%S).db

# Stop the server
echo "2. Stopping server..."
pm2 stop timetracking-server

# Remove old database
echo "3. Removing corrupted database..."
rm /home/ubuntu/TimeTracking-Clean/server/database.db

# Change to server directory
cd /home/ubuntu/TimeTracking-Clean/server

# Rebuild TypeScript
echo "4. Rebuilding TypeScript..."
npm run build

# Initialize new database - the server will create it with correct schema on first run
echo "5. Starting server to initialize database..."
cd /home/ubuntu/TimeTracking-Clean
NODE_ENV=production TZ=Europe/Berlin ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420' SESSION_SECRET=your-secret-key-here pm2 start server/dist/server.js --name timetracking-server

echo "6. Waiting for server to start and create database..."
sleep 5

# Check health
echo "7. Checking server health..."
curl http://localhost:3000/api/health

echo ""
echo "================================"
echo "GREEN database fix completed!"
echo "================================"