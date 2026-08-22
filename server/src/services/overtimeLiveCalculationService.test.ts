import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  getAllWorkingDaysBetween,
  calculateLiveOvertimeTransactions,
  calculateCurrentOvertimeBalance,
} from './overtimeLiveCalculationService.js';
import type { UserPublic, WorkSchedule } from '../types/index.js';
import { stubWorkPeriodContext, insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import type { WorkPeriodContext } from './workPeriodContext.js';
import { createTransaction } from './overtimeTransactionManager.js';

/**
 * Regressionsnetz gegen den Rückfall in eine eigene Arbeitstags-Entscheidung (REQ-17).
 *
 * getAllWorkingDaysBetween() darf nach der Umstellung nicht mehr selbst über Wochentage
 * entscheiden — jeder Tag muss über getDailyTargetHours() aufgelöst werden
 * (server/src/utils/workingDays.ts:63). Diese Tests fixieren das erwartete Verhalten,
 * insbesondere den Samstag-Fall, der vor der Umstellung verloren ging.
 */
describe('getAllWorkingDaysBetween', () => {
  function buildUser(overrides: Partial<UserPublic>): UserPublic {
    return {
      id: 999,
      username: 'test',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'employee',
      department: null,
      position: null,
      weeklyHours: 40,
      workSchedule: null,
      vacationDaysPerYear: 30,
      hireDate: '2020-01-01',
      endDate: null,
      status: 'active',
      privacyConsentAt: null,
      createdAt: '2020-01-01',
      ...overrides,
    } as UserPublic;
  }

  // getDailyTargetHours() liest weeklyHours/workSchedule nicht mehr vom user-Objekt (D3) —
  // die Werte müssen über einen WorkPeriodContext aufgelöst werden. stubWorkPeriodContext()
  // baut hier eine einzelne, seit 2020-01-01 laufende Periode mit denselben Werten, die
  // buildUser() vorher direkt im user-Objekt trug.
  function buildPeriods(overrides: { weeklyHours?: number; workSchedule?: WorkSchedule | null } = {}): WorkPeriodContext {
    return stubWorkPeriodContext([
      {
        userId: 999,
        validFrom: '2020-01-01',
        weeklyHours: overrides.weeklyHours ?? 40,
        workSchedule: overrides.workSchedule ?? null,
      },
    ]);
  }

  it('nimmt den Samstag eines workSchedule-Nutzers in die Rückgabe auf', () => {
    const user = buildUser({
      workSchedule: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 4,
        sunday: 0,
      },
    });

    // Montag 2026-05-04 bis Sonntag 2026-05-10 (holidayfreie Woche)
    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user, buildPeriods({
      workSchedule: user.workSchedule,
    }));

    expect(days).toContain('2026-05-09'); // Samstag
  });

  it('lässt einen 0-Stunden-Wochentag im workSchedule aus', () => {
    const user = buildUser({
      workSchedule: {
        monday: 8,
        tuesday: 8,
        wednesday: 0,
        thursday: 8,
        friday: 8,
        saturday: 0,
        sunday: 0,
      },
    });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user, buildPeriods({
      workSchedule: user.workSchedule,
    }));

    expect(days).not.toContain('2026-05-06'); // Mittwoch
    expect(days).toEqual(['2026-05-04', '2026-05-05', '2026-05-07', '2026-05-08']);
  });

  it('nimmt ohne workSchedule Montag bis Freitag auf, aber nicht das Wochenende', () => {
    const user = buildUser({ workSchedule: null, weeklyHours: 40 });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user, buildPeriods({
      workSchedule: null,
      weeklyHours: 40,
    }));

    expect(days).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ]);
  });

  it('liefert für einen Aushilfsnutzer ohne workSchedule und weeklyHours=0 keinen Tag', () => {
    const user = buildUser({ workSchedule: null, weeklyHours: 0 });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user, buildPeriods({
      workSchedule: null,
      weeklyHours: 0,
    }));

    expect(days).toEqual([]);
  });

  it('schließt einen Feiertag aus, selbst wenn workSchedule an diesem Wochentag Stunden vorsieht', () => {
    // 2026-05-01 (Erster Mai) ist ein Freitag und steht nachweislich in der holidays-Tabelle
    // der Entwicklungsdatenbank (verifiziert per SQL vor Testerstellung).
    const userWithSchedule = buildUser({
      workSchedule: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 0,
        sunday: 0,
      },
    });
    const userWithoutSchedule = buildUser({ workSchedule: null, weeklyHours: 40 });

    expect(getAllWorkingDaysBetween(
      '2026-05-01', '2026-05-01', userWithSchedule,
      buildPeriods({ workSchedule: userWithSchedule.workSchedule })
    )).toEqual([]);
    expect(getAllWorkingDaysBetween(
      '2026-05-01', '2026-05-01', userWithoutSchedule,
      buildPeriods({ workSchedule: null, weeklyHours: 40 })
    )).toEqual([]);
  });

  it('liefert den Rückgabewert chronologisch aufsteigend und ohne Duplikate', () => {
    const user = buildUser({ workSchedule: null, weeklyHours: 40 });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user, buildPeriods({
      workSchedule: null,
      weeklyHours: 40,
    }));

    const sorted = [...days].sort();
    expect(days).toEqual(sorted);
    expect(new Set(days).size).toBe(days.length);
  });

  it('D7: Dienstag vor dem Stichtag Arbeitstag, danach nicht (Wochenplanwechsel)', () => {
    const user = buildUser({});
    const periods = stubWorkPeriodContext([
      {
        userId: 999,
        validFrom: '2020-01-01',
        validTo: '2026-05-06',
        weeklyHours: 40,
        workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
      },
      {
        userId: 999,
        validFrom: '2026-05-06',
        weeklyHours: 40,
        workSchedule: { monday: 8, tuesday: 0, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
      },
    ]);

    // 2026-05-05 (Dienstag, vor dem Stichtag 2026-05-06) bis 2026-05-12 (Dienstag, danach)
    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-12', user, periods);

    expect(days).toContain('2026-05-05'); // Dienstag vor dem Stichtag: Arbeitstag
    expect(days).not.toContain('2026-05-12'); // Dienstag ab dem Stichtag: kein Arbeitstag
  });
});

