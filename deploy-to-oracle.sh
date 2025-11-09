#!/bin/bash

# 🚀 Deploy to Oracle Cloud Server
# Automatisches Deployment des aktuellen Codes zum Oracle Server

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

echo "📥 Stashing local changes..."
git stash

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "📥 Reapplying local changes if any..."
git stash pop || true

echo "📦 Installing server dependencies..."
cd server
npm install --production

echo "🔨 Building server..."
npm run build

echo "🔄 Restarting PM2 server..."
pm2 restart timetracking-server

echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Server Logs (last 20 lines):"
pm2 logs timetracking-server --lines 20 --nostream

ENDSSH

echo ""
echo "🎉 Deployment to Oracle Cloud completed!"
echo ""
echo "🌐 Server URL: http://129.159.8.19:3000"
echo "🔍 Check logs: ssh -i \"$SSH_KEY\" ubuntu@129.159.8.19 'pm2 logs timetracking-server'"
echo ""
