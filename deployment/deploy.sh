#!/bin/bash
#
# TimeTracking System - Deployment Script
#
# Usage: ./deploy.sh [production|staging]
#

set -e  # Exit on error

ENV=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Deploying TimeTracking System to $ENV..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_DIR="$PROJECT_ROOT/server"
REMOTE_USER=${REMOTE_USER:-ubuntu}
REMOTE_HOST=${REMOTE_HOST:-YOUR_SERVER_IP}
REMOTE_PATH=${REMOTE_PATH:-/home/ubuntu/TimeTracking-Clean}
SSH_KEY=${SSH_KEY:-~/.ssh/timetracking-key.pem}

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Environment: $ENV"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote Path: $REMOTE_PATH"
echo "  SSH Key: $SSH_KEY"
echo ""

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $SSH_KEY${NC}"
    echo "Please set SSH_KEY environment variable or place key at default location"
    exit 1
fi

# Step 1: Build locally
echo -e "${GREEN}📦 Building locally...${NC}"
cd "$SERVER_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Step 2: Sync to server
echo -e "${GREEN}📤 Syncing to server...${NC}"

# Create remote directory if it doesn't exist
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH/server"

# Sync files (exclude node_modules, .git, etc.)
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '*.log' \
    --exclude 'database.db' \
    --exclude '.env' \
    -e "ssh -i $SSH_KEY" \
    "$SERVER_DIR/" \
    "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/server/"

echo -e "${GREEN}✅ Files synced${NC}"

# Step 3: Install dependencies on server
echo -e "${GREEN}📥 Installing dependencies on server...${NC}"

ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
cd /home/ubuntu/TimeTracking-Clean/server
npm install --production
EOF

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4: Restart PM2
echo -e "${GREEN}🔄 Restarting PM2...${NC}"

ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
# Restart or start if not running
pm2 restart timetracking-api || pm2 start /home/ubuntu/TimeTracking-Clean/server/dist/server.js --name timetracking-api

# Save PM2 config
pm2 save

# Show status
pm2 status
EOF

echo -e "${GREEN}✅ PM2 restarted${NC}"

# Step 5: Health check
echo -e "${GREEN}🏥 Running health check...${NC}"
sleep 3  # Wait for server to start

HEALTH_URL="http://$REMOTE_HOST:3000/api/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo ""
    echo "Server URL: http://$REMOTE_HOST:3000"
    echo "Health Check: $HEALTH_URL"
else
    echo -e "${RED}❌ Health check failed (HTTP $HEALTH_RESPONSE)${NC}"
    echo "Check server logs: ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST 'pm2 logs timetracking-api'"
    exit 1
fi
