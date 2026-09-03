import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import db, { reconnectDatabase } from '../database/connection.js';
import { databaseConfig } from '../config/database.js';
import { formatDate } from '../utils/timezone.js';

// Backup directory (outside server folder)
const BACKUP_DIR = path.join(process.cwd(), '../backups');
// Use the correct database path based on environment (development vs production)
const DB_PATH = databaseConfig.path;

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
 * Ein vom Client gelieferter Backup-Dateiname ist unbrauchbar.
 * Eigene Klasse, damit die Routen 400 statt 500 antworten können.
 */
export class InvalidBackupFilenameError extends Error {
  constructor(filename: string) {
    super(`Ungültiger Backup-Dateiname: ${filename}`);
    this.name = 'InvalidBackupFilenameError';
  }
}

/**
 * Löst einen Backup-Dateinamen zu einem Pfad im Backup-Verzeichnis auf — und nur dorthin.
 *
 * WARUM: Alle drei Backup-Routen (Download, Restore, Delete) reichen `req.params.filename`
 * durch. Ein blankes `path.join(BACKUP_DIR, filename)` verlässt bei `../` das Verzeichnis;
 * `/api/backup/download/..%2f..%2fdatabases%2fproduction.db` hätte die Produktionsdatenbank
 * ausgeliefert, und `DELETE` steht direkt vor einem `fs.unlinkSync`. Die bisherige, als
 * "Security check" kommentierte Prüfung testete nur Existenz, nicht Lage.
 *
 * Drei Schranken, jede für sich ausreichend:
 *   1. Der Name muss sein eigener Basename sein — schließt Trennzeichen und `..` aus.
 *   2. Endung `.db` — Begleitdateien (`-shm`/`-wal`) und alles andere sind kein Ziel.
 *   3. Der aufgelöste Pfad muss unterhalb von BACKUP_DIR liegen (Gürtel und Hosenträger,
 *      fängt auch Symlink-freie Sonderfälle wie `C:` unter Windows ab).
 *
 * Siehe `.planning/debug/backup-download-name-format.md`.
 */
function resolveBackupPath(filename: string): string {
  if (!filename || path.basename(filename) !== filename) {
    throw new InvalidBackupFilenameError(filename);
  }

  if (!filename.endsWith('.db')) {
    throw new InvalidBackupFilenameError(filename);
  }

  const resolvedDir = path.resolve(BACKUP_DIR);
  const resolvedPath = path.resolve(resolvedDir, filename);

  if (resolvedPath !== path.join(resolvedDir, filename)) {
    throw new InvalidBackupFilenameError(filename);
  }

  return resolvedPath;
}

/**
 * Zeitstempel für Backup-Dateinamen in deutscher Ortszeit (Europe/Berlin).
 *
 * WARUM NICHT `toISOString()`: Das liefert UTC. Die Backup-Liste in der App zeigt den
 * Erstellzeitpunkt dagegen über `toLocaleString('de-DE')` in Ortszeit
 * (`desktop/src/pages/BackupPage.tsx`, Spalte „Erstellt am"). Ein und dasselbe Backup
 * trug dadurch zwei verschiedene Zeiten — bei MESZ zwei Stunden auseinander — und ein
 * Backup zwischen 00:00 und 02:00 Berliner Zeit bekam sogar den Vortag in den Namen.
 * Genau an dieser Grenze feuert der nächtliche Cron (02:00, `cronService.ts`).
 * `toISOString()` zur Datumsbildung ist in `.claude/CLAUDE.md` ausdrücklich verboten.
 *
 * Format: `2026-09-03_08-14-22` — sortierbar, ohne für Windows verbotene Zeichen.
 * Siehe `.planning/debug/backup-download-name-format.md`.
 */
function backupTimestamp(): string {
  return formatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss');
}

/**
 * Erzeugt einen im Backup-Verzeichnis noch nicht vergebenen Dateipfad.
 *
 * Der Zeitstempel löst auf Sekunden auf (vorher: Millisekunden). Zwei Backups in
 * derselben Sekunde — etwa der Cronlauf und ein gleichzeitiger Klick auf „Jetzt Backup
 * erstellen" — bekämen sonst denselben Namen, und `fs.copyFileSync` überschriebe das
 * erste stillschweigend. Bei Kollision wird `-2`, `-3`, … angehängt.
 */
function uniqueBackupPath(baseName: string): string {
  let candidate = path.join(BACKUP_DIR, `${baseName}.db`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(BACKUP_DIR, `${baseName}-${counter}.db`);
    counter++;
  }
  return candidate;
}

/**
 * Create database backup
 * Returns: backup file path
 */
export function createBackup(): string {
  try {
    ensureBackupDir();

    // Dateiname mit Zeitstempel in deutscher Ortszeit (siehe backupTimestamp)
    const backupPath = uniqueBackupPath(`database-backup-${backupTimestamp()}`);
    const backupFilename = path.basename(backupPath);

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
    const backupPath = resolveBackupPath(backupFilename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Step 1: Validate backup integrity
    console.log('🔍 Validating backup integrity...');
    if (!validateBackupIntegrity(backupPath)) {
      throw new Error('Backup file is corrupted or invalid');
    }

    // Step 2: Create safety backup of current database
    // Zeitstempel wie beim regulären Backup in deutscher Ortszeit, damit beide
    // Dateisorten im selben Verzeichnis dieselbe Zeitbasis haben.
    const safetyBackupPath = uniqueBackupPath(`database-before-restore-${backupTimestamp()}`);
    const safetyBackupFilename = path.basename(safetyBackupPath);

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
 * Get full path to a backup file
 * @param filename Backup filename
 * @returns Full path to backup file
 */
export function getBackupPath(filename: string): string {
  return resolveBackupPath(filename);
}

/**
 * Delete a specific backup
 */
export function deleteBackup(backupFilename: string): void {
  try {
    const backupPath = resolveBackupPath(backupFilename);

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
