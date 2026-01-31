#!/usr/bin/env tsx
/**
 * Migration Script: Fix overtime_transactions Schema
 *
 * PROBLEM: overtime_transactions table has WRONG CHECK constraint
 * - Current: CHECK(type IN ('earned', 'compensation', 'correction', 'carryover'))
 * - Required: CHECK(type IN ('earned', 'compensation', 'correction', 'carryover',
 *             'vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment'))
 *
 * RESULT: All absence credit inserts fail silently!
 *
 * This script:
 * 1. Backs up existing transactions
 * 2. Drops old table
 * 3. Recreates table with correct constraint
 * 4. Restores backed up data
 * 5. Backfills ALL absence transactions for all users
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, '../../database.db');

console.log('🔧 Starting overtime_transactions schema migration...');
console.log('📂 Database:', dbPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = OFF'); // CRITICAL: Disable FK checks during migration

try {
  // Step 1: Backup existing transactions
  console.log('\n📦 Step 1: Backing up existing transactions...');

  const existingTransactions = db.prepare(`
    SELECT * FROM overtime_transactions ORDER BY id
  `).all();

  console.log(`✅ Backed up ${existingTransactions.length} transactions`);

  // Step 2: Drop old table
  console.log('\n🗑️ Step 2: Dropping old table...');
  db.prepare('DROP TABLE IF EXISTS overtime_transactions').run();
  console.log('✅ Old table dropped');

  // Step 3: Recreate table with correct constraint
  console.log('\n🏗️ Step 3: Creating new table with correct CHECK constraint...');
  db.prepare(`
    CREATE TABLE overtime_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earned', 'compensation', 'correction', 'carryover', 'vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment')),
      hours REAL NOT NULL,
      description TEXT,
      referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system')),
      referenceId INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      createdBy INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `).run();
  console.log('✅ New table created with CORRECT constraint!');

  // Step 4: Recreate indexes
  console.log('\n📊 Step 4: Recreating indexes...');
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_userId ON overtime_transactions(userId)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_date ON overtime_transactions(date)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_type ON overtime_transactions(type)
  `).run();
  console.log('✅ Indexes recreated');

  // Step 5: Restore backed up transactions
  console.log('\n♻️ Step 5: Restoring backed up transactions...');

  if (existingTransactions.length > 0) {
    const insertStmt = db.prepare(`
      INSERT INTO overtime_transactions (id, userId, date, type, hours, description, referenceType, referenceId, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((transactions: any[]) => {
      for (const tx of transactions) {
        insertStmt.run(
          tx.id,
          tx.userId,
          tx.date,
          tx.type,
          tx.hours,
          tx.description,
          tx.referenceType,
          tx.referenceId,
          tx.createdAt,
          tx.createdBy
        );
      }
    });

    insertMany(existingTransactions);
    console.log(`✅ Restored ${existingTransactions.length} transactions`);
  } else {
    console.log('ℹ️ No transactions to restore');
  }

  // Step 6: Backfill absence transactions for ALL users
  console.log('\n🔄 Step 6: Backfilling absence transactions...');
  console.log('📅 This will process ALL approved absences and create missing transactions...\n');

  // Get all users with approved absences
  const usersWithAbsences = db.prepare(`
    SELECT DISTINCT userId
    FROM absence_requests
    WHERE status = 'approved'
      AND type IN ('vacation', 'sick', 'overtime_comp', 'special', 'unpaid')
  `).all() as Array<{ userId: number }>;

  console.log(`👥 Found ${usersWithAbsences.length} users with approved absences`);

  // Get all unique months that have approved absences
  const monthsWithAbsences = db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', startDate) as month, userId
    FROM absence_requests
    WHERE status = 'approved'
      AND type IN ('vacation', 'sick', 'overtime_comp', 'special', 'unpaid')
    ORDER BY userId, month
  `).all() as Array<{ month: string; userId: number }>;

  console.log(`📆 Found ${monthsWithAbsences.length} user-month combinations to process\n`);

  // Import overtimeService to call updateMonthlyOvertime
  // This will trigger ensureAbsenceTransactionsForMonth() for each month
  const overtimeServicePath = path.join(__dirname, '../services/overtimeService.js');
  const { updateMonthlyOvertime } = await import(overtimeServicePath);

  let processedCount = 0;
  let errorCount = 0;

  for (const { userId, month } of monthsWithAbsences) {
    try {
      console.log(`⚙️ Processing userId=${userId}, month=${month}...`);
      updateMonthlyOvertime(userId, month);
      processedCount++;
      console.log(`   ✅ Success (${processedCount}/${monthsWithAbsences.length})`);
    } catch (error: any) {
      errorCount++;
      console.error(`   ❌ Error for userId=${userId}, month=${month}:`, error.message);
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   • Processed: ${processedCount} user-months`);
  console.log(`   • Errors: ${errorCount}`);

  // Step 7: Verify results
  console.log('\n🔍 Step 7: Verifying results...');

  const finalTransactionCount = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
  `).get() as { count: number };

  const absenceTransactionCount = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
    WHERE type IN ('vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment')
  `).get() as { count: number };

  console.log(`\n📊 Final Statistics:`);
  console.log(`   • Total transactions: ${finalTransactionCount.count}`);
  console.log(`   • Absence transactions: ${absenceTransactionCount.count}`);
  console.log(`   • Before migration: ${existingTransactions.length}`);
  console.log(`   • New transactions created: ${finalTransactionCount.count - existingTransactions.length}`);

  // Show sample absence transactions
  console.log('\n📋 Sample Absence Transactions:');
  const sampleTransactions = db.prepare(`
    SELECT userId, date, type, hours, description
    FROM overtime_transactions
    WHERE type IN ('vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment')
    ORDER BY date DESC
    LIMIT 5
  `).all();

  if (sampleTransactions.length > 0) {
    console.table(sampleTransactions);
  } else {
    console.log('   ⚠️ No absence transactions found - this might indicate an issue!');
  }

  console.log('\n✅ Migration completed successfully!\n');

} catch (error: any) {
  console.error('\n❌ Migration failed:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
} finally {
  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');
  db.close();
  console.log('🔒 Foreign keys re-enabled');
  console.log('📁 Database closed');
}
