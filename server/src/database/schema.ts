import Database from 'better-sqlite3';
import logger from '../utils/logger.js';

/**
 * Database Schema Definition
 * All 14 tables for TimeTracking System
 */

export function initializeDatabase(db: Database.Database): void {
  // Enable Foreign Keys
  db.pragma('foreign_keys = ON');

  // CRITICAL: Verify foreign keys are actually enabled!
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  if (fkStatus !== 1) {
    throw new Error('❌ CRITICAL: Failed to enable foreign key constraints! Data integrity at risk!');
  }
  logger.info('✅ Foreign keys ENABLED and VERIFIED');

  // Enable WAL mode for multi-user support
  db.pragma('journal_mode = WAL');

  // CRITICAL: Verify WAL mode is actually enabled!
  const walMode = db.pragma('journal_mode', { simple: true }) as string;
  if (walMode.toLowerCase() !== 'wal') {
    throw new Error('❌ CRITICAL: Failed to enable WAL mode! Multi-user support unavailable!');
  }
  logger.info('✅ WAL mode ENABLED and VERIFIED');

  logger.info('📊 Initializing database schema...');

  // 1. users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
      department TEXT,
      weeklyHours REAL NOT NULL DEFAULT 40,
      vacationDaysPerYear INTEGER DEFAULT 30,
      hireDate TEXT NOT NULL DEFAULT (date('now')),
      endDate TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      privacyConsentAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT
    );
  `);

  // Migration: Add privacyConsentAt column if it doesn't exist
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN privacyConsentAt TEXT;
    `);
    logger.info('✅ Added privacyConsentAt column to users table');
  } catch (error) {
    // Column already exists - ignore error
  }

  // Migration: Add forcePasswordChange column if it doesn't exist
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0;
    `);
    logger.info('✅ Added forcePasswordChange column to users table');
  } catch (error) {
    // Column already exists - ignore error
  }

  // Migration: Add workSchedule column if it doesn't exist (Flexible Arbeitszeitmodelle)
  // Format: JSON string {"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":2,"saturday":0,"sunday":0}
  // NULL = Fallback to weeklyHours/5 (for backward compatibility)
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN workSchedule TEXT DEFAULT NULL;
    `);
    logger.info('✅ Added workSchedule column to users table (Flexible Arbeitszeitmodelle)');
  } catch (error) {
    // Column already exists - ignore error
  }

  // Note: The position column migration has been moved to SQL migration file:
  // database/migrations/20260208_add_position_column.sql
  // This will be handled by the migration system on deployment

  // Migration: Make email column nullable (email is optional)
  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
  try {
    // Check if migration is needed
    const tableInfo = db.pragma('table_info(users)') as Array<{ name: string; notnull: number }>;
    const emailColumn = tableInfo.find(col => col.name === 'email');

    if (emailColumn && emailColumn.notnull === 1) {
      logger.info('🔄 Migrating users table to make email optional...');

      // Temporarily disable foreign keys for migration
      db.pragma('foreign_keys = OFF');

      db.exec(`
        BEGIN TRANSACTION;

        -- Create new table with email as optional
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          password TEXT NOT NULL,
          firstName TEXT NOT NULL,
          lastName TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
          department TEXT,
          weeklyHours REAL NOT NULL DEFAULT 40,
          vacationDaysPerYear INTEGER DEFAULT 30,
          hireDate TEXT NOT NULL DEFAULT (date('now')),
          endDate TEXT,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
          privacyConsentAt TEXT,
          forcePasswordChange INTEGER DEFAULT 0,
          workSchedule TEXT DEFAULT NULL,
          createdAt TEXT DEFAULT (datetime('now')),
          deletedAt TEXT
        );

        -- Copy all data
        INSERT INTO users_new
        SELECT id, username, email, password, firstName, lastName, role,
               department, weeklyHours, vacationDaysPerYear, hireDate, endDate,
               status, privacyConsentAt, forcePasswordChange, workSchedule,
               createdAt, deletedAt
        FROM users;

        -- Drop old table
        DROP TABLE users;

        -- Rename new table
        ALTER TABLE users_new RENAME TO users;

        COMMIT;
      `);

      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');

      logger.info('✅ Email column is now optional (nullable)');
    }
  } catch (error: any) {
    // Ensure foreign keys are re-enabled even if migration fails
    db.pragma('foreign_keys = ON');
    logger.warn({ err: error }, '⚠️ Email migration failed or already applied');
  }

  // 2. time_entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      breakMinutes INTEGER DEFAULT 0,
      hours REAL NOT NULL,
      activity TEXT,
      project TEXT,
      location TEXT NOT NULL CHECK(location IN ('office', 'homeoffice', 'field')),
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. absence_requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS absence_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('vacation', 'sick', 'unpaid', 'overtime_comp')),
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      days REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reason TEXT,
      adminNote TEXT,
      approvedBy INTEGER,
      approvedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approvedBy) REFERENCES users(id)
    );
  `);

  // 4. vacation_balance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vacation_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      year INTEGER NOT NULL,
      entitlement REAL NOT NULL,
      carryover REAL DEFAULT 0,
      taken REAL DEFAULT 0,
      remaining REAL GENERATED ALWAYS AS (entitlement + carryover - taken) VIRTUAL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, year)
    );
  `);

  // 5. overtime_balance table (MONTHLY overtime)
  db.exec(`
    CREATE TABLE IF NOT EXISTS overtime_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      month TEXT NOT NULL,
      targetHours REAL NOT NULL,
      actualHours REAL DEFAULT 0,
      overtime REAL GENERATED ALWAYS AS (actualHours - targetHours) VIRTUAL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, month)
    );
  `);

  // Migration: Add carryoverFromPreviousYear column if it doesn't exist (for year-end rollover)
  try {
    db.exec(`
      ALTER TABLE overtime_balance ADD COLUMN carryoverFromPreviousYear REAL DEFAULT 0;
    `);
    logger.info('✅ Added carryoverFromPreviousYear column to overtime_balance table (Year-End Rollover)');
  } catch (error) {
    // Column already exists - ignore error
  }

  // 5a. overtime_daily table (DAILY overtime tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS overtime_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      targetHours REAL NOT NULL,
      actualHours REAL DEFAULT 0,
      overtime REAL GENERATED ALWAYS AS (actualHours - targetHours) VIRTUAL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, date)
    );
  `);

  // 5b. overtime_weekly table (WEEKLY overtime tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS overtime_weekly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      week TEXT NOT NULL,
      targetHours REAL NOT NULL,
      actualHours REAL DEFAULT 0,
      overtime REAL GENERATED ALWAYS AS (actualHours - targetHours) VIRTUAL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, week)
    );
  `);

  // 6. departments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  // 7. projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  // 8. activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  // 9. holidays table
  db.exec(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      federal INTEGER DEFAULT 1
    );
  `);

  // 10. notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 11. audit_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
      entity TEXT NOT NULL,
      entityId INTEGER,
      changes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  // 12. overtime_corrections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS overtime_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      hours REAL NOT NULL,
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      correctionType TEXT NOT NULL CHECK(correctionType IN ('system_error', 'absence_credit', 'migration', 'manual')),
      createdBy INTEGER NOT NULL,
      approvedBy INTEGER,
      approvedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id),
      FOREIGN KEY (approvedBy) REFERENCES users(id)
    );
  `);

  // 13. work_time_accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_time_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      currentBalance REAL DEFAULT 0,
      maxPlusHours REAL DEFAULT 50,
      maxMinusHours REAL DEFAULT -20,
      lastUpdated TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 14. overtime_transactions table (Transaction-based overtime tracking)
  // PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
  // - Immutable audit trail for all overtime changes
  // - Separate transactions for earned, compensation, corrections
  // - Enables "Arbeitszeitkonto" (German working time account) compliance
  db.exec(`
    CREATE TABLE IF NOT EXISTS overtime_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN (
        'worked', 'time_entry', 'vacation_credit', 'sick_credit',
        'overtime_comp_credit', 'special_credit', 'unpaid_deduction',
        'holiday_credit', 'weekend_credit', 'carry_over', 'payout',
        'correction', 'initial_balance', 'year_end_balance',
        'earned', 'compensation', 'carryover', 'unpaid_adjustment'
      )),
      hours REAL NOT NULL,
      description TEXT,
      referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system')),
      referenceId INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      createdBy INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );
  `);

  // 15. password_change_log table (Audit Trail for password changes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      changedBy INTEGER NOT NULL,
      changeType TEXT NOT NULL CHECK(changeType IN ('self-service', 'admin-reset')),
      ipAddress TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (changedBy) REFERENCES users(id)
    );
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_userId ON time_entries(userId);
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
    CREATE INDEX IF NOT EXISTS idx_absence_requests_userId ON absence_requests(userId);
    CREATE INDEX IF NOT EXISTS idx_absence_requests_status ON absence_requests(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON audit_log(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entityId);
    CREATE INDEX IF NOT EXISTS idx_overtime_corrections_userId ON overtime_corrections(userId);
    CREATE INDEX IF NOT EXISTS idx_overtime_corrections_date ON overtime_corrections(date);
    CREATE INDEX IF NOT EXISTS idx_work_time_accounts_userId ON work_time_accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_userId ON overtime_transactions(userId);
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_date ON overtime_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_overtime_transactions_type ON overtime_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_password_change_log_userId ON password_change_log(userId);
    CREATE INDEX IF NOT EXISTS idx_password_change_log_changedBy ON password_change_log(changedBy);
  `);

  logger.info('✅ Database schema initialized successfully');
  logger.info('✅ WAL mode enabled for multi-user support');
  logger.info('✅ Foreign keys enabled');
  logger.info('✅ All 14 tables created');
  logger.info('✅ Indexes created for performance');
}
