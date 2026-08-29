import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { ensureAbsenceTransactions, ensureOvertimeBalanceEntries } from './overtimeService.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';

/**
 * OVERTIME SERVICE TESTS (WR-02, 09-REVIEW.md)
 *
 * overtimeService.ts hatte vor Plan 09-05 keine eigene Testdatei, obwohl es einen aktiven,
 * schreibenden API-Pfad enthaelt: GET /api/overtime/transactions/monthly-summary
 * (routes/overtime.ts:556) -> ensureDailyOvertimeTransactions() (:781, aufgerufen :610) ->
 * ensureAbsenceTransactions() (:1236) -> :1331 erzeugte bislang eine positive
 * overtime_comp_credit-Zeile bei einem GET-Zugriff (09-INVENTAR-KREDITIERUNG.md #7).
 *
 * Fixtures werden pro Test frisch angelegt und nicht von development.db-Bestandsdaten
 * abgeleitet (WR-07-Vermeidung).
 */
describe('ensureAbsenceTransactions — REQ-19 Schreibpfad', () => {
  let testUserId: number;

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_overtimesvc',
      'test@overtimesvc.com',
      'Test',
      'OvertimeSvc',
      'hash',
      'employee',
      20, // 20h / 5 Tage = 4h/Tag
      '2026-01-01'
    );
    testUserId = result.lastInsertRowid as number;

    // D4: ohne eine Periode ab hireDate wirft getDailyTargetHours() MissingWorkPeriodError.
    // Dieselben Werte wie im INSERT INTO users oben.
    insertTestWorkPeriod(testUserId, { validFrom: '2026-01-01', weeklyHours: 20 });
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
  });

  it('schreibt fuer einen genehmigten overtime_comp-Tag keine overtime_comp_credit-Zeile', async () => {
    // Dienstag, 13.01.2026 — Werktag, kein Feiertag
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'overtime_comp', '2026-01-13', '2026-01-13', 'approved', 1);

    await ensureAbsenceTransactions(testUserId, '2026-01', '2026-01');

    const creditRows = db.prepare(`
      SELECT * FROM overtime_transactions WHERE userId = ? AND type = 'overtime_comp_credit'
    `).all(testUserId);

    expect(creditRows).toEqual([]);
  });

  it('schreibt fuer einen genehmigten vacation-Tag weiterhin eine vacation_credit-Zeile (Gegenfall, unveraendertes Verhalten)', async () => {
    // Mittwoch, 14.01.2026 — Werktag, kein Feiertag
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'vacation', '2026-01-14', '2026-01-14', 'approved', 1);

    await ensureAbsenceTransactions(testUserId, '2026-01', '2026-01');

    const creditRows = db.prepare(`
      SELECT * FROM overtime_transactions WHERE userId = ? AND type = 'vacation_credit'
    `).all(testUserId) as Array<{ date: string; hours: number; referenceId: number | null }>;

    expect(creditRows).toHaveLength(1);
    expect(creditRows[0].date).toBe('2026-01-14');
    expect(creditRows[0].hours).toBe(4);
  });

  it('ist idempotent: ein zweiter Aufruf im selben Monat erzeugt fuer overtime_comp weiterhin keine Zeile', async () => {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'overtime_comp', '2026-01-13', '2026-01-13', 'approved', 1);

    await ensureAbsenceTransactions(testUserId, '2026-01', '2026-01');
    await ensureAbsenceTransactions(testUserId, '2026-01', '2026-01');

    const creditRows = db.prepare(`
      SELECT * FROM overtime_transactions WHERE userId = ? AND type = 'overtime_comp_credit'
    `).all(testUserId);

    expect(creditRows).toEqual([]);
  });

  it('mehrtaegiger Urlaub bis zum letzten Kalendertag des Monats erhaelt eine Gutschrift auch fuer diesen letzten Tag (Monatsend-Off-by-one, Task 4)', async () => {
    // Mittwoch 15.07.2026 bis Freitag 31.07.2026 (Monatsende) — beide Werktage, kein Feiertag.
    // Wie im Rebuild-Dienst (overtimeTransactionRebuildService.ts) parst new Date(absence.startDate)
    // ein ISO-Datum ohne Zeitanteil als UTC-Mitternacht; in Europe/Berlin (Sommerzeit) ist das
    // 02:00 lokal. Weil absenceStart (aus absence.startDate abgeleitet) diesen Zeitanteil traegt,
    // absenceEnd (haeufig aus dem korrekt lokal gebildeten effectiveEndDate) aber nicht, bricht
    // die Tagesschleife einen Tag zu frueh ab, sobald eine Abwesenheit bis zum Monatsende reicht.
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'vacation', '2026-07-15', '2026-07-31', 'approved', 13);

    await ensureAbsenceTransactions(testUserId, '2026-07', '2026-07');

    const creditRows = db.prepare(`
      SELECT date FROM overtime_transactions WHERE userId = ? AND type = 'vacation_credit'
    `).all(testUserId) as Array<{ date: string }>;

    expect(creditRows.map(r => r.date)).toContain('2026-07-31');
  });
});

