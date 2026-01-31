import { db } from './src/database/connection.js';

console.log('🔍 Testing ALL USERS Monthly Endpoint Logic\n');

const year = 2026;
const month = '2026-01';

// Get all users
const users = db.prepare(`SELECT id, firstName, lastName FROM users WHERE deletedAt IS NULL`).all() as Array<{
  id: number;
  firstName: string;
  lastName: string;
}>;

console.log(`Found ${users.length} users\n`);

// For each user, fetch their monthly balance (same as frontend hook does)
users.forEach(user => {
  const balance = db.prepare(`
    SELECT
      userId,
      month,
      targetHours,
      actualHours,
      overtime,
      carryoverFromPreviousYear
    FROM overtime_balance
    WHERE userId = ? AND month = ?
  `).get(user.id, month) as {
    userId: number;
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
    carryoverFromPreviousYear: number;
  } | undefined;

  if (balance) {
    console.log(`${user.firstName} ${user.lastName} (ID ${user.id}):`);
    console.log(`  Target: ${balance.targetHours}h`);
    console.log(`  Actual: ${balance.actualHours}h`);
    console.log(`  Overtime: ${balance.overtime}h`);
    console.log(`  Carryover: ${balance.carryoverFromPreviousYear}h`);
    console.log('');
  } else {
    console.log(`${user.firstName} ${user.lastName} (ID ${user.id}): NO DATA\n`);
  }
});

// Check specifically for User 3 (Maximilian Fegg2)
console.log('🎯 Specific check for User 3 (Maximilian Fegg2):');
const user3 = db.prepare(`
  SELECT userId, month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = 3 AND month = '2026-01'
`).get();

console.log('Result:', user3);

process.exit(0);
