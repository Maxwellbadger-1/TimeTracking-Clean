#!/usr/bin/env node
/**
 * Database Sync Script
 *
 * Syncs Production database to Development database
 * This ensures Development DB is always a recent copy of Production
 *
 * Usage:
 *   npm run db:sync              # Sync from local production.db
 *   npm run db:sync:remote       # Sync from Oracle Cloud server (SSH)
 */

import { copyFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { databaseConfig } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORACLE_HOST = '129.159.8.19';
const ORACLE_USER = 'ubuntu';
const ORACLE_KEY_PATH = path.join(__dirname, '../../../.ssh/oracle_key');
const ORACLE_DB_PATH = '/home/ubuntu/TimeTracking-Clean/server/database.db';

/**
 * Sync database from local production to development
 */
async function syncLocal(): Promise<void> {
  console.log('🔄 Syncing Production → Development (Local)...\n');

  const productionPath = databaseConfig.productionPath;
  const developmentPath = databaseConfig.developmentPath;

  if (!existsSync(productionPath)) {
    console.error(`❌ Production database not found: ${productionPath}`);
    process.exit(1);
  }

  console.log(`📁 Source:      ${productionPath}`);
  console.log(`📁 Destination: ${developmentPath}\n`);

  try {
    // Create backup of current development database
    if (existsSync(developmentPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const backupPath = developmentPath.replace('.db', `.backup.${timestamp}.db`);
      copyFileSync(developmentPath, backupPath);
      console.log(`💾 Backed up existing development DB to: ${backupPath}`);
    }

    // Copy production to development
    copyFileSync(productionPath, developmentPath);
    console.log('✅ Database synced successfully!\n');

    // Show database info
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(developmentPath, { readonly: true });

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
    const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests').get() as { count: number };

    db.close();

    console.log('📊 Database Statistics:');
    console.log(`   Users:            ${userCount.count}`);
    console.log(`   Time Entries:     ${entryCount.count}`);
    console.log(`   Absence Requests: ${absenceCount.count}\n`);

    console.log('✅ Development database is now up-to-date with Production!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

/**
 * Sync database from Oracle Cloud server (SSH)
 */
async function syncRemote(): Promise<void> {
  console.log('🔄 Syncing Production → Development (Remote via SSH)...\n');

  const developmentPath = databaseConfig.developmentPath;

  if (!existsSync(ORACLE_KEY_PATH)) {
    console.error(`❌ SSH key not found: ${ORACLE_KEY_PATH}`);
    console.error('   Please ensure .ssh/oracle_key exists in project root');
    process.exit(1);
  }

  console.log(`📡 Remote:      ${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_DB_PATH}`);
  console.log(`📁 Local:       ${developmentPath}\n`);

  try {
    // Create backup of current development database
    if (existsSync(developmentPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const backupPath = developmentPath.replace('.db', `.backup.${timestamp}.db`);
      copyFileSync(developmentPath, backupPath);
      console.log(`💾 Backed up existing development DB to: ${backupPath}`);
    }

    // Download database from Oracle Cloud via SCP
    console.log('⬇️  Downloading database from Oracle Cloud...');
    const scpCommand = `scp -i "${ORACLE_KEY_PATH}" ${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_DB_PATH} "${developmentPath}"`;

    execSync(scpCommand, {
      stdio: 'inherit',
      encoding: 'utf-8',
    });

    console.log('✅ Database downloaded successfully!\n');

    // Show database info
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(developmentPath, { readonly: true });

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
    const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests').get() as { count: number };

    db.close();

    console.log('📊 Database Statistics:');
    console.log(`   Users:            ${userCount.count}`);
    console.log(`   Time Entries:     ${entryCount.count}`);
    console.log(`   Absence Requests: ${absenceCount.count}\n`);

    console.log('✅ Development database is now up-to-date with Production (Oracle Cloud)!');
  } catch (error) {
    console.error('❌ Remote sync failed:', error);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const isRemote = args.includes('--remote') || args.includes('-r');

if (isRemote) {
  syncRemote();
} else {
  syncLocal();
}
