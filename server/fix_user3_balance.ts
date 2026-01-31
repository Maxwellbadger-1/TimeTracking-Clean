import { updateMonthlyOvertime } from './src/services/overtimeService.js';
import { db } from './src/database/connection.js';

console.log('🔄 Recalculating overtime_balance for User 3, January 2026...');

// Check before
const before = db.prepare(`
  SELECT userId, month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = 3 AND month = '2026-01'
`).get();

console.log('\n📊 BEFORE:', before);

// Recalculate
updateMonthlyOvertime(3, '2026-01');

// Check after
const after = db.prepare(`
  SELECT userId, month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = 3 AND month = '2026-01'
`).get();

console.log('📊 AFTER:', after);

const diff = (after as any).overtime - (before as any).overtime;
console.log(`\n✅ Change: ${diff > 0 ? '+' : ''}${diff}h`);

process.exit(0);
