#!/bin/bash

# ================================================
# Enterprise-Grade Database Restore Script
# Stiftung der DPolG TimeTracker
# ================================================
#
# Features:
# - Safety checks before restore
# - Automatic backup of current database
# - Integrity verification
# - Rollback capability
#
# Usage:
#   ./server/scripts/restore.sh <backup-file>
#   ./server/scripts/restore.sh database_daily_20251104_020000.db
#   ./server/scripts/restore.sh --list    # List available backups
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

# Safety backup before restore
SAFETY_BACKUP_DIR="$BACKUP_BASE_DIR/pre-restore"

# ================================================
# Functions
# ================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    log "❌ ERROR: $1"
    exit 1
}

success() {
    log "✅ SUCCESS: $1"
}

list_backups() {
    log "================================================"
    log "📂 Available Backups"
    log "================================================"
    log ""

    # Daily backups
    log "📅 Daily Backups:"
    local daily_backups=$(ls -1t "$BACKUP_BASE_DIR/daily"/database_*.db 2>/dev/null || echo "")
    if [ -z "$daily_backups" ]; then
        log "   (none)"
    else
        echo "$daily_backups" | while read -r backup; do
            local size=$(du -h "$backup" | cut -f1)
            local date=$(basename "$backup" | sed 's/database_daily_\(.*\)\.db/\1/')
            log "   $(basename "$backup") ($size) - $date"
        done
    fi
    log ""

    # Weekly backups
    log "📆 Weekly Backups:"
    local weekly_backups=$(ls -1t "$BACKUP_BASE_DIR/weekly"/database_*.db 2>/dev/null || echo "")
    if [ -z "$weekly_backups" ]; then
        log "   (none)"
    else
        echo "$weekly_backups" | while read -r backup; do
            local size=$(du -h "$backup" | cut -f1)
            log "   $(basename "$backup") ($size)"
        done
    fi
    log ""

    # Monthly backups
    log "📊 Monthly Backups:"
    local monthly_backups=$(ls -1t "$BACKUP_BASE_DIR/monthly"/database_*.db 2>/dev/null || echo "")
    if [ -z "$monthly_backups" ]; then
        log "   (none)"
    else
        echo "$monthly_backups" | while read -r backup; do
            local size=$(du -h "$backup" | cut -f1)
            log "   $(basename "$backup") ($size)"
        done
    fi
    log ""

    log "================================================"
    log "To restore a backup:"
    log "  ./server/scripts/restore.sh <backup-filename>"
    log "================================================"
}

verify_backup_file() {
    local backup_file="$1"

    log "🔍 Verifying backup file..."

    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi

    # Check if file is not empty
    if [ ! -s "$backup_file" ]; then
        error "Backup file is empty: $backup_file"
    fi

    # Run SQLite integrity check
    if ! command -v sqlite3 &> /dev/null; then
        error "sqlite3 command not found. Please install: brew install sqlite3"
    fi

    local integrity_result=$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>&1)

    if [ "$integrity_result" != "ok" ]; then
        error "Backup integrity check failed: $integrity_result"
    fi

    # Verify table count
    local table_count=$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)

    if [ "$table_count" -lt 5 ]; then
        error "Backup has too few tables ($table_count). Expected at least 11."
    fi

    success "Backup file verified ($table_count tables, integrity: ok)"
}

create_safety_backup() {
    log "🔒 Creating safety backup of current database..."

    # Create safety backup directory
    mkdir -p "$SAFETY_BACKUP_DIR"

    # Create safety backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local safety_file="$SAFETY_BACKUP_DIR/database_pre_restore_$timestamp.db"

    if [ -f "$DB_PATH" ]; then
        sqlite3 "$DB_PATH" ".backup '$safety_file'" || error "Safety backup failed"

        local safety_size=$(du -h "$safety_file" | cut -f1)
        success "Safety backup created: $(basename "$safety_file") ($safety_size)"
        echo "$safety_file"  # Return path for potential rollback
    else
        log "⚠️  No existing database found (first restore?)"
        echo ""
    fi
}

