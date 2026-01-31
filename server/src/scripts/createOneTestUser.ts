/**
 * Create ONE Test User with Complete Workflow
 *
 * Creates: Max Mustermann (Vollzeit 40h, hired 2024-01-01)
 * With: Time entries for 2024, 2025, 2026
 * And: Calculated overtime balances
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

logger.info('🚀 Creating ONE test user: Max Mustermann');

// 1. Create user
const hashedPassword = bcrypt.hashSync('test123', 10);
const result = db.prepare(`
  INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, vacationDaysPerYear, hireDate, status, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`).run('test.max', 'max@test.com', hashedPassword, 'Max', 'Mustermann', 'employee', 40, 30, '2024-01-01', 'active');

const userId = result.lastInsertRowid as number;
logger.info({ userId }, '✅ User created');

// 2. Add time entries for 2024, 2025, 2026
logger.info('📅 Adding time entries (2024-2026)...');
let total = 0;

for (const year of [2024, 2025]) {
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const dateStr = date.toISOString().split('T')[0];
      const startTime = `08:00`;
      const endTime = `16:00`;

      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt)
        VALUES (?, ?, ?, ?, 8, 'office', datetime('now'))
      `).run(userId, dateStr, startTime, endTime);

      total++;
    }
  }
}

// 2026: Only January (up to today)
const jan2026Days = new Date(2026, 1, 0).getDate();
for (let day = 1; day <= jan2026Days; day++) {
  const date = new Date(2026, 0, day);
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) continue;
  if (date > new Date()) break;

  const dateStr = date.toISOString().split('T')[0];
  const startTime = `08:00`;
  const endTime = `16:00`;

  db.prepare(`
    INSERT INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt)
    VALUES (?, ?, ?, ?, 8, 'office', datetime('now'))
  `).run(userId, dateStr, startTime, endTime);

  total++;
}

logger.info({ total }, '✅ Time entries created');

// 3. Calculate overtime balances
logger.info('⏳ Calculating overtime balances...');
ensureOvertimeBalanceEntries(userId, '2026-01');
logger.info('✅ Overtime balances calculated');

// 4. Verify
const overtimeData = db.prepare(`
  SELECT month, targetHours, actualHours, overtime, carryoverFromPreviousYear
  FROM overtime_balance
  WHERE userId = ?
  ORDER BY month DESC
  LIMIT 5
`).all(userId) as Array<{
  month: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
  carryoverFromPreviousYear: number;
}>;

logger.info('\n📊 Last 5 months:');
overtimeData.forEach(m => {
  logger.info(`  ${m.month}: Target ${m.targetHours}h, Actual ${m.actualHours}h, Overtime ${m.overtime}h (Carryover: ${m.carryoverFromPreviousYear}h)`);
});

logger.info(`\n✅ User ID ${userId} (test.max) created successfully!`);
logger.info(`   Username: test.max`);
logger.info(`   Password: test123`);
logger.info(`   Time entries: ${total}`);

process.exit(0);
