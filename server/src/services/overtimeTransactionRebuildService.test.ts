import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

/**
 * OVERTIME TRANSACTION REBUILD SERVICE TESTS (WR-02, 09-REVIEW.md)
 *
 * overtimeTransactionRebuildService.ts hatte vor Plan 09-05 keine eigene Testdatei, obwohl
 * es einen aktiven Schreibpfad enthaelt (aufgerufen von overtimeService.ts:478,512 ueber
 * updateMonthlyOvertime()) und den Monatsend-Off-by-one-Fehler (09-INVENTAR-KREDITIERUNG.md,
 * 09-05-PLAN.md Task 4): new Date(month + '-01') parst als UTC-Mitternacht, in
 * Europe/Berlin also 02:00 (Sommer) bzw. 01:00 (Winter) lokal. Die Tagesschleife
 * (collectDailyCalculations) bricht dadurch einen Tag vor Monatsende ab.
 *
 * Fixtures werden pro Test frisch angelegt (WR-07-Vermeidung), keine Abhaengigkeit von
 * development.db-Bestandsdaten. Juli 2026 (Sommerzeit, UTC+2) und Februar 2026
 * (Winterzeit, UTC+1, 28 Tage, kein Schaltjahr) decken beide Zeitzonen-Offsets ab.
 */
describe('rebuildOvertimeTransactionsForMonth — Monatsend-Off-by-one (Plan 09-05 Task 4)', () => {
  let testUserId: number;

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_rebuildmonth',
      'test@rebuildmonth.com',
      'Test',
      'RebuildMonth',
      'hash',
      'employee',
      25, // 25h / 5 Tage = 5h/Werktag
      '2026-01-01'
    );
    testUserId = result.lastInsertRowid as number;
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
  });

  it('erfasst alle 31 Kalendertage im Juli 2026 (Sommerzeit, UTC+2), inkl. des letzten Tages', () => {
    rebuildOvertimeTransactionsForMonth(testUserId, '2026-07');

    const dates = db.prepare(`
      SELECT DISTINCT date FROM overtime_transactions
      WHERE userId = ? AND date BETWEEN '2026-07-01' AND '2026-07-31'
    `).all(testUserId) as Array<{ date: string }>;

    expect(dates).toHaveLength(31);
    expect(dates.map(d => d.date)).toContain('2026-07-31');
  });

  it('erfasst alle 28 Kalendertage im Februar 2026 (Winterzeit, UTC+1), inkl. des letzten Tages', () => {
    rebuildOvertimeTransactionsForMonth(testUserId, '2026-02');

    const dates = db.prepare(`
      SELECT DISTINCT date FROM overtime_transactions
      WHERE userId = ? AND date BETWEEN '2026-02-01' AND '2026-02-28'
    `).all(testUserId) as Array<{ date: string }>;

    expect(dates).toHaveLength(28);
    expect(dates.map(d => d.date)).toContain('2026-02-28');
  });

  it('targetHours-Summe in overtime_balance stimmt nach dem Rebuild mit unifiedOvertimeService.calculateMonthlyOvertime() ueberein', () => {
    rebuildOvertimeTransactionsForMonth(testUserId, '2026-07');

    const balanceRow = db.prepare(`
      SELECT targetHours FROM overtime_balance WHERE userId = ? AND month = ?
    `).get(testUserId, '2026-07') as { targetHours: number } | undefined;

    const unifiedResult = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-07');

    expect(balanceRow).toBeDefined();
    expect(balanceRow!.targetHours).toBe(unifiedResult.targetHours);
  });

  it('overtime_comp-Tag erzeugt weiterhin genau eine earned-Buchung mit -targetHours und keine Gutschrift (Regression, REQ-19)', () => {
    // Mittwoch, 15.07.2026 — Werktag, kein Feiertag (siehe SQL-Pruefung bei Testerstellung)
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'overtime_comp', '2026-07-15', '2026-07-15', 'approved', 1);

    rebuildOvertimeTransactionsForMonth(testUserId, '2026-07');

    const rows = db.prepare(`
      SELECT type, hours FROM overtime_transactions
      WHERE userId = ? AND date = '2026-07-15'
    `).all(testUserId) as Array<{ type: string; hours: number }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('time_entry');
    expect(rows[0].hours).toBe(-5); // 25h/5 Tage = 5h Sollstunden an diesem Werktag
  });
});
