/**
 * Cleanup Invalid Time Entries
 * Removes time entries that are before the user's hire date
 * This fixes data integrity issues where entries were created before validation was implemented
 *
 * BEST PRACTICE: Data cleanup before going live with stricter validation
 * Source: "Data validation should be set before data entry" (2025 Best Practices)
 */

import db from '../src/database/connection.js';

console.log('🧹 Starting cleanup of invalid time entries...');

// Find all time entries that are before the user's hire date
const invalidEntries = db.prepare(`
  SELECT
    te.id as entryId,
    te.userId,
    te.date as entryDate,
    te.hours,
    u.firstName,
    u.lastName,
    u.hireDate
  FROM time_entries te
  JOIN users u ON te.userId = u.id
  WHERE u.hireDate IS NOT NULL
    AND te.date < u.hireDate
  ORDER BY te.userId, te.date
`).all() as Array<{
  entryId: number;
  userId: number;
  entryDate: string;
  hours: number;
  firstName: string;
  lastName: string;
  hireDate: string;
}>;

console.log(`\n📊 Found ${invalidEntries.length} invalid time entries:\n`);

if (invalidEntries.length === 0) {
  console.log('✅ No invalid entries found. Database is clean!');
  process.exit(0);
}

// Display invalid entries
invalidEntries.forEach((entry) => {
  console.log(`  ❌ ${entry.firstName} ${entry.lastName} (ID: ${entry.userId})`);
  console.log(`     Entry Date: ${entry.entryDate} (${entry.hours}h)`);
  console.log(`     Hire Date:  ${entry.hireDate}`);
  console.log(`     Problem:    Entry is ${dateDiff(entry.entryDate, entry.hireDate)} days BEFORE hire date`);
  console.log('');
});

// Delete invalid entries
console.log(`\n🗑️  Deleting ${invalidEntries.length} invalid entries...`);

const deleteStmt = db.prepare('DELETE FROM time_entries WHERE id = ?');

for (const entry of invalidEntries) {
  deleteStmt.run(entry.entryId);
  console.log(`  ✅ Deleted entry ID ${entry.entryId} for ${entry.firstName} ${entry.lastName}`);
}

console.log(`\n✅ Cleanup complete! Deleted ${invalidEntries.length} invalid entries.`);

// Helper function to calculate date difference
function dateDiff(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
