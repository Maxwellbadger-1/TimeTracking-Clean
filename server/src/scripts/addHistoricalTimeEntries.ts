/**
 * Add Historical Time Entries (2024-2025) for Test Users
 *
 * Purpose: Generate realistic historical data so test users have proper carryover
 *
 * Creates FULL MONTHS of time entries matching each user's workSchedule:
 * - Max/Peter/Laura/Sarah/Julia: Vollzeit 40h/week (2024 onwards)
 * - Christine: Teilzeit Mo+Di 4h (2025 onwards)
 * - Tom: 4-day week Mo-Do 10h (2025 onwards)
 * - Klaus: Worked 2025-07 to 2025-12 then terminated
 * - Emma: Weekend worker Sa+So 8h (2025 onwards)
 * - Nina: Started 2026-01-15 (NO historical entries)
 *
 * USES TRANSACTION PATTERN for guaranteed COMMIT in WAL mode!
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/timezone.js';

// Get user IDs
const getUserId = (username: string): number => {
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
  if (!user) throw new Error(`User not found: ${username}`);
  return user.id;
};

logger.info('📅 Adding historical time entries (2024-2025)...\n');

// ============================================================================
// TRANSACTION: All INSERTs in one atomic operation
// ============================================================================

const addHistoricalEntries = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // Helper function for adding entries (inside transaction)
  function addTimeEntry(userId: number, date: string, hours: number, location: 'office' | 'homeoffice' | 'field' = 'office') {
    const startTime = `${date}T08:00:00`;
    const endTime = `${date}T${String(8 + hours).padStart(2, '0')}:00:00`;

    db.prepare(`
      INSERT OR IGNORE INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(userId, date, startTime, endTime, hours, location);
  }

  // Delete existing historical entries first
  const deleted = db.prepare('DELETE FROM time_entries WHERE date < \'2026-01-01\'').run();
  logger.info(`🗑️  Deleted ${deleted.changes} existing historical entries`);

  // Full-time users (40h/week = 8h/day Mon-Fri)
  const fullTimeUsers = [
    { id: getUserId('test.vollzeit'), name: 'Max', since: '2024-01-01' },
    { id: getUserId('test.overtime-plus'), name: 'Peter', since: '2024-01-01' },
    { id: getUserId('test.overtime-minus'), name: 'Laura', since: '2024-01-01' },
    { id: getUserId('test.unpaid'), name: 'Sarah', since: '2024-01-01' },
    { id: getUserId('test.complex'), name: 'Julia', since: '2024-01-01' },
  ];

  fullTimeUsers.forEach(user => {
    logger.info(`Adding entries for ${user.name} (since ${user.since})...`);

    const start = new Date(user.since);
    const end = new Date('2025-12-31');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      const dateStr = formatDate(d, 'yyyy-MM-dd');
      addTimeEntry(user.id, dateStr, 8, 'office');
    }
  });

  // Christine Teilzeit (Mo+Di 4h since 2025-01-01)
  const christineId = getUserId('test.christine');
  logger.info('Adding entries for Christine (Mo+Di 4h since 2025-01-01)...');
  for (let d = new Date('2025-01-01'); d <= new Date('2025-12-31'); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isMonOrTue = dayOfWeek === 1 || dayOfWeek === 2;
    if (!isMonOrTue) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    addTimeEntry(christineId, dateStr, 4, 'homeoffice');
  }

  // Tom 4-day week (Mo-Do 10h since 2025-01-01)
  const tomId = getUserId('test.4day-week');
  logger.info('Adding entries for Tom (Mo-Do 10h since 2025-01-01)...');
  for (let d = new Date('2025-01-01'); d <= new Date('2025-12-31'); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;
    if (!isMonToThu) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    addTimeEntry(tomId, dateStr, 10, 'office');
  }

  // Klaus (worked 2025-07-01 to 2025-12-31)
  const klausId = getUserId('test.terminated');
  logger.info('Adding entries for Klaus (2025-07 to 2025-12)...');
  for (let d = new Date('2025-07-01'); d <= new Date('2025-12-31'); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    addTimeEntry(klausId, dateStr, 8, 'office');
  }

  // Emma Weekend worker (Sa+So 8h since 2025-01-01)
  const emmaId = getUserId('test.weekend');
  logger.info('Adding entries for Emma (Sa+So 8h since 2025-01-01)...');
  for (let d = new Date('2025-01-01'); d <= new Date('2025-12-31'); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    addTimeEntry(emmaId, dateStr, 8, 'office');
  }

  logger.info('✅ Transaction ready to commit');
});

// ============================================================================
// EXECUTE TRANSACTION (commits automatically on success!)
// ============================================================================

try {
  addHistoricalEntries();
  logger.info('💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint to ensure data is written to main DB file
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  logger.info('\n✅ Historical time entries added!');
  logger.info('💡 Now run: npm run recalculate:overtime');

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK executed');
  process.exit(1);
}
