import { ensureOvertimeBalanceEntries } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

const db = new Database('./database/development.db');

console.log('BEFORE:');
const before = db.prepare("SELECT targetHours, actualHours FROM overtime_balance WHERE userId = 155 AND month = '2026-01'").get();
console.log(before);

// Delete entry
db.prepare("DELETE FROM overtime_balance WHERE userId = 155 AND month = '2026-01'").run();
console.log('\nDELETED entry for 2026-01');

console.log('\nRUNNING ensureOvertimeBalanceEntries(155, "2026-01")...');
ensureOvertimeBalanceEntries(155, '2026-01');

console.log('\nAFTER:');
const after = db.prepare("SELECT targetHours, actualHours FROM overtime_balance WHERE userId = 155 AND month = '2026-01'").get();
console.log(after);

console.log('\n' + '='.repeat(50));
console.log(`Result: ${after.targetHours}h`);
console.log(`Expected: 98h (Jan 1-21, 2026)`);
console.log(`Match: ${after.targetHours === 98 ? '✅ YES' : '❌ NO'}`);
console.log('='.repeat(50));

db.close();
