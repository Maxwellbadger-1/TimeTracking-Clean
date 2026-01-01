/**
 * Cleanup Invalid Time Entries (JavaScript version for production)
 * Removes time entries that are before the user's hire date
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

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
`).all();

console.log(`\n📊 Found ${invalidEntries.length} invalid time entries:\n`);

if (invalidEntries.length === 0) {
  console.log('✅ No invalid entries found. Database is clean!');
  db.close();
  process.exit(0);
}

// Display invalid entries
invalidEntries.forEach((entry) => {
  console.log(`  ❌ ${entry.firstName} ${entry.lastName} (ID: ${entry.userId})`);
  console.log(`     Entry Date: ${entry.entryDate} (${entry.hours}h)`);
  console.log(`     Hire Date:  ${entry.hireDate}`);
  const d1 = new Date(entry.entryDate);
  const d2 = new Date(entry.hireDate);
  const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
  console.log(`     Problem:    Entry is ${diffDays} days BEFORE hire date`);
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

db.close();
