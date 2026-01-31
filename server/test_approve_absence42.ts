#!/usr/bin/env tsx
import { updateMonthlyOvertime } from './src/services/overtimeService.js';

console.log('🧪 Testing Absence ID 42 approval - triggering overtime recalculation...\n');

// Absence 42: userId=15, dates=20-21.01.2026 (Januar 2026)
const userId = 15;
const month = '2026-01';

console.log(`📅 Recalculating overtime for userId=${userId}, month=${month}...`);

try {
  updateMonthlyOvertime(userId, month);
  console.log('✅ Overtime recalculation completed successfully!\n');

  // Now check if transactions were created
  const Database = await import('better-sqlite3');
  const db = new Database.default('./database/development.db');

  const transactions = db.prepare(`
    SELECT * FROM overtime_transactions
    WHERE userId = ? AND referenceId = 42
    ORDER BY date
  `).all(userId);

  console.log(`📊 Found ${transactions.length} transactions for Absence ID 42:`);
  console.table(transactions);

  db.close();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
