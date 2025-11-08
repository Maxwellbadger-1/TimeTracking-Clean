#!/bin/bash

# ================================================
# DSGVO Data Cleanup Script
# Stiftung der DPolG TimeTracker
# ================================================
#
# DSGVO/GDPR Compliance:
# - Daten älter als 4 Jahre werden gelöscht
# - Entspricht der gesetzlichen Aufbewahrungspflicht
#
# Features:
# - Safe execution (dry-run mode)
# - Backup before deletion
# - Detailed logging
# - Selective deletion (time_entries, absence_requests, audit_log)
#
# Usage:
#   ./server/scripts/cleanup-old-data.sh --dry-run    # Preview only
#   ./server/scripts/cleanup-old-data.sh              # Execute deletion
#
# Cronjob (yearly on Jan 1st at 3 AM):
#   0 3 1 1 * /path/to/cleanup-old-data.sh
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

# DSGVO: 4 Jahre Aufbewahrungspflicht
RETENTION_YEARS=4

# Cleanup Log
CLEANUP_LOG="$PROJECT_DIR/backups/cleanup-log.txt"

# ================================================
# Functions
# ================================================

log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message"
    echo "$message" >> "$CLEANUP_LOG"
}

error() {
    log "❌ ERROR: $1"
    exit 1
}

success() {
    log "✅ SUCCESS: $1"
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

    # Create log directory
    mkdir -p "$(dirname "$CLEANUP_LOG")"

    log "Prerequisites checked successfully"
}

create_cleanup_backup() {
    log "🔒 Creating backup before cleanup..."

    # Create cleanup backup directory
    local cleanup_backup_dir="$BACKUP_BASE_DIR/pre-cleanup"
    mkdir -p "$cleanup_backup_dir"

    # Create backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$cleanup_backup_dir/database_pre_cleanup_$timestamp.db"

    sqlite3 "$DB_PATH" ".backup '$backup_file'" || error "Backup creation failed"

    local backup_size=$(du -h "$backup_file" | cut -f1)
    success "Backup created: $(basename "$backup_file") ($backup_size)"

    echo "$backup_file"
}

count_old_records() {
    local table="$1"
    local date_column="$2"
    local cutoff_date=$(date -v-${RETENTION_YEARS}y +%Y-%m-%d 2>/dev/null || date -d "${RETENTION_YEARS} years ago" +%Y-%m-%d)

    local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table WHERE $date_column < '$cutoff_date';" 2>&1)

    echo "$count"
}

delete_old_records() {
    local table="$1"
    local date_column="$2"
    local dry_run="$3"
    local cutoff_date=$(date -v-${RETENTION_YEARS}y +%Y-%m-%d 2>/dev/null || date -d "${RETENTION_YEARS} years ago" +%Y-%m-%d)

    log ""
    log "📋 Table: $table"
    log "   Column: $date_column"
    log "   Cutoff: $cutoff_date (older than $RETENTION_YEARS years)"

    # Count records
    local old_count=$(count_old_records "$table" "$date_column")

    if [ "$old_count" -eq 0 ]; then
        log "   ✅ No old records to delete"
        return
    fi

    log "   ⚠️  Found $old_count old records"

    if [ "$dry_run" = "true" ]; then
        log "   🔍 DRY-RUN: Would delete $old_count records"

        # Show sample of what would be deleted
        log "   📄 Sample (first 5 records):"
        sqlite3 "$DB_PATH" "SELECT * FROM $table WHERE $date_column < '$cutoff_date' LIMIT 5;" | while read -r line; do
            log "      $line"
        done
    else
        log "   🗑️  Deleting $old_count records..."

        # Execute deletion
        sqlite3 "$DB_PATH" "DELETE FROM $table WHERE $date_column < '$cutoff_date';" || error "Deletion failed for table $table"

        # Verify deletion
        local remaining=$(count_old_records "$table" "$date_column")

        if [ "$remaining" -eq 0 ]; then
            success "Deleted $old_count records from $table"
        else
            error "Deletion incomplete: $remaining records still remain"
        fi
    fi
}

vacuum_database() {
    local dry_run="$1"

    if [ "$dry_run" = "true" ]; then
        log ""
        log "🔍 DRY-RUN: Would run VACUUM to reclaim disk space"
        return
    fi

    log ""
    log "🗜️  Running VACUUM to reclaim disk space..."

    local db_size_before=$(du -h "$DB_PATH" | cut -f1)
    log "   Database size before: $db_size_before"

    sqlite3 "$DB_PATH" "VACUUM;" || error "VACUUM failed"

    local db_size_after=$(du -h "$DB_PATH" | cut -f1)
    log "   Database size after: $db_size_after"

    success "VACUUM completed"
}

