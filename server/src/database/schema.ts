import Database from 'better-sqlite3';
import logger from '../utils/logger.js';

/**
 * Database Schema Definition
 * All 13 tables for TimeTracking System
 */

export function initializeDatabase(db: Database.Database): void {
  // Enable Foreign Keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for multi-user support
  db.pragma('journal_mode = WAL');

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
  `);

  logger.info('✅ Database schema initialized successfully');
  logger.info('✅ WAL mode enabled for multi-user support');
  logger.info('✅ Foreign keys enabled');
  logger.info('✅ All 13 tables created');
  logger.info('✅ Indexes created for performance');
}
