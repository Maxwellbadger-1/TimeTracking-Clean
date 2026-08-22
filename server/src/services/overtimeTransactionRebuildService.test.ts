import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../database/connection.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import * as workPeriodService from './workPeriodService.js';

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

    // Plan 11-05: getDailyTargetHours loest seit Plan 11-04 ausschliesslich ueber
    // user_work_periods auf. Ohne diese Periode wuerfe collectDailyCalculations()
    // MissingWorkPeriodError.
    insertTestWorkPeriod(testUserId, { validFrom: '2026-01-01', weeklyHours: 25 });
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

/**
 * Plan 11-05, Task 2: Der Rebuild wird periodenbewusst (D1, REQ-24).
 *
 * Eigene Testnutzer mit Praefix `t1105-` (parallel work prohibition): mehrere
 * Executor-Agenten arbeiten gleichzeitig auf derselben Arbeitsdatenbank
 * (server/database/development.db). Jeder hier angelegte Nutzer wird ueber `finally`
 * unmittelbar wieder entfernt; der Aufraeumnachweis am Dateiende prueft das maschinell.
 */
describe('Plan 11-05: Periodenbewusster Rebuild (D1, REQ-24)', () => {
  const createdUserIds: number[] = [];

  function createT1105User(suffix: string, weeklyHours: number, hireDate: string): number {
    // WR-14: Zufallsanteil wie in den übrigen Testdateien (`createT1107User()` in
    // absencePeriodAwareness.test.ts, `createTestUser()` in workPeriodService.test.ts).
    // Vorher war der Benutzername FEST — nach einem abgebrochenen Lauf scheiterte der
    // nächste an der UNIQUE-Bedingung, und der Aufräumnachweis am Dateiende schlug fehl.
    // Das `t1105-`-Präfix bleibt, damit der Aufräumnachweis (`LIKE 't1105-%'`) weiter greift.
    const username = `t1105-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
    const result = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, `${username}@test.local`, 'T1105', suffix, 'hash', 'employee', weeklyHours, hireDate);
    const userId = result.lastInsertRowid as number;
    createdUserIds.push(userId);
    return userId;
  }

  function cleanupT1105User(userId: number): void {
    // Cascade (ON DELETE CASCADE, Migration 008) raeumt user_work_periods mit ab.
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  }

  /** Kanonisch sortierte JSON-Darstellung fuer den REQ-24-Idempotenzvergleich. */
  function captureRebuildSnapshot(userId: number, month: string) {
    const transactions = db.prepare(`
      SELECT date, type, hours, balanceBefore, balanceAfter, referenceType, referenceId
      FROM overtime_transactions
      WHERE userId = ? AND date LIKE ?
      ORDER BY date ASC, type ASC, id ASC
    `).all(userId, `${month}-%`);

    const balance = db.prepare(`
      SELECT targetHours, actualHours FROM overtime_balance WHERE userId = ? AND month = ?
    `).get(userId, month);

    return JSON.stringify({ transactions, balance });
  }

  it('schreibt fuer Tage vor dem Stichtag die alten und ab dem Stichtag die neuen Sollstunden (Periodenwechsel mitten im Monat)', () => {
    const userId = createT1105User('periodenwechsel', 40, '2026-01-01');

    try {
      insertTestWorkPeriod(userId, { validFrom: '2026-01-01', validTo: '2026-07-15', weeklyHours: 40 });
      insertTestWorkPeriod(userId, { validFrom: '2026-07-15', weeklyHours: 20 });

      rebuildOvertimeTransactionsForMonth(userId, '2026-07');

      const day14 = db.prepare(`
        SELECT hours FROM overtime_transactions WHERE userId = ? AND date = ? AND type = 'time_entry'
      `).get(userId, '2026-07-14') as { hours: number } | undefined;
      const day15 = db.prepare(`
        SELECT hours FROM overtime_transactions WHERE userId = ? AND date = ? AND type = 'time_entry'
      `).get(userId, '2026-07-15') as { hours: number } | undefined;

      expect(day14?.hours).toBe(-8); // 0 Ist - 8h Soll (40h/5, vor dem Stichtag)
      expect(day15?.hours).toBe(-4); // 0 Ist - 4h Soll (20h/5, ab dem Stichtag)
    } finally {
      cleanupT1105User(userId);
    }
  });

  it('REQ-24: zweimal hintereinander ausgefuehrter Rebuild desselben Monats liefert denselben Datenbestand (maschineller Vergleich)', () => {
    const userId = createT1105User('idempotenz', 40, '2026-01-01');

    try {
      insertTestWorkPeriod(userId, { validFrom: '2026-01-01', weeklyHours: 40 });

      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, '2026-07-13', '08:00', '18:00', 0, 10, 'office');
      db.prepare(`
        INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, 'vacation', '2026-07-16', '2026-07-16', 'approved', 1);

      rebuildOvertimeTransactionsForMonth(userId, '2026-07');
      const snapshot1 = captureRebuildSnapshot(userId, '2026-07');

      rebuildOvertimeTransactionsForMonth(userId, '2026-07');
      const snapshot2 = captureRebuildSnapshot(userId, '2026-07');

      expect(snapshot2).toBe(snapshot1);
      expect(JSON.parse(snapshot1).transactions.length).toBeGreaterThan(0);
    } finally {
      cleanupT1105User(userId);
    }
  });

  it('D1: der Rebuild laedt die Perioden des Nutzers genau einmal je Lauf, nicht einmal je Tag', () => {
    const userId = createT1105User('zaehlernachweis', 40, '2026-01-01');

    try {
      insertTestWorkPeriod(userId, { validFrom: '2026-01-01', weeklyHours: 40 });

      const spy = vi.spyOn(workPeriodService, 'getWorkPeriods');
      spy.mockClear();

      rebuildOvertimeTransactionsForMonth(userId, '2026-07');

      // Juli 2026 hat 31 Tage — bei einem Aufruf je Tag stuenden hier 31, nicht 1.
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    } finally {
      cleanupT1105User(userId);
    }
  });

  it('Aufraeumnachweis: kein Testnutzer mit Praefix t1105- bleibt in users, user_work_periods, time_entries, overtime_transactions oder overtime_balance zurueck', () => {
    expect(createdUserIds.length).toBeGreaterThan(0);

    const leftoverUsers = db.prepare(`SELECT id FROM users WHERE username LIKE 't1105-%'`).all();
    expect(leftoverUsers).toHaveLength(0);

    for (const userId of createdUserIds) {
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM user_work_periods WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM time_entries WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM overtime_transactions WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT userId FROM overtime_balance WHERE userId = ?').get(userId)).toBeUndefined();
    }
  });
});
