#!/bin/bash
#
# Sync Production DB → Staging DB (wöchentlich, Sonntags 2 AM)
# Kopiert 1:1 alle Production-Daten zu Staging (KEINE Anonymisierung)
#
# Cron Job Setup:
#   crontab -e
#   0 2 * * 0 /home/ubuntu/TimeTracking-Staging/server/scripts/sync-prod-to-staging.sh >> /home/ubuntu/logs/db-sync.log 2>&1
#

set -e

PROD_DB="/home/ubuntu/database-production.db"
STAGING_DB="/home/ubuntu/database-staging.db"
BACKUP_DIR="/home/ubuntu/backups"

echo "======================================"
echo "🔄 Production → Staging DB Sync"
echo "======================================"
echo "Started: $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup Staging DB (before overwriting)
if [ -f "$STAGING_DB" ]; then
  BACKUP_FILE="$BACKUP_DIR/staging.before-sync.$(date +%Y%m%d_%H%M%S).db"
  echo "💾 Backing up Staging DB..."
  cp "$STAGING_DB" "$BACKUP_FILE"
  echo "✅ Backup created: $BACKUP_FILE"
fi

# Copy Production → Staging (1:1 copy, NO anonymization!)
echo "📋 Copying Production DB to Staging..."
cp "$PROD_DB" "$STAGING_DB"

# Verify copy
if [ -f "$STAGING_DB" ]; then
  STAGING_SIZE=$(du -h "$STAGING_DB" | cut -f1)
  echo "✅ Staging DB synced successfully"
  echo "📊 Staging DB size: $STAGING_SIZE"
else
  echo "❌ Sync failed! Staging DB not found"
  exit 1
fi

# Restart Staging Server (optional - PM2 will auto-reload)
echo "🔄 Restarting Staging Server..."
pm2 restart timetracking-staging || echo "⚠️  PM2 restart skipped (server might not be running)"

echo "✅ Sync completed successfully"
echo "Finished: $(date)"
echo "======================================"
