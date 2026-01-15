#!/bin/bash

# Sync Production Database to Development
#
# PURPOSE:
# - Downloads production database from Oracle Cloud
# - Backs up current dev database
# - Replaces dev database with production data
# - Runs migration scripts
#
# USAGE:
#   ./scripts/sync-prod-to-dev.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_HOST="ubuntu@129.159.8.19"
PROD_DB_PATH="/home/ubuntu/TimeTracking-Clean/server/database.db"
DEV_DB_PATH="./database/development.db"
BACKUP_DIR="./database/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# SSH Key (relative to project root)
SSH_KEY="../.ssh/oracle_server.key"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ ERROR: SSH key not found at: $SSH_KEY${NC}"
    echo -e "${RED}   Please ensure the key exists${NC}"
    exit 1
fi

# Set correct permissions
chmod 600 "$SSH_KEY" 2>/dev/null || true

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Sync Production DB to Dev${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 1. Check SSH connection
echo -e "${YELLOW}[1/6] Testing SSH connection...${NC}"
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $PROD_HOST "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Cannot connect to production server${NC}"
    echo -e "${RED}   SSH Key: $SSH_KEY${NC}"
    echo -e "${RED}   Host: $PROD_HOST${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection OK${NC}"
echo ""

# 2. Backup current dev database
echo -e "${YELLOW}[2/6] Backing up current dev database...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -f "$DEV_DB_PATH" ]; then
    BACKUP_PATH="${BACKUP_DIR}/development_backup_${TIMESTAMP}.db"
    cp "$DEV_DB_PATH" "$BACKUP_PATH"
    echo -e "${GREEN}✅ Dev database backed up to: ${BACKUP_PATH}${NC}"
else
    echo -e "${YELLOW}⚠️  No existing dev database found (will create new)${NC}"
fi
echo ""

# 3. Download production database
echo -e "${YELLOW}[3/6] Downloading production database...${NC}"
TEMP_PROD_DB="/tmp/prod_database_${TIMESTAMP}.db"

echo -e "   Downloading from: ${PROD_HOST}:${PROD_DB_PATH}"
if scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_HOST:$PROD_DB_PATH" "$TEMP_PROD_DB"; then
    echo -e "${GREEN}✅ Production database downloaded${NC}"

    # Check file size
    SIZE=$(du -h "$TEMP_PROD_DB" | cut -f1)
    echo -e "   Size: ${SIZE}"
else
    echo -e "${RED}❌ ERROR: Failed to download production database${NC}"
    exit 1
fi
echo ""

# 4. Replace dev database
echo -e "${YELLOW}[4/6] Replacing dev database...${NC}"
mkdir -p "$(dirname "$DEV_DB_PATH")"
mv "$TEMP_PROD_DB" "$DEV_DB_PATH"
echo -e "${GREEN}✅ Dev database replaced with production data${NC}"
echo ""

# 5. Run migration scripts
echo -e "${YELLOW}[5/6] Running migration scripts...${NC}"

echo -e "   🔄 Running overtime transaction migration..."
if npm run migrate:overtime > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Overtime migration completed${NC}"
else
    echo -e "${RED}   ⚠️  Overtime migration had issues (check logs)${NC}"
fi

echo -e "   🔄 Syncing work time accounts..."
if npm run sync:worktime > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Work time accounts synced${NC}"
else
    echo -e "${RED}   ⚠️  Work time sync had issues (check logs)${NC}"
fi
echo ""

# 6. Verify data
echo -e "${YELLOW}[6/6] Verifying data integrity...${NC}"

# Count users
USER_COUNT=$(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;")
echo -e "   👤 Active users: ${USER_COUNT}"

# Count time entries
ENTRY_COUNT=$(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM time_entries;")
echo -e "   ⏱️  Time entries: ${ENTRY_COUNT}"

# Count overtime transactions
TRANSACTION_COUNT=$(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM overtime_transactions;")
echo -e "   📊 Overtime transactions: ${TRANSACTION_COUNT}"

# Check balances
echo -e "   💰 User balances:"
sqlite3 "$DEV_DB_PATH" "
SELECT
    '     ' || u.firstName || ' ' || u.lastName || ': ' ||
    CASE WHEN wta.currentBalance >= 0 THEN '+' ELSE '' END ||
    ROUND(wta.currentBalance, 1) || 'h'
FROM users u
LEFT JOIN work_time_accounts wta ON u.id = wta.userId
WHERE u.deletedAt IS NULL
ORDER BY u.id
LIMIT 5;
"

echo ""
echo -e "${GREEN}✅✅✅ SYNC COMPLETED SUCCESSFULLY ✅✅✅${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Dev Database: ${DEV_DB_PATH}"
echo -e "  Backup saved: ${BACKUP_PATH:-N/A}"
echo -e "  Users: ${USER_COUNT}"
echo -e "  Time Entries: ${ENTRY_COUNT}"
echo -e "  Transactions: ${TRANSACTION_COUNT}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: This is production data!${NC}"
echo -e "${YELLOW}   - Do NOT commit this database${NC}"
echo -e "${YELLOW}   - Be careful when testing${NC}"
echo ""
