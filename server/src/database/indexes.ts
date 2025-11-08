import type Database from 'better-sqlite3';
import logger from '../utils/logger.js';

/**
 * Database Indexes for Performance Optimization
 * Add indexes on frequently queried columns
 */

export function createIndexes(db: Database.Database): void {
  logger.info('📊 Creating database indexes for performance...');

  try {
    // Users indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);

    // Time entries indexes (most frequently queried)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(userId);
      CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
      CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(userId, date);
    `);

    // Absence requests indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_absences_user ON absence_requests(userId);
      CREATE INDEX IF NOT EXISTS idx_absences_status ON absence_requests(status);
      CREATE INDEX IF NOT EXISTS idx_absences_dates ON absence_requests(startDate, endDate);
      CREATE INDEX IF NOT EXISTS idx_absences_type ON absence_requests(type);
    `);

    // Overtime balance indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_balance(userId);
      CREATE INDEX IF NOT EXISTS idx_overtime_month ON overtime_balance(month);
      CREATE INDEX IF NOT EXISTS idx_overtime_user_month ON overtime_balance(userId, month);
    `);

    // Vacation balance indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vacation_user ON vacation_balance(userId);
      CREATE INDEX IF NOT EXISTS idx_vacation_year ON vacation_balance(year);
      CREATE INDEX IF NOT EXISTS idx_vacation_user_year ON vacation_balance(userId, year);
    `);

    // Notifications indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(isRead);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt);
    `);

    // Audit log indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(userId);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entityId);
    `);

    // Holidays indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    `);

    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to create indexes');
    throw error;
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
