import { db } from './src/database/connection.js';
import { updateAllOvertimeLevels } from './src/services/overtimeService.js';
import { getOvertimeBalance } from './src/services/overtimeTransactionService.js';

// Get Silvia Test user ID
const user = db.prepare('SELECT id FROM users WHERE firstName = ? AND lastName = ?')
  .get('Silvia', 'Test') as { id: number };

console.log('\n=== Calculating Overtime for Silvia Test (User ID:', user.id, ') ===\n');

// Get all dates with time entries
const dates = db.prepare('SELECT DISTINCT date FROM time_entries WHERE userId = ? ORDER BY date')
  .all(user.id) as Array<{ date: string }>;

console.log('Dates with time entries:', dates.map(d => d.date).join(', '));

// Update overtime for each date
for (const { date } of dates) {
  console.log(`\nProcessing ` + date + '...');
  updateAllOvertimeLevels(user.id, date);
}

// Also process dates without time entries but within work range (01.01 - 14.01)
const allDates = [
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-01-08', '2026-01-09', '2026-01-10',
  '2026-01-13', '2026-01-14'
];

for (const date of allDates) {
  if (!dates.find(d => d.date === date)) {
    console.log(`\nProcessing ` + date + ' (no time entry)...');
    updateAllOvertimeLevels(user.id, date);
  }
}

// Get final balance
const balance = getOvertimeBalance(user.id);
console.log('\n=== FINAL OVERTIME BALANCE ===');
console.log('Balance: ' + (balance > 0 ? '+' : '') + balance.toFixed(2) + 'h');
console.log('Expected: -1.00h (from user calculation)');
console.log('Match: ' + (Math.abs(balance - (-1.0)) < 0.01 ? 'YES ✅' : 'NO ❌'));

// Show all transactions
console.log('\n=== ALL TRANSACTIONS ===');
const transactions = db.prepare(`
  SELECT date, type, hours, description
  FROM overtime_transactions
  WHERE userId = ?
  ORDER BY date, createdAt
`).all(user.id) as Array<{ date: string; type: string; hours: number; description: string }>;

for (const t of transactions) {
  console.log(t.date + ' | ' + t.type.padEnd(12) + ' | ' + (t.hours > 0 ? '+' : '') + t.hours.toFixed(2) + 'h | ' + t.description);
}

console.log('\n');
