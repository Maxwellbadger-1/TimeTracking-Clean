import Database from 'better-sqlite3';
import { getCurrentMonth, getTodayString, parseDate } from '../dist/utils/timezone.js';

const db = new Database('/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db');

console.log('\n🔍 Testing Month Generation Logic\n');
console.log('='.repeat(60));

// Get user 15
const user = db.prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE id = 15').get();
console.log('\nUser:', user.firstName, user.lastName);
console.log('Hire Date:', user.hireDate);

const targetMonth = getCurrentMonth();
console.log('\nTarget Month:', targetMonth);
console.log('Today String:', getTodayString());

const hireDate = new Date(user.hireDate);
const targetDate = new Date(targetMonth + '-01');

console.log('\nDate Objects:');
console.log('  hireDate:', hireDate.toString());
console.log('  targetDate:', targetDate.toString());

// Generate months
const months = [];
const current = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);

console.log('\nGenerating months:');
console.log('  Starting current:', current.toString());

let iterations = 0;
while (current <= targetDate && iterations < 20) {
  const monthStr = current.toISOString().substring(0, 7);
  console.log(`  ${iterations + 1}. current <= targetDate? ${current <= targetDate} → Adding ${monthStr}`);
  months.push(monthStr);
  current.setMonth(current.getMonth() + 1);
  iterations++;
}

console.log('\nGenerated Months:', months);
console.log('Total:', months.length, 'months');

console.log('\n' + '='.repeat(60));

db.close();
