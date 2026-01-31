/**
 * Recalculate Overtime Balances for Test Users
 *
 * Purpose: Update overtime_balance table after adding 2026 time entries
 *
 * Usage:
 *   npm run recalculate:overtime
 */

import { db } from '../database/connection.js';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

logger.info('🔄 Recalculating overtime balances for all test users...');

// Get all test users by username pattern
const testUsers = db.prepare(`
  SELECT id FROM users
  WHERE username LIKE 'test.%'
  ORDER BY id
`).all() as Array<{ id: number }>;

const testUserIds = testUsers.map(u => u.id);
logger.info(`Found ${testUserIds.length} test users: ${testUserIds.join(', ')}`);

// Calculate up to current month (2026-01)
const today = new Date();
const upToMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

logger.info(`📅 Recalculating up to month: ${upToMonth}\n`);

for (const userId of testUserIds) {
  const user = db.prepare('SELECT id, firstName, lastName FROM users WHERE id = ?').get(userId) as { id: number; firstName: string; lastName: string } | undefined;

  if (!user) {
    logger.warn(`⚠️  User ${userId} not found, skipping...`);
    continue;
  }

  logger.info(`📊 Recalculating for User ${userId}: ${user.firstName} ${user.lastName}`);

  try {
    // This will recalculate ALL months from hireDate to upToMonth
    ensureOvertimeBalanceEntries(userId, upToMonth);
    logger.info(`✅ User ${userId} recalculated successfully\n`);
  } catch (error) {
    logger.error(`❌ Error recalculating User ${userId}:`, error);
  }
}

logger.info('🎉 Recalculation complete!');
logger.info('💡 Run validation now: npm run validate:overtime:detailed -- --userId=48');

process.exit(0);
