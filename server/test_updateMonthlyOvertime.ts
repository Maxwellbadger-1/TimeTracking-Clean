import { updateMonthlyOvertime } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

const db = new Database('./database/development.db');

console.log('BEFORE UPDATE:');
const before = db.prepare('SELECT targetHours, actualHours, overtime FROM overtime_balance WHERE userId = 155 AND month = "2026-01"').get();
console.log(before);

console.log('\nUPDATING...');
try {
  updateMonthlyOvertime(155, '2026-01');
  console.log('✅ Update successful');
} catch (error) {
  console.error('❌ Update failed:', error);
}

console.log('\nAFTER UPDATE:');
const after = db.prepare('SELECT targetHours, actualHours, overtime FROM overtime_balance WHERE userId = 155 AND month = "2026-01"').get();
console.log(after);

console.log('\nCOMPARISON:');
console.log(`Target: ${before.targetHours}h → ${after.targetHours}h ${after.targetHours === 92 ? '✅ CORRECT!' : '❌ STILL WRONG!'}`);

db.close();
