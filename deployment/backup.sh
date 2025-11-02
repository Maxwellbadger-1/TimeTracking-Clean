#!/bin/bash
#
# TimeTracking System - Automated Backup Script
#
# This script creates daily backups of the SQLite database
# and removes backups older than 30 days
#
# Usage: Add to crontab for daily execution
# crontab -e
# 0 2 * * * /home/ubuntu/TimeTracking-Clean/deployment/backup.sh >> /home/ubuntu/logs/backup.log 2>&1
#

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/backups"
DB_PATH="/home/ubuntu/TimeTracking-Clean/server/database.db"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Starting backup...${NC}"
echo "Time: $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    exit 1
fi

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/database_$DATE.db"

# Copy database
echo -e "${GREEN}📦 Copying database...${NC}"
cp "$DB_PATH" "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Compress backup (optional - uncomment if you want compression)
# gzip "$BACKUP_FILE"
# echo -e "${GREEN}📦 Backup compressed: ${BACKUP_FILE}.gz${NC}"

# Remove old backups
echo -e "${YELLOW}🗑️  Removing backups older than $RETENTION_DAYS days...${NC}"
DELETED_COUNT=$(find "$BACKUP_DIR" -name "database_*.db" -type f -mtime +$RETENTION_DAYS -print -delete | wc -l)

if [ "$DELETED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Removed $DELETED_COUNT old backup(s)${NC}"
else
    echo -e "${GREEN}✅ No old backups to remove${NC}"
fi

# List current backups
echo -e "${YELLOW}📋 Current backups:${NC}"
ls -lh "$BACKUP_DIR"/database_*.db 2>/dev/null || echo "No backups found"

# Backup statistics
TOTAL_BACKUPS=$(ls -1 "$BACKUP_DIR"/database_*.db 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo ""
echo -e "${GREEN}✅ Backup completed successfully${NC}"
echo "Total backups: $TOTAL_BACKUPS"
echo "Total size: $TOTAL_SIZE"
echo "Latest backup: $BACKUP_FILE"
echo ""
