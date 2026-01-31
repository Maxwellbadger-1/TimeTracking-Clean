import { getDb } from './src/database/index.js';
import { updateMonthlyOvertime } from './src/services/overtimeService.js';

const db = getDb();

console.log('🔄 Recalculating overtime for User 3 (MaximilianFegg2)...');

// Recalculate January 2026
updateMonthlyOvertime(3, '2026-01');

console.log('✅ Done!');

// Check result
const result = db.prepare(`
  SELECT month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = 3 AND month = '2026-01'
`).get();

console.log('\n📊 Result:');
console.log(JSON.stringify(result, null, 2));
