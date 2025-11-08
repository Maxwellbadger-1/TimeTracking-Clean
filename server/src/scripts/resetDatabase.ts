import Database from 'better-sqlite3';
import { join } from 'path';
import bcrypt from 'bcrypt';

const DB_PATH = join(process.cwd(), 'database.db');

console.log('🔄 Resetting database to clean state...');
console.log('📁 Database path:', DB_PATH);

const db = new Database(DB_PATH);

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  console.log('🗑️  Deleting all data...');

  // Delete all data from tables (in correct order due to foreign keys)
  db.exec('DELETE FROM audit_log');
  db.exec('DELETE FROM notifications');
  db.exec('DELETE FROM time_entries');
  db.exec('DELETE FROM absence_requests');
  db.exec('DELETE FROM vacation_balance');
  db.exec('DELETE FROM overtime_balance');
  db.exec('DELETE FROM holidays');
  db.exec('DELETE FROM activities');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM departments');

  // Delete all users except admin
  db.exec('DELETE FROM users WHERE id != 1');

  console.log('✅ All data deleted (except admin user)');

  // Reset admin user to default state
  const hashedPassword = bcrypt.hashSync('admin123', 10);

  db.prepare(`
    UPDATE users
    SET
      username = ?,
      email = ?,
      password = ?,
      firstName = ?,
      lastName = ?,
      role = ?,
      weeklyHours = ?,
      vacationDaysPerYear = ?,
      hireDate = ?,
      privacyConsentAt = datetime('now'),
      deletedAt = NULL
    WHERE id = 1
  `).run(
    'admin',
    'admin@timetracking.local',
    hashedPassword,
    'System',
    'Administrator',
    'admin',
    40,
    30,
    '2025-01-01'
  );

  console.log('✅ Admin user reset to default');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('   Email: admin@timetracking.local');

  // Reset autoincrement counters (if table exists)
  try {
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'
    `).get();

    if (tableExists) {
      db.exec('DELETE FROM sqlite_sequence');
      console.log('✅ Auto-increment counters reset');
    }
  } catch (error) {
    // Ignore - sqlite_sequence might not exist yet
    console.log('ℹ️  No auto-increment counters to reset');
  }

  // Commit transaction
  db.exec('COMMIT');

  console.log('✅ Database reset complete!');
  console.log('🎯 You can now login with:');
  console.log('   Username: admin');
  console.log('   Password: admin123');

} catch (error) {
  // Rollback on error
  db.exec('ROLLBACK');
  console.error('❌ Error resetting database:', error);
  throw error;
} finally {
  db.close();
}