/**
 * CR-01 (09-REVIEW.md): `overtime_comp` kreditierte den Ausgleichstag bisher wie
 * `vacation`/`sick`, statt ihn wie einen normalen "kein Zeiteintrag"-Tag negativ zu buchen.
 * Nettoeffekt vor dem Fix: +targetHours statt -targetHours (09-INVENTAR-KREDITIERUNG.md #6).
 * Fixtures werden pro Test frisch angelegt (WR-07) statt auf development.db-Bestandsdaten
 * zu vertrauen.
 */
describe('calculateLiveOvertimeTransactions — REQ-19/CR-01 overtime_comp', () => {
  let testUserId: number;

  beforeEach(() => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_livecr01',
      'test@livecr01.com',
      'Test',
      'LiveCR01',
      'hash',
      'employee',
      20, // 20h / 5 Tage = 4h/Tag
      '2026-01-01'
    );
    testUserId = result.lastInsertRowid as number;

    // D4: ohne eine Periode ab hireDate würde jeder getDailyTargetHours()-Aufruf für diesen
    // Nutzer MissingWorkPeriodError werfen. Dieselben Werte wie im INSERT INTO users oben.
    insertTestWorkPeriod(testUserId, { validFrom: '2026-01-01', weeklyHours: 20 });
  });

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_corrections WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
  });

  it('overtime_comp-Tag (Soll 4h, keine Zeiterfassung): genau eine -4h time_entry-Buchung, keine overtime_comp_credit-Buchung', () => {
    // Dienstag, 13.01.2026 — Werktag, kein Feiertag (wie unifiedOvertimeService.test.ts)
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'overtime_comp', '2026-01-13', '2026-01-13', 'approved', 1);

    const transactions = calculateLiveOvertimeTransactions(testUserId, '2026-01-13', '2026-01-13');

    const creditTx = transactions.filter(t => t.type === 'overtime_comp_credit' && t.hours !== 0);
    expect(creditTx).toEqual([]);

    const earnedTx = transactions.filter(t => t.date === '2026-01-13' && t.type === 'time_entry');
    expect(earnedTx).toHaveLength(1);
    expect(earnedTx[0].hours).toBe(-4);

    // Nettowirkung des Tages auf die Liste: -4h (keine Gutschrift gleicht sie mehr aus)
    const netHours = transactions
      .filter(t => t.date === '2026-01-13')
      .reduce((sum, t) => sum + t.hours, 0);
    expect(netHours).toBe(-4);
  });

  it('Urlaubstag (Soll 4h): unveraendert vacation_credit +4h, keine negative earned-Buchung, Saldo-Nettowirkung 0h', () => {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'vacation', '2026-01-14', '2026-01-14', 'approved', 1);

    const transactions = calculateLiveOvertimeTransactions(testUserId, '2026-01-14', '2026-01-14');

    const creditTx = transactions.filter(t => t.date === '2026-01-14' && t.type === 'vacation_credit');
    expect(creditTx).toHaveLength(1);
    expect(creditTx[0].hours).toBe(4);

    const earnedTx = transactions.filter(t => t.date === '2026-01-14' && t.type === 'time_entry');
    expect(earnedTx).toEqual([]);

    // "Nettowirkung 0h" bezieht sich auf den Ueberstundensaldo (Urlaub kommt aus dem
    // Urlaubskonto, das Ueberstundenkonto bleibt unberuehrt), NICHT auf die Summe der
    // Listeneintraege: Die Live-Liste zeigt fuer Urlaubstage bewusst nur die
    // +4h-Gutschriftzeile ohne eigene Gegenbuchung (Schritt 4 ueberspringt absenceDates
    // weiterhin fuer vacation/sick/special/unpaid) - unveraendertes Verhalten vor und nach
    // diesem Plan.
    const balance = calculateCurrentOvertimeBalance(testUserId, '2026-01-14', '2026-01-14');
    expect(balance).toBe(0);
  });

  it('unpaid-Tag: unveraendert unpaid_deduction mit 0h', () => {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'unpaid', '2026-01-15', '2026-01-15', 'approved', 1);

    const transactions = calculateLiveOvertimeTransactions(testUserId, '2026-01-15', '2026-01-15');

    const deductionTx = transactions.filter(t => t.date === '2026-01-15' && t.type === 'unpaid_deduction');
    expect(deductionTx).toHaveLength(1);
    expect(deductionTx[0].hours).toBe(0);
  });

  it('Summe der Transaktionsliste widerspricht calculateCurrentOvertimeBalance() nicht mehr im Vorzeichen des Ausgleichstags', () => {
    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'overtime_comp', '2026-01-13', '2026-01-13', 'approved', 1);

    const transactions = calculateLiveOvertimeTransactions(testUserId, '2026-01-13', '2026-01-13');
    const listSum = transactions
      .filter(t => t.date === '2026-01-13')
      .reduce((sum, t) => sum + t.hours, 0);

    const balance = calculateCurrentOvertimeBalance(testUserId, '2026-01-13', '2026-01-13');

    expect(listSum).toBe(balance);
    expect(listSum).toBeLessThan(0); // Saldo sinkt, statt zu steigen
  });
});

