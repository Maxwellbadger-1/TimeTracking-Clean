import { db } from '../database/connection.js';
import { updateAllOvertimeLevels } from '../services/overtimeService.js';

/**
 * Migration Script: Populate overtime_daily and overtime_weekly tables
 * from existing time_entries data
 */

console.log('🔄 Starting overtime data migration...');

// Get all unique user IDs with time entries
const users = db
  .prepare(
    `SELECT DISTINCT userId FROM time_entries ORDER BY userId`
  )
  .all() as Array<{ userId: number }>;

console.log(`📊 Found ${users.length} users with time entries`);

let totalDaysProcessed = 0;
let totalErrors = 0;

for (const { userId } of users) {
  console.log(`\n👤 Processing user ${userId}...`);

  // Get all unique dates for this user
  const dates = db
    .prepare(
      `SELECT DISTINCT date FROM time_entries WHERE userId = ? ORDER BY date`
    )
    .all(userId) as Array<{ date: string }>;

  console.log(`  📅 Found ${dates.length} days with entries`);

  for (const { date } of dates) {
    try {
      // Call updateAllOvertimeLevels for each date
      // This will populate overtime_daily, overtime_weekly, and overtime_balance
      updateAllOvertimeLevels(userId, date);
      totalDaysProcessed++;
    } catch (error) {
      console.error(`  ❌ Error processing ${date}:`, error);
      totalErrors++;
    }
  }

  console.log(`  ✅ Processed ${dates.length} days for user ${userId}`);
}

// Show summary
console.log('\n📊 Migration Summary:');
console.log(`  ✅ Users processed: ${users.length}`);
console.log(`  ✅ Days processed: ${totalDaysProcessed}`);
console.log(`  ❌ Errors: ${totalErrors}`);

// Verify results
const dailyCount = db.prepare('SELECT COUNT(*) as count FROM overtime_daily').get() as {
  count: number;
};
const weeklyCount = db.prepare('SELECT COUNT(*) as count FROM overtime_weekly').get() as {
  count: number;
};

console.log('\n📈 Results:');
console.log(`  Daily records created: ${dailyCount.count}`);
console.log(`  Weekly records created: ${weeklyCount.count}`);

console.log('\n✅ Migration completed!');
