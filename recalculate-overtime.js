// Temporary script to recalculate overtime for admin user
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'server', 'database.db'));

// Get user 1 (admin)
const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
console.log('User:', user);

// Get corrections for 2025-11
const corrections = db.prepare(`
  SELECT COALESCE(SUM(hours), 0) as total
  FROM overtime_corrections
  WHERE userId = 1
    AND strftime('%Y-%m', date) = '2025-11'
`).get();

console.log('Corrections for 2025-11:', corrections);

// Get worked hours
const worked = db.prepare(`
  SELECT COALESCE(SUM(hours), 0) as total
  FROM time_entries
  WHERE userId = 1
    AND date LIKE '2025-11%'
`).get();

console.log('Worked hours:', worked);

// Calculate target (6 working days from 2025-11-13 to 2025-11-20)
const dailyHours = user.weeklyHours / 5;
const workingDays = 6;
const targetHours = dailyHours * workingDays;

console.log('\nCalculation:');
console.log('- Daily hours:', dailyHours);
console.log('- Working days:', workingDays);
console.log('- Target hours:', targetHours);
console.log('- Worked hours:', worked.total);
console.log('- Corrections:', corrections.total);
console.log('- Actual (worked + corrections):', worked.total + corrections.total);
console.log('- Overtime:', (worked.total + corrections.total) - targetHours);

// Update overtime_balance (overtime is a GENERATED column!)
const result = db.prepare(`
  UPDATE overtime_balance
  SET targetHours = ?,
      actualHours = ?
  WHERE userId = 1 AND month = '2025-11'
`).run(
  targetHours,
  worked.total + corrections.total
);

console.log('\nUpdate result:', result);

// Verify
const balance = db.prepare('SELECT * FROM overtime_balance WHERE userId = 1 AND month = ?').get('2025-11');
console.log('\nUpdated balance:', balance);

db.close();
