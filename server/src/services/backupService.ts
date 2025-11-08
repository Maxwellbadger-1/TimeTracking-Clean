import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import db, { reconnectDatabase } from '../database/connection.js';

// Backup directory (outside server folder)
const BACKUP_DIR = path.join(process.cwd(), '../backups');
const DB_PATH = path.join(process.cwd(), 'database.db');

console.log('💾 Backup Service initialized');
console.log('📁 Database path:', DB_PATH);
console.log('📁 Backup directory:', BACKUP_DIR);

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✅ Backup directory created:', BACKUP_DIR);
  }
}

/**
 * Create database backup
 * Returns: backup file path
 */
export function createBackup(): string {
  try {
    ensureBackupDir();

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `database-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Force checkpoint to write WAL to main database
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);

    console.log(`✅ Database backup created: ${backupFilename}`);

    // Clean up old backups (keep last 30)
    cleanOldBackups();

    return backupPath;
  } catch (error) {
    console.error('❌ Backup creation failed:', error);
    throw error;
  }
}

/**
 * List all backups (sorted by date, newest first)
 */
export function listBackups(): Array<{ filename: string; size: number; created: Date }> {
  try {
    ensureBackupDir();

    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter((file) => file.startsWith('database-backup-') && file.endsWith('.db'))
      .map((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return backups;
  } catch (error) {
    console.error('❌ Failed to list backups:', error);
    return [];
  }
}

/**
 * Validate backup file integrity
 * Returns true if backup is valid SQLite database
 */
function validateBackupIntegrity(backupPath: string): boolean {
  try {
    // Try to open the backup file as SQLite database
    const testDb = new Database(backupPath, { readonly: true });

    // Run integrity check
    const result = testDb.pragma('integrity_check', { simple: true });
    testDb.close();

    if (result === 'ok') {
      console.log('✅ Backup integrity check passed');
      return true;
    } else {
      console.error('❌ Backup integrity check failed:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Backup validation failed:', error);
    return false;
  }
}

/**
 * Restore database from backup
 * HOT-SWAP: No server restart required!
 * WARNING: This will overwrite the current database!
 */
export function restoreBackup(backupFilename: string): void {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Step 1: Validate backup integrity
    console.log('🔍 Validating backup integrity...');
    if (!validateBackupIntegrity(backupPath)) {
      throw new Error('Backup file is corrupted or invalid');
    }

    // Step 2: Create safety backup of current database
    const safetyBackupFilename = `database-before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const safetyBackupPath = path.join(BACKUP_DIR, safetyBackupFilename);

    console.log('💾 Creating safety backup...');
    // Force checkpoint to ensure WAL is written
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, safetyBackupPath);
    console.log(`✅ Safety backup created: ${safetyBackupFilename}`);

    // Step 3: Close old database connection
    console.log('🔌 Closing database connection...');
    db.close();

    // Step 4: Replace database file
    console.log('📋 Replacing database file...');
    fs.copyFileSync(backupPath, DB_PATH);

    // Step 5: Hot-swap - reopen database connection
    console.log('🔄 Reconnecting to database...');
    reconnectDatabase();

    console.log(`✅ Database restored from: ${backupFilename}`);
    console.log('✅ HOT-SWAP complete - No server restart required!');
  } catch (error) {
    console.error('❌ Restore failed:', error);

    // Rollback: Try to restore safety backup
    try {
      console.log('⏪ Attempting rollback...');
      // Note: In production, you'd want more sophisticated rollback logic
      // Find latest safety backup and restore it
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }

    throw error;
  }
}

/**
 * Delete old backups (keep last 30)
 */
function cleanOldBackups(): void {
  try {
    const backups = listBackups();

    // Keep last 30 backups
    const backupsToDelete = backups.slice(30);

    for (const backup of backupsToDelete) {
      const filePath = path.join(BACKUP_DIR, backup.filename);
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted old backup: ${backup.filename}`);
    }
  } catch (error) {
    console.error('⚠️  Failed to clean old backups:', error);
  }
}

/**
 * Get backup statistics
 */
export function getBackupStats(): {
  totalBackups: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
  totalSize: number;
} {
  const backups = listBackups();

  return {
    totalBackups: backups.length,
    oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
    newestBackup: backups.length > 0 ? backups[0].created : null,
    totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
  };
}

/**
 * Delete a specific backup
 */
export function deleteBackup(backupFilename: string): void {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Safety check: Don't delete if it's the only backup
    const backups = listBackups();
    if (backups.length <= 1) {
      throw new Error('Cannot delete the only backup');
    }

    fs.unlinkSync(backupPath);
    console.log(`✅ Backup deleted: ${backupFilename}`);
  } catch (error) {
    console.error('❌ Failed to delete backup:', error);
    throw error;
  }
}
