import { ensureOvertimeBalanceEntries } from './src/services/overtimeService.js';
import Database from 'better-sqlite3';

const db = new Database('./database/development.db');

console.log('=== BEFORE ensureOvertimeBalanceEntries ===');
const before = db.prepare('SELECT month, targetHours, actualHours, overtime FROM overtime_balance WHERE userId = 155 AND month = ?').get('2025-12');
console.log('Dec 2025:', before);

console.log('\n=== RUNNING ensureOvertimeBalanceEntries ===');
ensureOvertimeBalanceEntries(155, '2025-12');

console.log('\n=== AFTER ensureOvertimeBalanceEntries ===');
const after = db.prepare('SELECT month, targetHours, actualHours, overtime FROM overtime_balance WHERE userId = 155 AND month = ?').get('2025-12');
console.log('Dec 2025:', after);

db.close();
