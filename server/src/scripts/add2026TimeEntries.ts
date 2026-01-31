/**
 * Add 2026 Time Entries to Test Users
 * Makes testing more realistic by adding some worked hours in 2026
 *
 * USES TRANSACTION PATTERN for guaranteed COMMIT in WAL mode!
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

logger.info('📅 Adding 2026 time entries to test users...');

// ============================================================================
// TRANSACTION: All INSERTs in one atomic operation
// ============================================================================

const add2026Entries = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // Helper function for adding entries (inside transaction)
  function addTimeEntry(userId: number, date: string, hours: number, location: 'office' | 'homeoffice' | 'field' = 'office') {
    const startTime = `${date}T08:00:00`;
    const endTime = `${date}T${String(8 + hours).padStart(2, '0')}:00:00`;

    db.prepare(`
      INSERT INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(userId, date, startTime, endTime, hours, location);
  }

  // Get actual user IDs (they might have changed after clean+seed)
  const getUserId = (username: string): number => {
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
    if (!user) {
      throw new Error(`User not found: ${username}`);
    }
    return user.id;
  };

  const maxId = getUserId('test.vollzeit');
  const christineId = getUserId('test.christine');
  const peterId = getUserId('test.overtime-plus');
  const lauraId = getUserId('test.overtime-minus');
  const sarahId = getUserId('test.unpaid');
  const tomId = getUserId('test.4day-week');
  const juliaId = getUserId('test.complex');
  const ninaId = getUserId('test.new2026');
  const klausId = getUserId('test.terminated');
  const emmaId = getUserId('test.weekend');

  logger.info(`User IDs: Max=${maxId}, Christine=${christineId}, Peter=${peterId}, Laura=${lauraId}, Sarah=${sarahId}, Tom=${tomId}, Julia=${juliaId}, Nina=${ninaId}, Klaus=${klausId}, Emma=${emmaId}\n`);

  // User: Max Vollzeit (40h/week)
  logger.info(`Adding entries for User ${maxId}: Max Vollzeit`);
  addTimeEntry(maxId, '2026-01-02', 8, 'office');  // Friday
  addTimeEntry(maxId, '2026-01-05', 8, 'office');  // Monday
  addTimeEntry(maxId, '2026-01-07', 8, 'office');  // Wednesday

  // User: Christine Teilzeit (workSchedule: Mon+Tue 4h)
  logger.info(`Adding entries for User ${christineId}: Christine Teilzeit`);
  addTimeEntry(christineId, '2026-01-05', 4, 'homeoffice');  // Monday
  addTimeEntry(christineId, '2026-01-13', 4, 'office');      // Tuesday

  // User: Peter Fleißig (positive overtime)
  logger.info(`Adding entries for User ${peterId}: Peter Fleißig`);
  addTimeEntry(peterId, '2026-01-02', 10, 'office');  // Friday + overtime
  addTimeEntry(peterId, '2026-01-05', 10, 'office');  // Monday + overtime
  addTimeEntry(peterId, '2026-01-07', 9, 'office');   // Wednesday + overtime

  // User: Laura Weniger (negative overtime)
  logger.info(`Adding entries for User ${lauraId}: Laura Weniger`);
  addTimeEntry(lauraId, '2026-01-02', 4, 'office');  // Friday (halbtags)
  addTimeEntry(lauraId, '2026-01-05', 6, 'office');  // Monday (wenig)

  // User: Sarah Unbezahlt
  logger.info(`Adding entries for User ${sarahId}: Sarah Unbezahlt`);
  addTimeEntry(sarahId, '2026-01-02', 8, 'office');
  addTimeEntry(sarahId, '2026-01-05', 8, 'office');

  // User: Tom Viertage (4-day week: Mon-Thu 10h)
  logger.info(`Adding entries for User ${tomId}: Tom Viertage`);
  addTimeEntry(tomId, '2026-01-05', 10, 'office');  // Monday
  addTimeEntry(tomId, '2026-01-07', 10, 'office');  // Wednesday
  addTimeEntry(tomId, '2026-01-08', 10, 'office');  // Thursday

  // User: Julia Komplex
  logger.info(`Adding entries for User ${juliaId}: Julia Komplex`);
  addTimeEntry(juliaId, '2026-01-02', 8, 'office');
  addTimeEntry(juliaId, '2026-01-05', 8, 'homeoffice');

  // User: Nina Neuling (hired 2026-01-15)
  logger.info(`Adding entries for User ${ninaId}: Nina Neuling`);
  addTimeEntry(ninaId, '2026-01-15', 8, 'office');  // First day!
  addTimeEntry(ninaId, '2026-01-16', 8, 'office');

  // User: Klaus Ausgeschieden - NO 2026 entries (terminated!)
  logger.info(`Skipping User ${klausId}: Klaus Ausgeschieden (terminated)`);

  // User: Emma Wochenende (weekend worker: Sat+Sun)
  logger.info(`Adding entries for User ${emmaId}: Emma Wochenende`);
  addTimeEntry(emmaId, '2026-01-04', 8, 'office');  // Saturday
  addTimeEntry(emmaId, '2026-01-05', 8, 'office');  // Sunday
  addTimeEntry(emmaId, '2026-01-11', 8, 'office');  // Saturday
  addTimeEntry(emmaId, '2026-01-18', 8, 'office');  // Saturday

  logger.info('✅ Transaction ready to commit');
});

// ============================================================================
// EXECUTE TRANSACTION (commits automatically on success!)
// ============================================================================

try {
  add2026Entries();
  logger.info('💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint to ensure data is written to main DB file
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  logger.info('\n✅ 2026 time entries added successfully!');
  logger.info('💡 Now recalculate overtime balances with: ensureOvertimeBalanceEntries()');

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK executed');
  process.exit(1);
}
