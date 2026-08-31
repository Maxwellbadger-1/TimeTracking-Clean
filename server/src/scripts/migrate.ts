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
//
// CR-03: Gegen production.db darf dieses Skript NUR bei gestopptem Serverprozess laufen.
// Es oeffnet eine eigene Verbindung (new Database(dbPath), :135) und schliesst sie am Ende
// selbst (db.close() im finally, :172). SQLite raeumt dabei WAL und SHM auf, sobald es kurz
// die exklusive Sperre bekommt - bei laufendem Server haengt das dessen WAL ab
// (.planning/debug/wal-abgehaengt-20260827.md). Die Deploy-Workflows rufen dieses Skript
// deshalb seit CR-03 erst nach "pm2 stop"/"pm2 delete" auf.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { databaseConfig } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

// D-09/T-09.1-11: server/src/database/migrations/ existiert (21 .ts-Dateien) und liegt genau
// eine Ebene neben dem hier korrigierten Pfad. Zeigte MIGRATIONS_DIR versehentlich dorthin,
// faende der .sql-Filter unten null Dateien und der Lauf meldete "keine ausstehenden
// Migrationen" - ein stiller Ausfall gegen die Produktionsdatenbank. Ein leerer oder fehlender
// Migrationsordner ist in diesem Projekt immer ein Fehler, nie ein gueltiger Zustand.
if (!existsSync(MIGRATIONS_DIR) || readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).length === 0) {
  console.error(`❌ FATAL: Migrationsordner leer oder nicht gefunden: ${MIGRATIONS_DIR}`);
  console.error('   Erwartet werden .sql-Dateien unter server/database/migrations.');
  process.exit(1);
}

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
  // DATABASE_PATH hat Vorrang, genau wie in getDatabasePath() - databaseConfig.productionPath
  // und .developmentPath zeigen fest auf server/database.db bzw.
  // server/database/development.db und setzten bisher den Symlink server/database.db ->
  // production.db voraus (entfernt am 20.08.2026, siehe
  // .planning/debug/db-stabilisierung-20260818.md). Ohne diese Aenderung oeffnete
  // migrate:prod auf dem Deploy-Server eine frische, leere server/database.db statt der
  // Produktionsdatenbank.
  const dbPath = process.env.DATABASE_PATH
    ? process.env.DATABASE_PATH
    : isProduction
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
    // WR-07 (09.1-REVIEW.md): das Fehlerobjekt wurde bisher nie ausgegeben - Fehler aus
    // initMigrationsTable()/getAppliedMigrations() (z.B. SQLITE_BUSY, siehe WR-01, oder ein
    // korruptes Schema) verschwanden spurlos, genau im Deploy-Protokoll, wo man sie braucht.
    console.error('\n❌ Migration failed! Database may be in an inconsistent state.');
    console.error('   Please review the error and fix the migration file.\n');
    console.error(error);
    // WR-07: Close-Verhalten in Erfolgs- und Fehlerpfad vereinheitlicht. Vorher beendete
    // process.exit(1) im try-Block den Prozess, bevor das finally { db.close() } lief - der
    // Fehlerpfad schloss die Verbindung also nie, ohne dass das beabsichtigt war.
    //
    // Ein Close ist hier - anders als in fixOvertime.ts (CR-02) - richtig: migrate.ts laeuft
    // seit CR-03 im Deploy ausschliesslich hinter "pm2 stop"/"pm2 delete", also ohne
    // konkurrierenden Serverprozess auf derselben Datei. sqlite3_close raeumt WAL/SHM dort
    // gefahrlos auf, weil kein zweiter Prozess dieselben Dateizeiger haelt.
    db.close();
    process.exit(1);
  } finally {
    // Erfolgsfall: hier laeuft der Code nur durch, wenn der try-Block ohne process.exit()
    // im catch-Zweig durchlief (also nie nach dem Fehlerpfad oben).
    if (db.open) db.close();
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