/**
 * ENSURE OVERTIME BALANCE ENTRIES — kanonischer Aufrufer des Nachtlaufs (WR-02, D-12)
 *
 * ensureOvertimeBalanceEntries() ist der Einstieg, den der bisherige fix-overtime.ts-
 * Nachtlauf aufruft und den der In-Prozess-Scheduler aus Plan 09.1-04 uebernehmen wird.
 * Fixtures werden pro Test frisch angelegt (D-13), nicht von development.db-Bestandsdaten
 * abgeleitet.
 */
describe('ensureOvertimeBalanceEntries — kanonischer Aufrufer des Nachtlaufs (WR-02, D-12)', () => {
  let testUserId: number;

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_ensurebalance',
      'test@ensurebalance.com',
      'Test',
      'EnsureBalance',
      'hash',
      'employee',
      40,
      '2026-03-10'
    );
    testUserId = result.lastInsertRowid as number;

    insertTestWorkPeriod(testUserId, { validFrom: '2026-03-10', weeklyHours: 40 });
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(testUserId);

    const remaining = db.prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
      .get(testUserId) as { count: number };
    expect(remaining.count).toBe(0);
  });

  it('erzeugt eine lueckenlose Monatskette ab dem Einstellungsmonat', async () => {
    await ensureOvertimeBalanceEntries(testUserId, '2026-05');

    const rows = db.prepare(`
      SELECT month FROM overtime_balance WHERE userId = ? ORDER BY month ASC
    `).all(testUserId) as Array<{ month: string }>;

    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.month)).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('ist idempotent: ein zweiter Aufruf veraendert weder Zeilenzahl noch Werte', async () => {
    await ensureOvertimeBalanceEntries(testUserId, '2026-05');

    const before = db.prepare(`
      SELECT month, targetHours, actualHours FROM overtime_balance WHERE userId = ? ORDER BY month ASC
    `).all(testUserId) as Array<{ month: string; targetHours: number; actualHours: number }>;

    await ensureOvertimeBalanceEntries(testUserId, '2026-05');

    const after = db.prepare(`
      SELECT month, targetHours, actualHours FROM overtime_balance WHERE userId = ? ORDER BY month ASC
    `).all(testUserId) as Array<{ month: string; targetHours: number; actualHours: number }>;

    expect(after).toHaveLength(3);
    expect(after).toEqual(before);
  });

  it('bricht bei unbekanntem Nutzer klar mit "User not found:" ab', async () => {
    const maxId = db.prepare('SELECT MAX(id) as maxId FROM users').get() as { maxId: number };
    const unknownUserId = maxId.maxId + 100000;

    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(unknownUserId);
    expect(exists).toBeUndefined();

    await expect(ensureOvertimeBalanceEntries(unknownUserId, '2026-05')).rejects.toThrow('User not found:');
  });
});
