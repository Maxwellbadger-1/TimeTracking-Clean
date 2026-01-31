#!/usr/bin/env tsx
import { updateMonthlyOvertime } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

console.log('🧪 Testing Absence ID 42 REJECTION - the critical test!\n');

const db = new Database('./database/development.db');

// Step 1: Change status to rejected in DB
console.log('📝 Step 1: Setting absence status to REJECTED...');
db.prepare(`
  UPDATE absence_requests
  SET status = 'rejected', approvedBy = 1, approvedAt = datetime('now'), adminNote = 'Test rejection'
  WHERE id = 42
`).run();

const absence = db.prepare('SELECT * FROM absence_requests WHERE id = 42').get();
console.log(`✅ Absence ID 42 status: ${(absence as any).status}\n`);

// Step 2: Count transactions BEFORE recalculation
const transactionsBefore = db.prepare(`
  SELECT COUNT(*) as count FROM overtime_transactions
  WHERE userId = 15 AND referenceId = 42
`).get() as { count: number };

console.log(`📊 Transactions BEFORE recalculation: ${transactionsBefore.count}`);

// Step 3: Trigger overtime recalculation (this should DELETE the transactions!)
console.log('\n🔄 Step 2: Triggering overtime recalculation...');
console.log('⚠️  This is the CRITICAL moment - transactions should be DELETED!\n');

const userId = 15;
const month = '2026-01';

try {
  updateMonthlyOvertime(userId, month);
  console.log('✅ Overtime recalculation completed!\n');

  // Step 4: Count transactions AFTER recalculation
  const transactionsAfter = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
    WHERE userId = 15 AND referenceId = 42
  `).get() as { count: number };

  console.log(`📊 Transactions AFTER recalculation: ${transactionsAfter.count}`);
  console.log(`🗑️  Transactions DELETED: ${transactionsBefore.count - transactionsAfter.count}\n`);

  if (transactionsAfter.count === 0) {
    console.log('✅ ✅ ✅ SUCCESS! All transactions were deleted! ✅ ✅ ✅');
    console.log('🎉 THE FIX WORKS! Rejecting approved absences now correctly removes transactions!\n');
  } else {
    console.log('❌ ❌ ❌ FAILURE! Transactions still exist! ❌ ❌ ❌');
    console.log('🐛 The bug is still there - transactions were not deleted.\n');

    // Show the remaining transactions
    const remaining = db.prepare(`
      SELECT * FROM overtime_transactions
      WHERE userId = 15 AND referenceId = 42
    `).all();
    console.log('Remaining transactions:');
    console.table(remaining);
  }

} catch (error) {
  console.error('❌ Error during recalculation:', error);
}

db.close();
