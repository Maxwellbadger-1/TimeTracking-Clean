#!/bin/bash

# ================================================
# Enterprise-Grade Database Backup Script
# Stiftung der DPolG TimeTracker
# ================================================
#
# Features:
# - GFS Rotation (Grandfather-Father-Son)
# - SQLite Online Backup (safe for active databases)
# - Integrity Verification
# - Email Notifications (optional)
# - Health Check Logging
#
# Usage:
#   ./server/scripts/backup.sh [daily|weekly|monthly]
#
# Cronjob Setup:
#   0 2 * * *   /path/to/backup.sh daily    # Daily at 2 AM
#   0 3 * * 0   /path/to/backup.sh weekly   # Weekly (Sunday) at 3 AM
#   0 4 1 * *   /path/to/backup.sh monthly  # Monthly (1st) at 4 AM
#
# ================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ================================================
# Configuration
# ================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_PATH="$PROJECT_DIR/server/database.db"
BACKUP_BASE_DIR="$PROJECT_DIR/backups"

# GFS Rotation Settings
DAILY_RETENTION=7        # Keep 7 daily backups
WEEKLY_RETENTION=4       # Keep 4 weekly backups
MONTHLY_RETENTION=12     # Keep 12 monthly backups

# Email Notification (optional - set to empty to disable)
NOTIFICATION_EMAIL=""    # e.g. "admin@example.com"

# Health Check Log
HEALTH_LOG="$BACKUP_BASE_DIR/backup-health.log"

# ================================================
# Functions
# ================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$HEALTH_LOG"
}

error() {
    log "❌ ERROR: $1"
    send_notification "Backup Failed" "$1"
    exit 1
}

success() {
    log "✅ SUCCESS: $1"
}

send_notification() {
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        local subject="$1"
        local message="$2"
        echo "$message" | mail -s "[$subject] TimeTracker Backup" "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

check_prerequisites() {
    # Check if database exists
    if [ ! -f "$DB_PATH" ]; then
        error "Database not found at $DB_PATH"
    fi

    # Check if sqlite3 is available
    if ! command -v sqlite3 &> /dev/null; then
        error "sqlite3 command not found. Please install: brew install sqlite3"
    fi

    # Create backup directories
    mkdir -p "$BACKUP_BASE_DIR"/{daily,weekly,monthly}

    log "Prerequisites checked successfully"
}

verify_backup() {
    local backup_file="$1"

    log "🔍 Verifying backup integrity..."

    # 1. Check if file exists and is not empty
    if [ ! -s "$backup_file" ]; then
        error "Backup file is empty or doesn't exist: $backup_file"
    fi

    # 2. Run SQLite integrity check
    local integrity_result=$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>&1)

    if [ "$integrity_result" != "ok" ]; then
        error "Backup integrity check failed: $integrity_result"
    fi

    # 3. Verify table count
    local table_count=$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)

    if [ "$table_count" -lt 5 ]; then
        error "Backup has too few tables ($table_count). Expected at least 11."
    fi

    success "Backup verified successfully ($table_count tables, integrity: ok)"
}

create_backup() {
    local backup_type="$1"  # daily, weekly, monthly
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_BASE_DIR/$backup_type"
    local backup_file=""

    case "$backup_type" in
        daily)
            backup_file="$backup_dir/database_daily_$timestamp.db"
            ;;
        weekly)
            local week_num=$(date +%V)
            backup_file="$backup_dir/database_week${week_num}_$(date +%Y).db"
            ;;
        monthly)
            backup_file="$backup_dir/database_$(date +%Y-%m).db"
            ;;
        *)
            error "Invalid backup type: $backup_type (use: daily, weekly, monthly)"
            ;;
    esac

    log "================================================"
    log "🔄 Starting $backup_type backup"
    log "================================================"
    log "📁 Source: $DB_PATH"
    log "📦 Target: $backup_file"

    # Get source database size
    local db_size=$(du -h "$DB_PATH" | cut -f1)
    log "📊 Database size: $db_size"

    # Create backup using SQLite Online Backup
    # This is safe even while database is being used!
    log "🔧 Creating backup (SQLite Online Backup API)..."

    sqlite3 "$DB_PATH" ".backup '$backup_file'" || error "Backup creation failed"

    # Verify the backup
    verify_backup "$backup_file"

    # Get backup size
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log "📦 Backup size: $backup_size"

    # Rotate old backups
    rotate_backups "$backup_type"

    log "================================================"
    success "$backup_type backup completed: $(basename "$backup_file")"
    log "================================================"

    echo "$backup_file"  # Return backup path
}

