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

/**
 * GLEICHLAUF DER BEIDEN RECHENWEGE BEI overtime_comp UND unpaid
 *
 * WARUM DIESE TESTS EXISTIEREN (Befund
 * .planning/debug/dual-calculation-overtime-comp-unpaid.md):
 * `.planning/phases/14-absicherung-und-auslieferung/14-URTEIL-PHASE-9.1.md`, Abschnitt 7.6,
 * fuehrte die zwei nach dem Vollaufbau verbliebenen Abweichungen (userId 3 und 17) darauf
 * zurueck, dass `updateOvertimeBalanceForMonth()` und
 * `unifiedOvertimeService.calculateDailyOvertime()` `overtime_comp` und `unpaid`
 * UNTERSCHIEDLICH behandelten. Die Nachmessung hat das widerlegt: Beide Wege behandeln alle
 * Abwesenheitsarten identisch (Zeile fuer Zeile verglichen, zusaetzlich Tag fuer Tag
 * auf der Produktionskopie nachgerechnet — dort war die Differenz an JEDEM Tag exakt 0,00).
 * Die tatsaechliche Ursache lag woanders (veraltetes Aggregat des laufenden Monats).
 *
 * Diese Tests halten den widerlegten Verdacht als Regressionsnetz fest: Sie sind heute
 * gruen und werden rot, sobald einer der beiden Wege bei `overtime_comp` oder `unpaid`
 * ausschert. Massstab ist .claude/CLAUDE.md → Ueberstunden-Berechnung:
 *   - Krankheit/Urlaub/Sonderurlaub: zaehlen als gearbeitet (Ist-Gutschrift, Soll bleibt).
 *   - Unbezahlter Urlaub: REDUZIERT das Soll auf 0, gibt KEINE Ist-Gutschrift.
 *   - Ueberstundenausgleich: zehrt den Saldo ab (Soll bleibt, KEINE Ist-Gutschrift).
 *
 * NICHT geprueft wird 'special': Der Code kennt die Art (getCreditType/getAbsenceCredit),
 * die CHECK-Beschraenkung auf absence_requests.type laesst sie aber nicht zu
 * ("type IN ('vacation', 'sick', 'unpaid', 'overtime_comp')"). Ein Testdatensatz mit
 * 'special' wird von der Datenbank abgewiesen — die Art ist heute nicht erreichbar.
 *
 * Juni 2026 ist der Pruefmonat: vollstaendig vergangen (kein Beschnitt auf heute) und ohne
 * gesetzlichen Feiertag in Bayern, damit die Sollstunden nicht durch Feiertage verdeckt
 * werden.
 */
