#!/usr/bin/env node
/**
 * Database Migration Script
 *
 * Runs SQL migration files in order
 * Tracks which migrations have been applied
 *
 * Usage:
 *   npm run migrate              # Run migrations on development DB
 *   npm run migrate:prod         # Run migrations on production DB
 *   npm run migrate:create       # Create a new migration file
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { databaseConfig } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

interface Migration {
  id: number;
  name: string;
  appliedAt: string;
}

/**
 * Initialize migrations table
 */
function initMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      appliedAt TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Get list of migration files
 */
function getMigrationFiles(): string[] {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Alphabetical order ensures numbered files run in sequence

    return files;
  } catch (error) {
    console.warn('⚠️  No migrations directory found, creating it...');
    return [];
  }
}

/**
 * Get applied migrations from database
 */
function getAppliedMigrations(db: Database.Database): string[] {
  const migrations = db.prepare('SELECT name FROM migrations ORDER BY id').all() as Migration[];
  return migrations.map(m => m.name);
}

/**
 * Apply a migration
 */
function applyMigration(db: Database.Database, filename: string): void {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filePath, 'utf-8');

  console.log(`🔄 Running migration: ${filename}`);

  try {
    // Run migration in a transaction
    db.transaction(() => {
      // Execute the SQL
      db.exec(sql);

      // Record in migrations table
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(filename);
    })();

    console.log(`✅ Migration applied: ${filename}\n`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
function runMigrations(isProduction: boolean = false): void {
  const dbPath = isProduction
    ? databaseConfig.productionPath
    : databaseConfig.developmentPath;

  const env = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';

  console.log(`\n🗄️  Running migrations on ${env} database`);
  console.log(`📁 Database: ${dbPath}\n`);

  const db = new Database(dbPath);

  try {
    // Initialize migrations table
    initMigrationsTable(db);

    // Get migration files and applied migrations
    const allMigrations = getMigrationFiles();
    const appliedMigrations = getAppliedMigrations(db);

    // Find pending migrations
    const pendingMigrations = allMigrations.filter(
      file => !appliedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations - database is up to date!\n');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);
    pendingMigrations.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    console.log('');

    // Apply each migration
    pendingMigrations.forEach(file => {
      applyMigration(db, file);
    });

    console.log(`✅ All migrations applied successfully! (${pendingMigrations.length}/${allMigrations.length} total)\n`);
  } catch (error) {
    console.error('\n❌ Migration failed! Database may be in an inconsistent state.');
    console.error('   Please review the error and fix the migration file.\n');
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * Create a new migration file
 */
function createMigration(name: string): void {
  if (!name) {
    console.error('❌ Please provide a migration name');
    console.error('   Usage: npm run migrate:create <name>');
    console.error('   Example: npm run migrate:create add_team_calendar\n');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `${timestamp}_${name.replace(/\s+/g, '_')}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL here
-- Example:
-- ALTER TABLE users ADD COLUMN newField TEXT;

-- Remember:
-- - Keep migrations small and focused
-- - Test on development first
-- - Migrations should be idempotent when possible
`;

  writeFileSync(filePath, template, 'utf-8');

  console.log(`✅ Migration created: ${filename}`);
  console.log(`📁 Path: ${filePath}\n`);
  console.log('💡 Edit the file and add your SQL, then run:');
  console.log('   npm run migrate\n');
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (command === 'create') {
  const name = args.slice(1).join(' ');
  createMigration(name);
} else if (command === 'prod' || command === 'production') {
  // Check if running in CI/CD environment (skip warning)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  if (isCI) {
    console.log('\n🤖 Running migrations in CI/CD mode (production database)\n');
    runMigrations(true);
  } else {
    console.warn('\n⚠️  WARNING: Running migrations on PRODUCTION database!');
    console.warn('   Press Ctrl+C within 5 seconds to cancel...\n');

    setTimeout(() => {
      runMigrations(true);
    }, 5000);
  }
} else {
  runMigrations(false);
}