rotate_backups() {
    local backup_type="$1"
    local backup_dir="$BACKUP_BASE_DIR/$backup_type"
    local retention=0

    case "$backup_type" in
        daily)
            retention=$DAILY_RETENTION
            ;;
        weekly)
            retention=$WEEKLY_RETENTION
            ;;
        monthly)
            retention=$MONTHLY_RETENTION
            ;;
    esac

    log "🗑️  Rotating $backup_type backups (keeping last $retention)..."

    # Count existing backups
    local backup_count=$(ls -1 "$backup_dir"/database_*.db 2>/dev/null | wc -l | tr -d ' ')

    if [ "$backup_count" -gt "$retention" ]; then
        local delete_count=$((backup_count - retention))
        log "   Found $backup_count backups, deleting oldest $delete_count..."

        # Delete oldest backups (sort by time, oldest first)
        ls -1t "$backup_dir"/database_*.db | tail -n "$delete_count" | while read -r old_backup; do
            log "   ❌ Deleting: $(basename "$old_backup")"
            rm -f "$old_backup"
        done
    else
        log "   Current backups: $backup_count (no deletion needed)"
    fi
}

show_summary() {
    log ""
    log "================================================"
    log "📊 Backup Summary"
    log "================================================"

    # Daily backups
    local daily_count=$(ls -1 "$BACKUP_BASE_DIR/daily"/database_*.db 2>/dev/null | wc -l | tr -d ' ')
    local daily_size=$(du -sh "$BACKUP_BASE_DIR/daily" 2>/dev/null | cut -f1)
    log "📅 Daily backups: $daily_count (Total: $daily_size)"

    # Weekly backups
    local weekly_count=$(ls -1 "$BACKUP_BASE_DIR/weekly"/database_*.db 2>/dev/null | wc -l | tr -d ' ')
    local weekly_size=$(du -sh "$BACKUP_BASE_DIR/weekly" 2>/dev/null | cut -f1)
    log "📆 Weekly backups: $weekly_count (Total: $weekly_size)"

    # Monthly backups
    local monthly_count=$(ls -1 "$BACKUP_BASE_DIR/monthly"/database_*.db 2>/dev/null | wc -l | tr -d ' ')
    local monthly_size=$(du -sh "$BACKUP_BASE_DIR/monthly" 2>/dev/null | cut -f1)
    log "📊 Monthly backups: $monthly_count (Total: $monthly_size)"

    # Total
    local total_size=$(du -sh "$BACKUP_BASE_DIR" 2>/dev/null | cut -f1)
    log "💾 Total backup size: $total_size"
    log "================================================"
}

# ================================================
# Main Execution
# ================================================

main() {
    local backup_type="${1:-daily}"  # Default to daily if not specified

    log ""
    log "================================================"
    log "🚀 Enterprise Backup System"
    log "   Stiftung der DPolG TimeTracker"
    log "================================================"

    # Run checks
    check_prerequisites

    # Create backup
    local backup_file=$(create_backup "$backup_type")

    # Show summary
    show_summary

    # Success notification
    send_notification "Backup Successful" "Backup completed: $(basename "$backup_file")"

    log ""
    log "To restore this backup:"
    log "  ./server/scripts/restore.sh $(basename "$backup_file")"
    log ""
}

# Run main function
main "$@"
