import type Database from 'better-sqlite3';
import logger from '../utils/logger.js';

/**
 * Database Indexes for Performance Optimization
 * Add indexes on frequently queried columns
 */

export function createIndexes(db: Database.Database): void {
  logger.info('📊 Creating database indexes for performance...');

  try {
    // ====================================
    // USERS - Composite indexes for filtering and role-based queries
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role_deleted ON users(role, deletedAt);
    `);

    // ====================================
    // TIME ENTRIES - Most critical for performance (largest dataset)
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(userId);
      CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date DESC);
      CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(userId, date DESC);
      CREATE INDEX IF NOT EXISTS idx_time_entries_user_start ON time_entries(userId, date DESC, startTime DESC);
    `);

    // ====================================
    // ABSENCE REQUESTS - Composite indexes for status filtering
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_absences_user ON absence_requests(userId);
      CREATE INDEX IF NOT EXISTS idx_absences_status ON absence_requests(status);
      CREATE INDEX IF NOT EXISTS idx_absences_dates ON absence_requests(startDate, endDate);
      CREATE INDEX IF NOT EXISTS idx_absences_type ON absence_requests(type);
      CREATE INDEX IF NOT EXISTS idx_absences_user_status ON absence_requests(userId, status, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_absences_created ON absence_requests(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_absences_user_date ON absence_requests(userId, startDate DESC);
    `);

    // ====================================
    // OVERTIME BALANCE - Monthly aggregations
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_balance(userId);
      CREATE INDEX IF NOT EXISTS idx_overtime_month ON overtime_balance(month DESC);
      CREATE INDEX IF NOT EXISTS idx_overtime_user_month ON overtime_balance(userId, month);
    `);

    // ====================================
    // OVERTIME DAILY - Daily tracking
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_overtime_daily_user ON overtime_daily(userId);
      CREATE INDEX IF NOT EXISTS idx_overtime_daily_date ON overtime_daily(date DESC);
      CREATE INDEX IF NOT EXISTS idx_overtime_daily_user_date ON overtime_daily(userId, date DESC);
    `);

    // ====================================
    // OVERTIME WEEKLY - Weekly aggregations
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_overtime_weekly_user ON overtime_weekly(userId);
      CREATE INDEX IF NOT EXISTS idx_overtime_weekly_week ON overtime_weekly(week DESC);
      CREATE INDEX IF NOT EXISTS idx_overtime_weekly_user_week ON overtime_weekly(userId, week DESC);
    `);

    // ====================================
    // VACATION BALANCE - Year-based queries
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vacation_user ON vacation_balance(userId);
      CREATE INDEX IF NOT EXISTS idx_vacation_year ON vacation_balance(year DESC);
      CREATE INDEX IF NOT EXISTS idx_vacation_user_year ON vacation_balance(userId, year);
    `);

    // ====================================
    // NOTIFICATIONS - CRITICAL (unbounded growth, needs pagination)
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications(userId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userId, read, createdAt DESC);
    `);

    // ====================================
    // AUDIT LOG - Chronological queries and entity lookups
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(userId);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entityId);
      CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(userId, createdAt DESC);
    `);

    // ====================================
    // HOLIDAYS - Date lookups
    // ====================================
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    `);

    logger.info('✅ Database indexes created successfully');
    logger.info('✅ Performance-optimized composite indexes added');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to create indexes');
    throw error;
  }
}

/**
 * Verify all indexes exist and log them
 */
export function verifyIndexes(db: Database.Database): void {
  try {
    const indexes = db
      .prepare(
        `
        SELECT name, tbl_name
        FROM sqlite_master
        WHERE type='index'
        AND name LIKE 'idx_%'
        ORDER BY tbl_name, name
      `
      )
      .all() as Array<{ name: string; tbl_name: string }>;

    logger.info({ count: indexes.length }, '📊 Database Indexes Verified');

    // Group by table for better readability
    const byTable: Record<string, string[]> = {};
    indexes.forEach((idx) => {
      if (!byTable[idx.tbl_name]) {
        byTable[idx.tbl_name] = [];
      }
      byTable[idx.tbl_name].push(idx.name);
    });

    // Log indexes grouped by table
    Object.entries(byTable).forEach(([table, tableIndexes]) => {
      logger.info({ table, indexes: tableIndexes }, `  📋 ${table}: ${tableIndexes.length} indexes`);
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to verify indexes');
  }
}

/**
 * Check index usage statistics (optional - for monitoring)
 */
export function getIndexStats(db: Database.Database): Array<{ table: string; index: string; usageCount: number }> {
  try {
    const stats = db
      .prepare(
        `
        SELECT
          tbl AS table_name,
          idx AS index_name
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl NOT LIKE 'sqlite_%'
        ORDER BY tbl, idx
      `
      )
      .all() as Array<{ table_name: string; index_name: string }>;

    return stats.map((stat) => ({
      table: stat.table_name,
      index: stat.index_name,
      usageCount: 0, // SQLite doesn't track usage count
    }));
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to get index stats');
    return [];
  }
}
