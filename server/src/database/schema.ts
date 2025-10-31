import Database from 'better-sqlite3';

/**
 * Database Schema Definition
 * All 11 tables for TimeTracking System
 */

export function initializeDatabase(db: Database.Database): void {
  // Enable Foreign Keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for multi-user support
  db.pragma('journal_mode = WAL');

  console.log('📊 Initializing database schema...');

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
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT
    );
  `);

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

  // 5. overtime_balance table
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
  `);

  console.log('✅ Database schema initialized successfully');
  console.log('✅ WAL mode enabled for multi-user support');
  console.log('✅ Foreign keys enabled');
  console.log('✅ All 11 tables created');
  console.log('✅ Indexes created for performance');
}