/**
 * D7: Die Live-Anzeige muss für Tage vor und nach einem Periodenwechsel die jeweils
 * gültigen Sollstunden zeigen — nicht die des heutigen Stammdatensatzes.
 */
describe('calculateLiveOvertimeTransactions — D7 Periodenwechsel', () => {
  let stichtagUserId: number;

  afterEach(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(stichtagUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(stichtagUserId);
  });

  it('zeigt für Tage vor und nach dem Stichtag die jeweils gültigen Sollstunden', () => {
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_livestichtag',
      'test@livestichtag.com',
      'Test',
      'Stichtag',
      'hash',
      'employee',
      40, // heutiger Stammdatensatz — DARF NICHT gelesen werden (D3)
      '2026-02-01'
    );
    stichtagUserId = result.lastInsertRowid as number;

    // Periode 1: bis 2026-02-10 (exklusiv), 20h/Woche = 4h/Tag
    insertTestWorkPeriod(stichtagUserId, { validFrom: '2026-02-01', validTo: '2026-02-10', weeklyHours: 20 });
    // Periode 2: ab 2026-02-10, 40h/Woche = 8h/Tag
    insertTestWorkPeriod(stichtagUserId, { validFrom: '2026-02-10', weeklyHours: 40 });

    // 2026-02-09 (Montag, vor dem Stichtag) und 2026-02-10 (Dienstag, ab dem Stichtag) —
    // beide Werktage, kein Feiertag (verifiziert per SQL vor Testerstellung).
    const transactions = calculateLiveOvertimeTransactions(stichtagUserId, '2026-02-09', '2026-02-10');

    const before = transactions.find(t => t.date === '2026-02-09' && t.type === 'time_entry');
    const after = transactions.find(t => t.date === '2026-02-10' && t.type === 'time_entry');

    expect(before?.description).toContain('Soll: 4h');
    expect(before?.hours).toBe(-4);
    expect(after?.description).toContain('Soll: 8h');
    expect(after?.hours).toBe(-8);
  });
});

