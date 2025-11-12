import { db } from './connection.js';
import logger from '../utils/logger.js';

/**
 * Test script to verify database indexes are working correctly
 * Run with: npm run test:indexes
 */

interface IndexInfo {
  name: string;
  tbl_name: string;
  sql: string | null;
}

// Removed unused interface TableInfo

function testDatabaseIndexes(): void {
  try {
    logger.info('🧪 Testing Database Indexes...');

    // 1. Count all custom indexes (starting with idx_)
    const customIndexes = db
      .prepare(
        `
        SELECT name, tbl_name, sql
        FROM sqlite_master
        WHERE type='index'
        AND name LIKE 'idx_%'
        ORDER BY tbl_name, name
      `
      )
      .all() as IndexInfo[];

    logger.info({ count: customIndexes.length }, '📊 Total Custom Indexes');

    if (customIndexes.length === 0) {
      logger.error('❌ No indexes found! Something went wrong.');
      return;
    }

    // 2. Group by table
    const byTable: Record<string, IndexInfo[]> = {};
    customIndexes.forEach((idx) => {
      if (!byTable[idx.tbl_name]) {
        byTable[idx.tbl_name] = [];
      }
      byTable[idx.tbl_name].push(idx);
    });

    // 3. Print summary
    logger.info('📋 Indexes by Table:');
    Object.entries(byTable).forEach(([table, indexes]) => {
      logger.info(`  ${table}: ${indexes.length} indexes`);
      indexes.forEach((idx) => {
        logger.info(`    - ${idx.name}`);
      });
    });

    // 4. Test query performance with EXPLAIN QUERY PLAN
    logger.info('\n🔍 Testing Query Plans...');

    // Test 1: Notifications with user filter (should use idx_notifications_user_date)
    const notificationsQuery = db.prepare(
      `
      EXPLAIN QUERY PLAN
      SELECT * FROM notifications
      WHERE userId = 1
      ORDER BY createdAt DESC
      LIMIT 20
    `
    );

    const notificationsPlan = notificationsQuery.all();
    logger.info('Query 1: Notifications by user (sorted by date)');
    logger.info({ plan: notificationsPlan }, 'Should use idx_notifications_user_date');

    // Test 2: Time entries with user and date filter
    const timeEntriesQuery = db.prepare(
      `
      EXPLAIN QUERY PLAN
      SELECT * FROM time_entries
      WHERE userId = 1 AND date >= '2025-01-01'
      ORDER BY date DESC
    `
    );

    const timeEntriesPlan = timeEntriesQuery.all();
    logger.info('Query 2: Time entries by user and date range');
    logger.info({ plan: timeEntriesPlan }, 'Should use idx_time_entries_user_date');

    // Test 3: Absence requests by user and status
    const absencesQuery = db.prepare(
      `
      EXPLAIN QUERY PLAN
      SELECT * FROM absence_requests
      WHERE userId = 1 AND status = 'pending'
      ORDER BY createdAt DESC
    `
    );

    const absencesPlan = absencesQuery.all();
    logger.info('Query 3: Absence requests by user and status');
    logger.info({ plan: absencesPlan }, 'Should use idx_absences_user_status');

    // Test 4: Audit log chronological query
    const auditQuery = db.prepare(
      `
      EXPLAIN QUERY PLAN
      SELECT * FROM audit_log
      WHERE userId = 1
      ORDER BY createdAt DESC
      LIMIT 50
    `
    );

    const auditPlan = auditQuery.all();
    logger.info('Query 4: Audit log by user (chronological)');
    logger.info({ plan: auditPlan }, 'Should use idx_audit_user_created');

    // 5. Verify all expected indexes exist
    const expectedIndexes = [
      // Users (4)
      'idx_users_email',
      'idx_users_username',
      'idx_users_status',
      'idx_users_role_deleted',

      // Time Entries (4)
      'idx_time_entries_user',
      'idx_time_entries_date',
      'idx_time_entries_user_date',
      'idx_time_entries_user_start',

      // Absence Requests (7)
      'idx_absences_user',
      'idx_absences_status',
      'idx_absences_dates',
      'idx_absences_type',
      'idx_absences_user_status',
      'idx_absences_created',
      'idx_absences_user_date',

      // Overtime Balance (3)
      'idx_overtime_user',
      'idx_overtime_month',
      'idx_overtime_user_month',

      // Overtime Daily (3)
      'idx_overtime_daily_user',
      'idx_overtime_daily_date',
      'idx_overtime_daily_user_date',

      // Overtime Weekly (3)
      'idx_overtime_weekly_user',
      'idx_overtime_weekly_week',
      'idx_overtime_weekly_user_week',

      // Vacation Balance (3)
      'idx_vacation_user',
      'idx_vacation_year',
      'idx_vacation_user_year',

      // Notifications (5)
      'idx_notifications_user',
      'idx_notifications_read',
      'idx_notifications_created',
      'idx_notifications_user_date',
      'idx_notifications_user_read',

      // Audit Log (5)
      'idx_audit_user',
      'idx_audit_created',
      'idx_audit_action',
      'idx_audit_entity',
      'idx_audit_user_created',

      // Holidays (1)
      'idx_holidays_date',
    ];

    const indexNames = customIndexes.map((idx) => idx.name);
    const missingIndexes = expectedIndexes.filter((name) => !indexNames.includes(name));

    if (missingIndexes.length > 0) {
      logger.error({ missing: missingIndexes }, '❌ Missing Indexes');
    } else {
      logger.info('✅ All expected indexes exist!');
    }

    // 6. Check for unexpected indexes
    const unexpectedIndexes = indexNames.filter((name) => !expectedIndexes.includes(name));
    if (unexpectedIndexes.length > 0) {
      logger.warn({ unexpected: unexpectedIndexes }, '⚠️  Unexpected Indexes Found');
    }

    // 7. Final summary
    logger.info('\n📊 Index Test Summary:');
    logger.info(`  Total indexes: ${customIndexes.length}`);
    logger.info(`  Expected: ${expectedIndexes.length}`);
    logger.info(`  Missing: ${missingIndexes.length}`);
    logger.info(`  Unexpected: ${unexpectedIndexes.length}`);

    if (missingIndexes.length === 0 && unexpectedIndexes.length === 0) {
      logger.info('✅ All indexes verified successfully!');
    } else {
      logger.error('❌ Index verification failed!');
    }
  } catch (error) {
    logger.error({ err: error }, '❌ Index test failed');
    throw error;
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseIndexes();
}

export { testDatabaseIndexes };
