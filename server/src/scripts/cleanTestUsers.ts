/**
 * Clean Test Users from Development Database
 *
 * Purpose: Delete all test users (ID 48-57) and their associated data
 *
 * Usage:
 *   npm run test-users:clean
 *
 * USES TRANSACTION PATTERN for guaranteed ATOMIC deletion in WAL mode!
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

logger.info('🧹 Cleaning test users from development database...');
logger.info('📋 Finding all test users (username LIKE \'test.%\')...\n');

// Count existing users before deletion
const existingUsers = db
  .prepare('SELECT id, firstName, lastName FROM users WHERE username LIKE \'test.%\'')
  .all() as Array<{ id: number; firstName: string; lastName: string }>;

const testUserIds = existingUsers.map(u => u.id);

if (existingUsers.length === 0) {
  logger.info('✅ No test users found - database is clean');
  process.exit(0);
}

logger.info(`Found ${existingUsers.length} test users to delete:`);
existingUsers.forEach((u) => {
  logger.info(`  - User ${u.id}: ${u.firstName} ${u.lastName}`);
});
logger.info('');

// ============================================================================
// TRANSACTION: All DELETEs in one atomic operation
// ============================================================================

const cleanTestUsersTransaction = db.transaction(() => {
  logger.info('🔄 Starting transaction...');
  logger.info('🗑️  Deleting associated data...');

  // Build WHERE clause for user IDs
  const userIdsList = testUserIds.join(',');
  const whereClause = `userId IN (${userIdsList})`;

  // 1. Delete overtime_corrections (no foreign key dependencies)
  const deletedCorrections = db
    .prepare(`DELETE FROM overtime_corrections WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedCorrections.changes} overtime corrections`);

  // 2. Delete overtime_transactions (no foreign key dependencies)
  const deletedTransactions = db
    .prepare(`DELETE FROM overtime_transactions WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedTransactions.changes} overtime transactions`);

  // 3. Delete overtime_balance (no foreign key dependencies)
  const deletedBalance = db
    .prepare(`DELETE FROM overtime_balance WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedBalance.changes} overtime balance entries`);

  // 4. Delete overtime_daily (no foreign key dependencies)
  const deletedDaily = db
    .prepare(`DELETE FROM overtime_daily WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedDaily.changes} daily overtime entries`);

  // 5. Delete overtime_weekly (no foreign key dependencies)
  const deletedWeekly = db
    .prepare(`DELETE FROM overtime_weekly WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedWeekly.changes} weekly overtime entries`);

  // 6. Delete vacation_balance (no foreign key dependencies)
  const deletedVacation = db
    .prepare(`DELETE FROM vacation_balance WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedVacation.changes} vacation balance entries`);

  // 7. Delete absence_requests (references users)
  const deletedAbsences = db
    .prepare(`DELETE FROM absence_requests WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedAbsences.changes} absence requests`);

  // 8. Delete time_entries (references users)
  const deletedTimeEntries = db
    .prepare(`DELETE FROM time_entries WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedTimeEntries.changes} time entries`);

  // 9. Delete notifications (if any)
  const deletedNotifications = db
    .prepare(`DELETE FROM notifications WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedNotifications.changes} notifications`);

  // 10. Delete work_time_accounts (if any)
  const deletedWorkTime = db
    .prepare(`DELETE FROM work_time_accounts WHERE ${whereClause}`)
    .run();
  logger.info(`  ✅ Deleted ${deletedWorkTime.changes} work time accounts`);

  // 11. Finally, delete users
  const deletedUsers = db
    .prepare(`DELETE FROM users WHERE id IN (${userIdsList})`)
    .run();
  logger.info(`  ✅ Deleted ${deletedUsers.changes} users\n`);

  logger.info('✅ Transaction ready to commit');
});

// ============================================================================
// EXECUTE TRANSACTION (commits automatically on success!)
// ============================================================================

try {
  cleanTestUsersTransaction();
  logger.info('💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint to ensure data is written to main DB file
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  // Verify deletion
  const remainingUsers = db
    .prepare('SELECT id FROM users WHERE username LIKE \'test.%\'')
    .all();

  if (remainingUsers.length === 0) {
    logger.info('\n✅ All test users successfully deleted!');
    logger.info('💡 Run "npm run seed:test-users" to recreate them\n');
  } else {
    logger.error('❌ Some users still remain in database!');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK executed');
  process.exit(1);
}