stop_server() {
    log "🛑 Checking if server is running..."

    # Check for running Node.js processes
    local node_pids=$(pgrep -f "node.*server" || echo "")

    if [ -n "$node_pids" ]; then
        log "⚠️  WARNING: Server is running! Please stop it first:"
        log "   ./stop-dev.sh"
        log ""
        read -p "Do you want to continue anyway? (yes/NO): " -r
        echo

        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            error "Restore cancelled by user"
        fi

        log "⚠️  Continuing with server running (may cause issues!)"
    else
        success "Server is not running"
    fi
}

restore_backup() {
    local backup_file="$1"

    log "================================================"
    log "🔄 Starting Database Restore"
    log "================================================"
    log "📁 Backup file: $backup_file"
    log "📂 Target: $DB_PATH"
    log ""

    # Create safety backup
    local safety_file=$(create_safety_backup)

    # Stop server check
    stop_server

    # Copy backup to database location
    log "📦 Restoring database..."
    cp "$backup_file" "$DB_PATH" || error "Restore failed"

    # Verify restored database
    log "🔍 Verifying restored database..."
    local integrity_result=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)

    if [ "$integrity_result" != "ok" ]; then
        # Rollback!
        log "❌ Restored database is corrupted! Rolling back..."

        if [ -n "$safety_file" ] && [ -f "$safety_file" ]; then
            cp "$safety_file" "$DB_PATH"
            error "Restore failed and rolled back to previous state"
        else
            error "Restore failed and no safety backup available!"
        fi
    fi

    log "================================================"
    success "Database restored successfully!"
    log "================================================"
    log ""
    log "📊 Database info:"

    # Show table count
    local table_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)
    log "   Tables: $table_count"

    # Show user count
    local user_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>&1)
    log "   Users: $user_count"

    # Show time entries count
    local entries_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM time_entries;" 2>&1)
    log "   Time Entries: $entries_count"

    log ""
    log "⚠️  IMPORTANT: Restart the server to use the restored database:"
    log "   ./SIMPLE-START.sh"
    log ""

    if [ -n "$safety_file" ] && [ -f "$safety_file" ]; then
        log "📦 Safety backup kept at:"
        log "   $safety_file"
        log ""
        log "To rollback to previous state:"
        log "   cp \"$safety_file\" \"$DB_PATH\""
    fi

    log "================================================"
}

find_backup_file() {
    local backup_name="$1"

    # Check if full path provided
    if [ -f "$backup_name" ]; then
        echo "$backup_name"
        return
    fi

    # Search in backup directories
    for dir in daily weekly monthly; do
        local full_path="$BACKUP_BASE_DIR/$dir/$backup_name"
        if [ -f "$full_path" ]; then
            echo "$full_path"
            return
        fi
    done

    error "Backup file not found: $backup_name"
}

# ================================================
# Main Execution
# ================================================

main() {
    if [ $# -eq 0 ]; then
        log "Usage: $0 <backup-file>"
        log "       $0 --list"
        exit 1
    fi

    # Handle --list
    if [ "$1" = "--list" ] || [ "$1" = "-l" ]; then
        list_backups
        exit 0
    fi

    local backup_name="$1"

    log ""
    log "================================================"
    log "🔄 Enterprise Restore System"
    log "   Stiftung der DPolG TimeTracker"
    log "================================================"
    log ""

    # Find backup file
    local backup_file=$(find_backup_file "$backup_name")
    log "📁 Found backup: $backup_file"

    # Verify backup
    verify_backup_file "$backup_file"

    # Confirmation
    log ""
    log "⚠️  WARNING: This will replace your current database!"
    log ""
    read -p "Are you sure you want to restore? (yes/NO): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi

    # Restore
    restore_backup "$backup_file"
}

# Run main function
main "$@"