show_summary() {
    log ""
    log "================================================"
    log "📊 Database Summary"
    log "================================================"

    # Time Entries
    local entries_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM time_entries;" 2>&1)
    log "⏱️  Time Entries: $entries_count"

    # Absence Requests
    local absences_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM absence_requests;" 2>&1)
    log "📅 Absence Requests: $absences_count"

    # Audit Log
    local audit_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_log;" 2>&1)
    log "📝 Audit Log Entries: $audit_count"

    # Users
    local users_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;" 2>&1)
    log "👥 Active Users: $users_count"

    # Database size
    local db_size=$(du -h "$DB_PATH" | cut -f1)
    log "💾 Database Size: $db_size"

    log "================================================"
}

# ================================================
# Main Execution
# ================================================

main() {
    local dry_run=false

    # Parse arguments
    if [ $# -gt 0 ]; then
        if [ "$1" = "--dry-run" ] || [ "$1" = "-d" ]; then
            dry_run=true
            log "🔍 DRY-RUN MODE (no changes will be made)"
        fi
    fi

    log ""
    log "================================================"
    log "🗑️  DSGVO Data Cleanup Script"
    log "   Stiftung der DPolG TimeTracker"
    log "================================================"
    log "📋 Retention Period: $RETENTION_YEARS years"
    log "📅 Delete data older than: $(date -v-${RETENTION_YEARS}y +%Y-%m-%d 2>/dev/null || date -d "${RETENTION_YEARS} years ago" +%Y-%m-%d)"
    log ""

    # Check prerequisites
    check_prerequisites

    # Show current state
    log "📊 Current Database State:"
    show_summary

    # Create backup (skip in dry-run)
    if [ "$dry_run" = "false" ]; then
        local backup_file=$(create_cleanup_backup)
    else
        log ""
        log "🔍 DRY-RUN: Skipping backup creation"
    fi

    log ""
    log "================================================"
    log "🗑️  Starting Cleanup"
    log "================================================"

    # Delete old time entries
    delete_old_records "time_entries" "date" "$dry_run"

    # Delete old absence requests
    delete_old_records "absence_requests" "startDate" "$dry_run"

    # Delete old audit log entries
    # Note: audit_log uses datetime, not date
    # We need to extract date from timestamp
    local cutoff_datetime=$(date -v-${RETENTION_YEARS}y +"%Y-%m-%d 00:00:00" 2>/dev/null || date -d "${RETENTION_YEARS} years ago" +"%Y-%m-%d 00:00:00")

    log ""
    log "📋 Table: audit_log"
    log "   Column: timestamp"
    log "   Cutoff: $cutoff_datetime (older than $RETENTION_YEARS years)"

    local audit_old_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_log WHERE timestamp < '$cutoff_datetime';" 2>&1)

    if [ "$audit_old_count" -eq 0 ]; then
        log "   ✅ No old records to delete"
    else
        log "   ⚠️  Found $audit_old_count old records"

        if [ "$dry_run" = "true" ]; then
            log "   🔍 DRY-RUN: Would delete $audit_old_count records"
        else
            log "   🗑️  Deleting $audit_old_count records..."
            sqlite3 "$DB_PATH" "DELETE FROM audit_log WHERE timestamp < '$cutoff_datetime';" || error "Deletion failed for audit_log"
            success "Deleted $audit_old_count records from audit_log"
        fi
    fi

    # Vacuum database
    vacuum_database "$dry_run"

    # Show final state
    log ""
    log "📊 Final Database State:"
    show_summary

    log ""
    log "================================================"

    if [ "$dry_run" = "true" ]; then
        log "🔍 DRY-RUN COMPLETE"
        log "================================================"
        log ""
        log "To execute the cleanup, run:"
        log "  ./server/scripts/cleanup-old-data.sh"
    else
        success "CLEANUP COMPLETE"
        log "================================================"
        log ""
        log "📦 Backup saved at:"
        log "   $backup_file"
        log ""
        log "To restore if needed:"
        log "   ./server/scripts/restore.sh $(basename "$backup_file")"
    fi

    log ""
}

# Run main function
main "$@"
