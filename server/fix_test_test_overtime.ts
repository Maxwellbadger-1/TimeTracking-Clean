#!/usr/bin/env tsx
import { updateMonthlyOvertime } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

console.log('🔧 FIX: Recalculating overtime for Test Test (User 15)');
console.log('   Issue: overtime_balance missing +20h corrections\n');

const db = new Database('./database/development.db');

// Check current state
console.log('📊 BEFORE recalculation:');
const before = db.prepare(`
  SELECT * FROM overtime_balance WHERE userId = 15 AND month = '2026-01'
`).get() as any;

console.log(`   Target Hours: ${before.targetHours}h`);
console.log(`   Actual Hours: ${before.actualHours}h`);
console.log(`   Overtime: ${before.overtime}h`);
console.log('   ❌ Missing +20h corrections!\n');

// Verify corrections exist
const corrections = db.prepare(`
  SELECT COALESCE(SUM(hours), 0) as total
  FROM overtime_corrections
  WHERE userId = 15 AND strftime('%Y-%m', date) = '2026-01'
`).get() as any;

console.log('🔍 Corrections in database:');
console.log(`   Total: ${corrections.total}h (should be included in actualHours)\n`);

// Trigger recalculation
console.log('🔄 Triggering updateMonthlyOvertime(15, "2026-01")...');

try {
  updateMonthlyOvertime(15, '2026-01');
  console.log('✅ Recalculation completed!\n');

  // Check result
  console.log('📊 AFTER recalculation:');
  const after = db.prepare(`
    SELECT * FROM overtime_balance WHERE userId = 15 AND month = '2026-01'
  `).get() as any;

  console.log(`   Target Hours: ${after.targetHours}h`);
  console.log(`   Actual Hours: ${after.actualHours}h`);
  console.log(`   Overtime: ${after.overtime}h\n`);

  // Verify fix
  const expectedActual = 88.5; // 52.5h worked + 16h vacation credit + 20h corrections
  const expectedOvertime = 12.5; // 88.5h - 76h

  if (Math.abs(after.actualHours - expectedActual) < 0.01 &&
      Math.abs(after.overtime - expectedOvertime) < 0.01) {
    console.log('🎉 ========== SUCCESS! ==========');
    console.log('✅ actualHours corrected: 68.5h → 88.5h (+20h)');
    console.log('✅ overtime corrected: -7.5h → +12.5h');
    console.log('✅ Corrections now included in calculation!');
    console.log('✅ Frontend should now show +12:30 Std\n');
  } else {
    console.log('❌ ========== UNEXPECTED RESULT! ==========');
    console.log(`Expected actualHours: ${expectedActual}h, got ${after.actualHours}h`);
    console.log(`Expected overtime: ${expectedOvertime}h, got ${after.overtime}h`);
    console.log('⚠️  Manual investigation needed!\n');
  }

} catch (error) {
  console.error('❌ ========== ERROR! ==========');
  console.error('Failed to recalculate overtime:', error);
  process.exit(1);
} finally {
  db.close();
}