/**
 * Phase 13 (REQ-31, DD-24/DD-25/DD-26/DD-27): Der Kontoauszug muss ein Storno-Paar
 * (Original-`model_change`-Zeile + Gegenbuchung mit `reversalOf`) vollstaendig, unveraendert
 * und nicht-summierend liefern — die Grundlage dafuer, dass die Oberflaeche (Plan 13-10)
 * Zustands-Badges, den Beleg-Chip und die Sprungmarke zur Partnerzeile anbieten kann.
 */
describe('calculateLiveOvertimeTransactions — Storno-Paar (Phase 13, REQ-31)', () => {
  let testUserId: number;
  let testAdminId: number;

  beforeEach(() => {
    const userResult = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-13-06-user',
      'test-13-06-user@example.com',
      'Test',
      'Storno',
      'hash',
      'employee',
      40,
      '2026-03-01'
    );
    testUserId = userResult.lastInsertRowid as number;

    // D4: ohne eine Periode ab hireDate würde jeder getDailyTargetHours()-Aufruf für diesen
    // Nutzer MissingWorkPeriodError werfen (wie im Fixture des D7-Blocks oben).
    insertTestWorkPeriod(testUserId, { validFrom: '2026-03-01', weeklyHours: 40 });

    const adminResult = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-13-06-admin',
      'test-13-06-admin@example.com',
      'Adminvorname',
      'Adminnachname',
      'hash',
      'admin',
      40,
      '2020-01-01'
    );
    testAdminId = adminResult.lastInsertRowid as number;
  });

  afterEach(() => {
    // user_work_periods wird NICHT explizit gelöscht: der BEFORE-DELETE-Riegel
    // (trg_user_work_periods_delete_guard, Migration 008/010) verweigert ein echtes DELETE,
    // das den Nutzer periodenlos zurückließe. `users` trägt ON DELETE CASCADE auf
    // user_work_periods (schema.ts) — das Löschen des Nutzers räumt seine Periode(n) mit auf,
    // ohne den Riegel zu verletzen. Gleiches Muster wie in den D7-/CR-01-Blöcken oben.
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testAdminId);
  });

  it('liefert beide Zeilen des Storno-Paars vollstaendig, mit gemeinsamer Belegnummer, unveraenderter Anzeigesumme und stabiler Nachbarschaft', () => {
    const date = '2026-03-10';

    // Baseline VOR dem Anlegen des Paares — Nachweis fuer Zusicherung 5 (Anzeigesumme
    // bleibt durch das Paar unveraendert).
    const before = calculateLiveOvertimeTransactions(testUserId, '2026-03-01', '2026-03-31');
    const sumBefore = before.reduce((sum, t) => sum + t.hours, 0);

    const originalId = createTransaction({
      userId: testUserId,
      date,
      type: 'model_change',
      hours: 5.5,
      description: 'Stundenwechsel ab 2026-03-10 eingetragen',
      referenceType: 'work_period',
      referenceId: 4242,
      createdBy: null,
    });
    expect(originalId).not.toBeNull();

    const reversalId = createTransaction({
      userId: testUserId,
      date,
      type: 'model_change',
      hours: -5.5,
      description: 'Stundenwechsel ab 2026-03-10 storniert',
      referenceType: 'work_period',
      referenceId: 4242,
      reversalOf: originalId!,
      createdBy: testAdminId,
    });
    expect(reversalId).not.toBeNull();

    const after = calculateLiveOvertimeTransactions(testUserId, '2026-03-01', '2026-03-31');

    const original = after.find(t => t.id === originalId);
    const reversal = after.find(t => t.id === reversalId);

    // 1. Beide Zeilen erscheinen in der gelieferten Liste — keine wird herausgefiltert oder
    // zusammengefasst.
    expect(original).toBeDefined();
    expect(reversal).toBeDefined();

    // 2. reversedBy/reversalOf sind in beide Richtungen korrekt gesetzt, reversedAt gesetzt.
    expect(original!.reversedBy).toBe(reversalId);
    expect(original!.reversedAt).toBeTruthy();
    expect(original!.reversalOf).toBeNull();
    expect(reversal!.reversalOf).toBe(originalId);
    expect(reversal!.reversedBy).toBeNull();

    // 3. Beide Zeilen tragen dieselbe referenceId — die gemeinsame Belegnummer (DD-24), die
    // Id der Originalzeile.
    expect(original!.referenceId).toBe(originalId);
    expect(reversal!.referenceId).toBe(originalId);

    // 4. hours === 0 fuer beide Zeilen, documentedDelta exakt entgegengesetzt (Summe 0 bis
    // auf 0,01).
    expect(original!.hours).toBe(0);
    expect(reversal!.hours).toBe(0);
    expect(original!.documentedDelta).toBe(5.5);
    expect(reversal!.documentedDelta).toBe(-5.5);
    expect(
      Math.abs((original!.documentedDelta ?? 0) + (reversal!.documentedDelta ?? 0))
    ).toBeLessThanOrEqual(0.01);

    // 5. Die Summe der hours ueber ALLE gelieferten Transaktionen ist identisch zu der vor
    // dem Anlegen des Paares — das Paar verschiebt die Anzeigesumme nicht.
    const sumAfter = after.reduce((sum, t) => sum + t.hours, 0);
    expect(sumAfter).toBeCloseTo(sumBefore, 2);

    // 6. Gleiches Datum, Original steht in der gelieferten Liste unmittelbar vor seiner
    // Gegenbuchung (DD-27).
    expect(original!.date).toBe(date);
    expect(reversal!.date).toBe(date);
    const originalIndex = after.findIndex(t => t.id === originalId);
    const reversalIndex = after.findIndex(t => t.id === reversalId);
    expect(reversalIndex).toBe(originalIndex + 1);

    // 7. reversedByName traegt den zusammengesetzten Namen des Admins, der die Gegenbuchung
    // erzeugt hat.
    expect(original!.reversedByName).toBe('Adminvorname Adminnachname');
  });

  it('reversedByName ist null, wenn createdBy der Gegenbuchung null ist', () => {
    const date = '2026-03-11';

    const originalId = createTransaction({
      userId: testUserId,
      date,
      type: 'model_change',
      hours: 2,
      description: 'Stundenwechsel ab 2026-03-11 eingetragen',
      referenceType: 'work_period',
      referenceId: 4243,
      createdBy: null,
    });
    expect(originalId).not.toBeNull();

    const reversalId = createTransaction({
      userId: testUserId,
      date,
      type: 'model_change',
      hours: -2,
      description: 'Stundenwechsel ab 2026-03-11 storniert',
      referenceType: 'work_period',
      referenceId: 4243,
      reversalOf: originalId!,
      createdBy: null,
    });
    expect(reversalId).not.toBeNull();

    const transactions = calculateLiveOvertimeTransactions(testUserId, '2026-03-01', '2026-03-31');
    const original = transactions.find(t => t.id === originalId);

    expect(original).toBeDefined();
    expect(original!.reversedByName).toBeNull();
  });
});
