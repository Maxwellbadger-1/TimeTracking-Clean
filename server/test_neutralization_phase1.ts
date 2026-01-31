#!/usr/bin/env tsx
import { updateMonthlyOvertime } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

console.log('🧪 Testing Phase 1 Neutralization - Absence ID 16 (5 days, 15-21.12.2025)\n');

const db = new Database('./database/development.db');
const userId = 15;
const month = '2025-12';

// Step 1: Count transactions BEFORE recalculation
const before = db.prepare(`
  SELECT * FROM overtime_transactions  
  WHERE userId = ? AND type IN ('earned', 'vacation_credit')
    AND date LIKE ?
  ORDER BY date, type
`).all(userId, month + '%');

console.log(`📊 Transactions BEFORE recalculation (userId=${userId}, month=${month}):`);
console.log(`   Total: ${before.length}`);
console.table(before.map(t => ({ date: (t as any).date, type: (t as any).type, hours: (t as any).hours })));

// Step 2: Trigger recalculation with NEW Phase 1 logic
console.log('\n🔄 Triggering overtime recalculation with Phase 1 neutralization...\n');

try {
  updateMonthlyOvertime(userId, month);
  console.log('✅ Overtime recalculation completed!\n');
  
  // Step 3: Count transactions AFTER recalculation
  const after = db.prepare(`
    SELECT * FROM overtime_transactions  
    WHERE userId = ? AND type IN ('earned', 'vacation_credit')
      AND date LIKE ?
    ORDER BY date, type
  `).all(userId, month + '%');

  console.log(`📊 Transactions AFTER recalculation (userId=${userId}, month=${month}):`);
  console.log(`   Total: ${after.length}`);
  console.table(after.map(t => ({ date: (t as any).date, type: (t as any).type, hours: (t as any).hours, description: (t as any).description })));

  // Step 4: Verify neutralization
  console.log('\n🎯 NEUTRALIZATION VERIFICATION:\n');
  
  // Group by date and check if earned + vacation_credit = 0
  const byDate = new Map();
  after.forEach((t: any) => {
    if (!byDate.has(t.date)) {
      byDate.set(t.date, { earned: 0, vacation_credit: 0 });
    }
    const day = byDate.get(t.date);
    if (t.type === 'earned') day.earned += t.hours;
    if (t.type === 'vacation_credit') day.vacation_credit += t.hours;
  });

  let allNeutralized = true;
  byDate.forEach((totals, date) => {
    const sum = totals.earned + totals.vacation_credit;
    const isNeutralized = Math.abs(sum) < 0.01; // Allow floating point tolerance
    
    console.log(`   ${date}: earned=${totals.earned.toFixed(2)}h, vacation_credit=${totals.vacation_credit.toFixed(2)}h, NET=${sum.toFixed(2)}h ${isNeutralized ? '✅ NEUTRALIZED' : '❌ NOT NEUTRALIZED'}`);
    
    if (!isNeutralized) allNeutralized = false;
  });

  if (allNeutralized) {
    console.log('\n✅ ✅ ✅ SUCCESS! All vacation days are NEUTRALIZED (0h net) ✅ ✅ ✅');
    console.log('🎉 Phase 1 implementation works correctly!\n');
  } else {
    console.log('\n❌ ❌ ❌ FAILURE! Some days are NOT neutralized ❌ ❌ ❌');
    console.log('🐛 Check the implementation - expected all vacation days to show 0h net.\n');
  }

} catch (error) {
  console.error('❌ Error during recalculation:', error);
}

db.close();
