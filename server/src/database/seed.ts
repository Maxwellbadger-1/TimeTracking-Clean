import db from './connection.js';
import { hashPassword } from '../services/authService.js';
import logger from '../utils/logger.js';

/**
 * Seed database with initial data
 */

export async function seedDatabase(): Promise<void> {
  logger.info('🌱 Seeding database...');

  // Check if admin already exists
  const adminExists = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get('admin');

  if (adminExists) {
    logger.info('✅ Admin user already exists, skipping seed');
    return;
  }

  // Create admin user
  const hashedPassword = await hashPassword('admin123');

  const stmt = db.prepare(`
    INSERT INTO users (
      username,
      email,
      password,
      firstName,
      lastName,
      role,
      department,
      weeklyHours,
      vacationDaysPerYear,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    'admin',
    'admin@timetracking.local',
    hashedPassword,
    'System',
    'Administrator',
    'admin',
    'IT',
    40,
    30,
    'active'
  );

  logger.info({ userId: result.lastInsertRowid }, '✅ Admin user created');
  logger.info('   Username: admin');
  logger.info('   Password: admin123');
  logger.warn('   ⚠️  IMPORTANT: Change password after first login!');

  // Seed some default departments
  const departments = ['IT', 'HR', 'Sales', 'Administration', 'Operations'];

  const deptStmt = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');

  for (const dept of departments) {
    deptStmt.run(dept);
  }

  logger.info({ departments }, '✅ Default departments created');

  // Seed some default projects
  const projects = ['Internal', 'Customer Support', 'Development', 'Administration'];

  const projStmt = db.prepare('INSERT OR IGNORE INTO projects (name, active) VALUES (?, ?)');

  for (const project of projects) {
    projStmt.run(project, 1);
  }

  logger.info({ projects }, '✅ Default projects created');

  // Seed some default activities
  const activities = ['Meeting', 'Development', 'Documentation', 'Support', 'Planning'];

  const actStmt = db.prepare('INSERT OR IGNORE INTO activities (name, active) VALUES (?, ?)');

  for (const activity of activities) {
    actStmt.run(activity, 1);
  }

  logger.info({ activities }, '✅ Default activities created');

  logger.info('✅ Database seeding completed');
}
