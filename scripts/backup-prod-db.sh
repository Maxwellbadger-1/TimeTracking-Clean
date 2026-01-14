#!/bin/bash
# Backup production database

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load SSH config
source "$PROJECT_ROOT/.env.ssh" 2>/dev/null || {
  SSH_KEY_PATH="$PROJECT_ROOT/.ssh/oracle_server.key"
  SSH_USER="ubuntu"
  SSH_HOST="129.159.8.19"
  PROD_DB_PATH="/home/ubuntu/TimeTracking-Clean/server/database.db"
}

# Create backups directory if not exists
mkdir -p "$PROJECT_ROOT/backups"

# Backup filename with timestamp
BACKUP_FILE="$PROJECT_ROOT/backups/database-$(date +%Y%m%d-%H%M%S).db"

echo "📦 Backing up production database..."
scp -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST:$PROD_DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $BACKUP_FILE"
  echo "📊 File size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "❌ Backup failed!"
  exit 1
fi