describe('Gleichlauf Aggregat/kanonischer Weg bei allen Abwesenheitsarten (Befund dual-calculation)', () => {
  const MONTH = '2026-06';
  let testUserId: number;

  const approveAbsence = (type: string, date: string): void => {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, 'approved', 1)
    `).run(testUserId, type, date, date);
  };

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role, weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testuser_gleichlauf', 'test@gleichlauf.com', 'Test', 'Gleichlauf', 'hash', 'employee', 25, '2020-01-01');
    testUserId = result.lastInsertRowid as number;
    insertTestWorkPeriod(testUserId, { validFrom: '2020-01-01', weeklyHours: 25 });
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
  });

  /** Liest das vom Rebuild geschriebene Monatsaggregat. */
  const aggregate = (): { targetHours: number; actualHours: number } => {
    const row = db
      .prepare('SELECT targetHours, actualHours FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(testUserId, MONTH) as { targetHours: number; actualHours: number } | undefined;
    return { targetHours: row?.targetHours ?? 0, actualHours: row?.actualHours ?? 0 };
  };

  it.each([
    ['vacation', '2026-06-10'],
    ['sick', '2026-06-11'],
    ['overtime_comp', '2026-06-15'],
    ['unpaid', '2026-06-16'],
  ])('Aggregat und kanonischer Weg stimmen bei Abwesenheitsart %s ueberein', (type, date) => {
    approveAbsence(type, date);

    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);

    const agg = aggregate();
    const canonical = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, MONTH);

    expect(agg.targetHours).toBeCloseTo(canonical.targetHours, 2);
    expect(agg.actualHours).toBeCloseTo(canonical.actualHours, 2);
    expect(agg.actualHours - agg.targetHours).toBeCloseTo(canonical.overtime, 2);
  });

  it('alle Abwesenheitsarten gleichzeitig im selben Monat: beide Wege bleiben deckungsgleich', () => {
    approveAbsence('vacation', '2026-06-10');
    approveAbsence('sick', '2026-06-11');
    approveAbsence('overtime_comp', '2026-06-15');
    approveAbsence('unpaid', '2026-06-16');

    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);

    const agg = aggregate();
    const canonical = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, MONTH);

    expect(agg.targetHours).toBeCloseTo(canonical.targetHours, 2);
    expect(agg.actualHours).toBeCloseTo(canonical.actualHours, 2);
  });

  it('unbezahlter Urlaub senkt das Soll um genau einen Arbeitstag und gibt keine Ist-Gutschrift (CLAUDE.md)', () => {
    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);
    const ohne = aggregate();

    approveAbsence('unpaid', '2026-06-16'); // Dienstag, Werktag
    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);
    const mit = aggregate();

    // 25h/Woche / 5 Werktage = 5h Soll an diesem Tag; Soll faellt weg, Ist bleibt unveraendert.
    expect(ohne.targetHours - mit.targetHours).toBeCloseTo(5, 2);
    expect(mit.actualHours).toBeCloseTo(ohne.actualHours, 2);
  });

  it('Ueberstundenausgleich laesst das Soll stehen und gibt keine Ist-Gutschrift — der Tag zehrt den Saldo ab (REQ-19)', () => {
    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);
    const ohne = aggregate();

    approveAbsence('overtime_comp', '2026-06-15'); // Montag, Werktag
    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);
    const mit = aggregate();

    expect(mit.targetHours).toBeCloseTo(ohne.targetHours, 2); // Soll unveraendert
    expect(mit.actualHours).toBeCloseTo(ohne.actualHours, 2); // keine Gutschrift
  });
});

/**
 * WR-02, D-12 (09-REVIEW.md:197-209): `handleAbsenceDay()` und
 * `updateOvertimeBalanceForMonth()` sind modulprivat — dieser Block prueft sie deshalb
 * ausschliesslich ueber den einzigen exportierten Einstieg `rebuildOvertimeTransactionsForMonth()`.
 *
 * Fixtures werden pro Test frisch angelegt und nicht von development.db-Bestandsdaten
 * abgeleitet (WR-07-Vermeidung, D-13): eigener Nutzer, eigene Periode ueber
 * `insertTestWorkPeriod()`, keine `time_entries` aus dem Bestand.
 *
 * Fachliche Quelle: REQ-19 / 09-REVIEW.md:197-209 — `overtime_comp` wird aus dem
 * Ueberstundenkonto selbst bezahlt und darf deshalb KEINE zweite, neutralisierende
 * Journalzeile erhalten (im Gegensatz zu vacation/sick/special und unpaid).
 */
describe('handleAbsenceDay / updateOvertimeBalanceForMonth — overtime_comp isoliert (WR-02, D-12)', () => {
  let testUserId: number;
  const MONTH = '2026-05';
  const ABSENCE_DATE = '2026-05-12'; // Dienstag, Werktag, kein Feiertag (siehe Plan-Interfaces-Block)

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_rebuild_otcomp',
      'test@rebuildotcomp.com',
      'Test',
      'RebuildOtComp',
      'hash',
      'employee',
      40, // 40h / 5 Tage = 8h/Werktag
      '2026-01-01'
    );
    testUserId = result.lastInsertRowid as number;

    insertTestWorkPeriod(testUserId, { validFrom: '2026-01-01', weeklyHours: 40 });
    // Keine time_entries: der gesamte Monat bleibt ohne Ist-Stunden, das isoliert die
    // Wirkung des einen Abwesenheitstags.
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
  });

  /**
   * Legt einen genehmigten Abwesenheitsantrag des uebergebenen Typs fuer einen Tag an,
   * fuehrt den Rebuild fuer MONTH aus und liefert die Journalzeilen des Tages sowie die
   * Monatszeile aus overtime_balance zurueck.
   */
  function runAbsenceDay(type: string, date: string) {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, 'approved', 1)
    `).run(testUserId, type, date, date);

    rebuildOvertimeTransactionsForMonth(testUserId, MONTH);

    const transactions = db.prepare(`
      SELECT type, hours, referenceType, description
      FROM overtime_transactions
      WHERE userId = ? AND date = ?
    `).all(testUserId, date) as Array<{
      type: string;
      hours: number;
      referenceType: string | null;
      description: string;
    }>;

    const balance = db.prepare(`
      SELECT targetHours, actualHours FROM overtime_balance WHERE userId = ? AND month = ?
    `).get(testUserId, MONTH) as { targetHours: number; actualHours: number } | undefined;

    return { transactions, balance };
  }

  it('overtime_comp erzeugt genau eine Journalzeile und keine Gutschrift', () => {
    const { transactions } = runAbsenceDay('overtime_comp', ABSENCE_DATE);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('time_entry');
    expect(transactions[0].hours).toBe(-8);
    expect(transactions[0].referenceType).toBe('absence');
    expect(transactions[0].description).toBe('Abwesenheit (overtime_comp): Soll/Ist-Differenz');

    const creditRows = db.prepare(`
      SELECT id FROM overtime_transactions
      WHERE userId = ? AND type = 'overtime_comp_credit' AND date LIKE ?
    `).all(testUserId, `${MONTH}-%`);
    expect(creditRows).toHaveLength(0);
  });

  it('Gegenprobe vacation: der Test erreicht handleAbsenceDay() tatsaechlich (zwei Zeilen, Gutschrift)', () => {
    const { transactions } = runAbsenceDay('vacation', ABSENCE_DATE);

    expect(transactions).toHaveLength(2);

    const earned = transactions.find(t => t.type === 'time_entry');
    const credit = transactions.find(t => t.type === 'vacation_credit');

    expect(earned).toBeDefined();
    expect(earned!.hours).toBe(-8);
    expect(credit).toBeDefined();
    expect(credit!.hours).toBe(8);
    expect(credit!.description.startsWith('Urlaubs-Gutschrift')).toBe(true);
  });

  it('updateOvertimeBalanceForMonth behandelt overtime_comp, vacation und unpaid unterschiedlich (Differenzen, nicht absolute Monatssummen)', () => {
    function cleanupDay(): void {
      db.prepare('DELETE FROM absence_requests WHERE userId = ? AND startDate = ?').run(testUserId, ABSENCE_DATE);
      db.prepare('DELETE FROM overtime_transactions WHERE userId = ? AND date LIKE ?').run(testUserId, `${MONTH}-%`);
      db.prepare('DELETE FROM overtime_balance WHERE userId = ? AND month = ?').run(testUserId, MONTH);
    }

    const otComp = runAbsenceDay('overtime_comp', ABSENCE_DATE).balance;
    cleanupDay();

    const vacation = runAbsenceDay('vacation', ABSENCE_DATE).balance;
    cleanupDay();

    const unpaid = runAbsenceDay('unpaid', ABSENCE_DATE).balance;
    cleanupDay();

    expect(otComp).toBeDefined();
    expect(vacation).toBeDefined();
    expect(unpaid).toBeDefined();

    // overtime_comp reduziert das Soll NICHT — targetHours gleich wie bei vacation.
    expect(otComp!.targetHours).toBeCloseTo(vacation!.targetHours, 2);
    // unbezahlter Urlaub reduziert das Soll um die Sollstunden des Tages (8h).
    expect(unpaid!.targetHours).toBeCloseTo(otComp!.targetHours - 8, 2);
    // nur vacation schreibt eine Ist-Gutschrift (+8h gegenueber overtime_comp).
    expect(vacation!.actualHours).toBeCloseTo(otComp!.actualHours + 8, 2);
    // unpaid schreibt keine Ist-Gutschrift — actualHours identisch zu overtime_comp.
    expect(unpaid!.actualHours).toBeCloseTo(otComp!.actualHours, 2);
  });
});
