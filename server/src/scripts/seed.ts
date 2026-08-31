#!/usr/bin/env node
/**
 * Database Seeder Script
 *
 * Loads test data into development database
 * SAFETY: Only runs in development environment!
 *
 * Usage:
 *   npm run seed              # Run all seeders
 *   npm run seed:reset        # Clear data and re-seed
 */

import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { databaseConfig } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEDS_DIR = path.join(__dirname, '../../database/seeds');

/**
 * Safety check - only allow seeding in development
 */
function checkEnvironment(): void {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    console.error('');
    console.error('❌ FATAL ERROR: Cannot run seeders in production!');
    console.error('   Seeders are for development testing only.');
    console.error('   Current NODE_ENV: production');
    console.error('');
    process.exit(1);
  }

  console.log(`\n✅ Environment: ${env} (safe for seeding)\n`);
}

/**
 * Get list of seed files
 */
function getSeedFiles(): string[] {
  try {
    const files = readdirSync(SEEDS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Alphabetical order

    return files;
  } catch (error) {
    console.warn('⚠️  No seeds directory found');
    return [];
  }
}

/**
 * Run a seed file
 */
function runSeed(db: Database.Database, filename: string): void {
  const filePath = path.join(SEEDS_DIR, filename);
  const sql = readFileSync(filePath, 'utf-8');

  console.log(`🌱 Running seed: ${filename}`);

  try {
    // Run seed in a transaction
    db.transaction(() => {
      db.exec(sql);
    })();

    console.log(`✅ Seed completed: ${filename}\n`);
  } catch (error) {
    console.error(`❌ Seed failed: ${filename}`);
    console.error(error);
    throw error;
  }
}

/**
 * Clear existing test data (reset mode)
 */
function clearTestData(db: Database.Database): void {
  console.log('🗑️  Clearing existing test data...\n');

  try {
    db.transaction(() => {
      // Delete test users and cascade
      // Note: User ID 15 ("Test") is our primary test user
      db.exec(`
        -- Delete time entries for test users
        DELETE FROM time_entries WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );

        -- Delete absence requests for test users
        DELETE FROM absence_requests WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );

        -- Delete vacation balance for test users
        DELETE FROM vacation_balance WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );

        -- Delete overtime balance for test users
        DELETE FROM overtime_balance WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );

        -- Delete notifications for test users
        DELETE FROM notifications WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );

        -- Delete audit logs for test users
        DELETE FROM audit_log WHERE userId IN (
          SELECT id FROM users WHERE email LIKE '%@test.com'
        );
      `);
    })();

    console.log('✅ Test data cleared\n');
  } catch (error) {
    console.error('❌ Failed to clear test data');
    console.error(error);
    throw error;
  }
}

/**
 * Run all seed files
 */
function runSeeders(reset: boolean = false): void {
  // Safety check
  checkEnvironment();

  const dbPath = databaseConfig.developmentPath;

  console.log('🌱 Running seeders on development database');
  console.log(`📁 Database: ${dbPath}\n`);

  const db = new Database(dbPath);

  try {
    // Clear existing test data if reset mode
    if (reset) {
      clearTestData(db);
    }

    // Get seed files
    const seedFiles = getSeedFiles();

    if (seedFiles.length === 0) {
      console.log('⚠️  No seed files found in database/seeds/');
      console.log('   Create seed files (e.g., 001_test_users.sql) to get started.\n');
      return;
    }

    console.log(`📋 Found ${seedFiles.length} seed file(s):\n`);
    seedFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    console.log('');

    // Run each seed
    seedFiles.forEach(file => {
      runSeed(db, file);
    });

    console.log(`✅ All seeds completed successfully! (${seedFiles.length} total)\n`);

    // Show summary statistics
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
    const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests').get() as { count: number };

    console.log('📊 Database Statistics:');
    console.log(`   Users:            ${userCount.count}`);
    console.log(`   Time Entries:     ${entryCount.count}`);
    console.log(`   Absence Requests: ${absenceCount.count}\n`);
  } catch (error) {
    // WR-07 (09.1-REVIEW.md): das Fehlerobjekt wurde bisher nie ausgegeben - Fehler beim
    // Anwenden eines Seed-Files verschwanden spurlos statt im Protokoll zu landen.
    console.error('\n❌ Seeding failed!');
    console.error('   Please review the error and fix the seed file.\n');
    console.error(error);
    // WR-07: Close-Verhalten in Erfolgs- und Fehlerpfad vereinheitlicht. Vorher beendete
    // process.exit(1) im try-Block den Prozess, bevor das finally { db.close() } lief - der
    // Fehlerpfad schloss die Verbindung also nie, ohne dass das beabsichtigt war.
    //
    // Ein Close ist hier - anders als in fixOvertime.ts (CR-02) - richtig: seed.ts laeuft nur
    // gegen die lokale Entwicklungsdatenbank (checkEnvironment() oben verweigert
    // NODE_ENV=production), also ohne konkurrierenden Serverprozess auf derselben Datei.
    // sqlite3_close raeumt WAL/SHM dort gefahrlos auf.
    db.close();
    process.exit(1);
  } finally {
    // Erfolgsfall: hier laeuft der Code nur durch, wenn der try-Block ohne process.exit()
    // im catch-Zweig durchlief (also nie nach dem Fehlerpfad oben).
    if (db.open) db.close();
  }
}

// Main
const args = process.argv.slice(2);
const reset = args.includes('--reset') || args.includes('-r');

runSeeders(reset);
