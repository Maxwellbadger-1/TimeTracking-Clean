#!/bin/bash

# Sync Production Database to Local Development
#
# PURPOSE:
# - Downloads production database from Oracle Cloud server
# - Backs up current local database (if exists)
# - Verifies integrity via better-sqlite3 (no sqlite3 CLI needed)
# - Replaces local server/database.db with production data
#
# USAGE (from any directory):
#   npm run sync-dev-db
#   bash ./scripts/sync-dev-db.sh
#
# PREREQUISITES:
#   - .ssh/oracle_server.key exists at project root
#   - cd server && npm install (better-sqlite3 must be installed)
#
# NOTE: After sync, start the server with the default DATABASE_PATH
#   (server/.env sets DATABASE_PATH=./database.db by default)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Resolve project root from script location (works from any cwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
SSH_KEY="$PROJECT_ROOT/.ssh/oracle_server.key"
PROD_HOST="ubuntu@129.159.8.19"
PROD_DB_PATH="/home/ubuntu/databases/production.db"
LOCAL_DB="$PROJECT_ROOT/server/database.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DB="/tmp/prod_sync_${TIMESTAMP}.db"

# Cleanup temp file on exit (success or failure)
trap 'rm -f "$TEMP_DB"' EXIT

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Sync Production DB to Local${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# ─── [1/6] Pre-flight checks ─────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Pre-flight checks...${NC}"

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}ERROR: SSH key not found at: $SSH_KEY${NC}"
    echo -e "${RED}       Please ensure the key exists at: .ssh/oracle_server.key${NC}"
    exit 1
fi

# Fix SSH key permissions (Git Bash may not preserve Unix perms)
chmod 600 "$SSH_KEY" 2>/dev/null || true

# Check better-sqlite3 is installed (required for integrity check + summary)
if [ ! -d "$PROJECT_ROOT/server/node_modules/better-sqlite3" ]; then
    echo -e "${RED}ERROR: better-sqlite3 not found.${NC}"
    echo -e "${RED}       Run: cd server && npm install${NC}"
    exit 1
fi

# Test SSH connectivity
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$PROD_HOST" "echo ok" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to production server.${NC}"
    echo -e "${RED}       SSH Key: $SSH_KEY${NC}"
    echo -e "${RED}       Host: $PROD_HOST${NC}"
    exit 1
fi

echo -e "${GREEN}SSH connection OK${NC}"
echo ""

# ─── [2/6] Backup existing local DB ──────────────────────────────────────────
echo -e "${YELLOW}[2/6] Backing up local database...${NC}"

if [ -f "$LOCAL_DB" ]; then
    BACKUP="$PROJECT_ROOT/server/database.db.backup.${TIMESTAMP}"
    cp "$LOCAL_DB" "$BACKUP"
    echo -e "${GREEN}Backed up to: $BACKUP${NC}"
else
    echo -e "${YELLOW}No existing local database found (will create fresh)${NC}"
fi
echo ""

# ─── [3/6] Download production database ──────────────────────────────────────
echo -e "${YELLOW}[3/6] Downloading production database...${NC}"
echo -e "   Source: ${PROD_HOST}:${PROD_DB_PATH}"
echo -e "   Temp:   ${TEMP_DB}"

scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_HOST:$PROD_DB_PATH" "$TEMP_DB"

echo -e "${GREEN}Download complete${NC}"
echo ""

# ─── [4/6] Integrity check via node + better-sqlite3 ─────────────────────────
echo -e "${YELLOW}[4/6] Verifying database integrity...${NC}"

INTEGRITY=$(node -e "
  try {
    const D = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
    const db = new D('$TEMP_DB', { readonly: true });
    const r = db.pragma('integrity_check');
    db.close();
    process.stdout.write(r[0].integrity_check);
  } catch(e) {
    process.stderr.write(e.message);
    process.exit(1);
  }
" 2>&1)

if [[ "$INTEGRITY" != "ok" ]]; then
    echo -e "${RED}ERROR: integrity_check returned: $INTEGRITY${NC}"
    echo -e "${RED}       The downloaded file may be corrupt. Aborting.${NC}"
    exit 1
fi

echo -e "${GREEN}Integrity check passed (ok)${NC}"
echo ""

# ─── [5/6] Install: move temp DB to final location ───────────────────────────
echo -e "${YELLOW}[5/6] Installing database to server/database.db...${NC}"

mv "$TEMP_DB" "$LOCAL_DB"

echo -e "${GREEN}Database installed at: $LOCAL_DB${NC}"
echo ""

# ─── [6/6] Summary ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Summary...${NC}"

node -e "
  const D = require('$PROJECT_ROOT/server/node_modules/better-sqlite3');
  const db = new D('$LOCAL_DB', { readonly: true });
  const u = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE deletedAt IS NULL').get();
  const e = db.prepare('SELECT MAX(date) as d FROM time_entries').get();
  db.close();
  console.log('Users: ' + u.cnt + ' | Latest time entry: ' + (e.d || 'none'));
"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}SYNC COMPLETED SUCCESSFULLY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Local DB:  $LOCAL_DB"
echo -e "  Backup:    ${BACKUP:-N/A}"
echo ""
echo -e "${YELLOW}NOTE: To use this DB with npm run dev:server${NC}"
echo -e "${YELLOW}      Ensure server/.env contains: DATABASE_PATH=./database.db${NC}"
echo -e "${YELLOW}      (This is the default — no change needed unless overridden)${NC}"
echo ""
