#!/usr/bin/env node
/**
 * Database Migration Script
 * Adds missing columns to production database safely
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || '/home/ubuntu/database.db';

console.log('🔄 Starting database migration...');
console.log('📁 Database path:', DB_PATH);

const db = new Database(DB_PATH);

// Begin transaction for atomicity
db.exec('BEGIN TRANSACTION');

try {
  // Migration: Add missing columns to users table
  const migrations = [
    {
      name: 'Add hireDate column',
      sql: 'ALTER TABLE users ADD COLUMN hireDate TEXT'
    },
    {
      name: 'Add privacyConsentAt column',
      sql: 'ALTER TABLE users ADD COLUMN privacyConsentAt TEXT'
    },
    {
      name: 'Add emailVerified column',
      sql: 'ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0'
    }
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const migration of migrations) {
    try {
      db.exec(migration.sql);
      console.log(`✅ ${migration.name}`);
      successCount++;
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log(`⏭️  ${migration.name} (already exists)`);
        skipCount++;
      } else {
        throw new Error(`Failed: ${migration.name} - ${err.message}`);
      }
    }
  }

  // Commit transaction
  db.exec('COMMIT');

  console.log('');
  console.log('✅ Migration completed successfully!');
  console.log(`   Applied: ${successCount} migrations`);
  console.log(`   Skipped: ${skipCount} migrations`);
  console.log('');

  // Verify schema
  const userRow = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (userRow) {
    const hasNewColumns = 'hireDate' in userRow && 'privacyConsentAt' in userRow;
    if (hasNewColumns) {
      console.log('✅ Schema verification passed!');
    } else {
      console.error('❌ Schema verification failed - columns not found');
      process.exit(1);
    }
  }

} catch (error) {
  // Rollback on error
  db.exec('ROLLBACK');
  console.error('');
  console.error('❌ Migration failed:', error.message);
  console.error('   Transaction rolled back');
  console.error('');
  process.exit(1);
} finally {
  db.close();
}

console.log('🎉 Migration complete - database is ready!');
