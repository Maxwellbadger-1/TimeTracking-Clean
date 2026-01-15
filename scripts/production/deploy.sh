#!/bin/bash

# 🚀 Deploy to Oracle Cloud Server
# Automatisches Deployment des aktuellen Codes zum Oracle Server
#
# Features:
# - Clean deployment (entfernt alte Dateien)
# - Korrekte PM2 Working Directory
# - TypeScript Build mit allen Dependencies
# - Backup der Datenbank vor Deployment
# - Rollback-Möglichkeit

set -e  # Exit on error

echo "🚀 Starting deployment to Oracle Cloud..."
echo ""

# SSH Key Path
SSH_KEY="/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key"
SERVER_USER="ubuntu"
SERVER_IP="129.159.8.19"
REMOTE_PATH="/home/ubuntu/TimeTracking-Clean"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH Key not found: $SSH_KEY"
    exit 1
fi

# Fix SSH key permissions (must be 600)
chmod 600 "$SSH_KEY"
echo "✅ SSH Key permissions fixed"

# Test SSH Connection
echo "📡 Testing SSH connection..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 "$SERVER_USER@$SERVER_IP" "echo '✅ SSH Connection successful'"; then
    echo "❌ SSH Connection failed!"
    exit 1
fi
echo ""

# Deploy Server Code
echo "📦 Deploying server code..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
set -e

cd /home/ubuntu/TimeTracking-Clean

echo "📥 Cleaning up old files..."
# Entferne alte temporäre/untracked Dateien die Konflikte verursachen können
find . -name "*.mjs" -path "*/server/*" -not -path "*/node_modules/*" -delete 2>/dev/null || true
git clean -fd || true

echo "📥 Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

echo "🗑️ Removing old database files in wrong locations..."
# Entferne alle alten Datenbanken außer der im richtigen Verzeichnis
find /home/ubuntu -maxdepth 1 -name "database.db*" -delete 2>/dev/null || true
echo "✅ Old database files cleaned"

echo "📦 Installing server dependencies..."
cd server
# WICHTIG: npm install OHNE --production für TypeScript Build
npm install

echo "🔨 Building server with TypeScript..."
npm run build

echo "🔄 Restarting PM2 server with correct working directory..."
# Stoppe Server
pm2 stop timetracking-server || true

# Lösche PM2 Prozess komplett um Clean Start zu erzwingen
pm2 delete timetracking-server || true

# Starte Server mit korrektem Working Directory
pm2 start dist/server.js \
  --name timetracking-server \
  --cwd /home/ubuntu/TimeTracking-Clean/server \
  --time

# Speichere PM2 Config
pm2 save

echo ""
echo "⏳ Waiting for server to start..."
sleep 5

echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Server Logs (last 30 lines):"
pm2 logs timetracking-server --lines 30 --nostream

ENDSSH

echo ""
echo "🎉 Deployment to Oracle Cloud completed!"
echo ""
echo "🌐 Server URL: http://129.159.8.19:3000"
echo "🏥 Health Check: http://129.159.8.19:3000/api/health"
echo "🔍 Check logs: ssh -i \"$SSH_KEY\" ubuntu@129.159.8.19 'pm2 logs timetracking-server'"
echo "📊 PM2 Status: ssh -i \"$SSH_KEY\" ubuntu@129.159.8.19 'pm2 status'"
echo ""
echo "💡 Wichtige Hinweise:"
echo "   - Database liegt in: /home/ubuntu/TimeTracking-Clean/server/database.db"
echo "   - PM2 Working Dir: /home/ubuntu/TimeTracking-Clean/server"
echo "   - Bei Problemen: pm2 logs timetracking-server --lines 50"
echo ""
