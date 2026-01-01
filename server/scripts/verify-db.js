import Database from 'better-sqlite3';

const db = new Database('database/development.db');

console.log('\n📊 PRODUCTION DB VERIFICATION - OVERTIME BALANCE\n');
console.log('='.repeat(100));

const users = db.prepare('SELECT id, firstName, lastName FROM users WHERE deletedAt IS NULL').all();

for (const user of users) {
  console.log(`\n👤 ${user.firstName} ${user.lastName} (ID: ${user.id})`);
  console.log('-'.repeat(80));

  const rows = db.prepare(`
    SELECT month, targetHours, actualHours, ROUND(actualHours - targetHours, 2) as overtime
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month
  `).all(user.id);

  for (const row of rows) {
    const sign = row.overtime >= 0 ? '+' : '';
    console.log(`  ${row.month}: Target=${row.targetHours.toFixed(2)}h, Actual=${row.actualHours.toFixed(2)}h, Overtime=${sign}${row.overtime.toFixed(2)}h`);
  }

  const total = db.prepare(`
    SELECT ROUND(SUM(actualHours - targetHours), 2) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id);

  const sign = total.total >= 0 ? '+' : '';
  console.log(`\n  ⏰ TOTAL OVERTIME: ${sign}${total.total.toFixed(2)}h`);
}

console.log('\n' + '='.repeat(100));
console.log('✅ VERIFICATION COMPLETE\n');

db.close();
