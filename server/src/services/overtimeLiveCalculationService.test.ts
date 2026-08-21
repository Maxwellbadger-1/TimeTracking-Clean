import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  getAllWorkingDaysBetween,
  calculateLiveOvertimeTransactions,
  calculateCurrentOvertimeBalance,
} from './overtimeLiveCalculationService.js';
import type { UserPublic } from '../types/index.js';

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
    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user);

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

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user);

    expect(days).not.toContain('2026-05-06'); // Mittwoch
    expect(days).toEqual(['2026-05-04', '2026-05-05', '2026-05-07', '2026-05-08']);
  });

  it('nimmt ohne workSchedule Montag bis Freitag auf, aber nicht das Wochenende', () => {
    const user = buildUser({ workSchedule: null, weeklyHours: 40 });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user);

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

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user);

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

    expect(getAllWorkingDaysBetween('2026-05-01', '2026-05-01', userWithSchedule)).toEqual([]);
    expect(getAllWorkingDaysBetween('2026-05-01', '2026-05-01', userWithoutSchedule)).toEqual([]);
  });

  it('liefert den Rückgabewert chronologisch aufsteigend und ohne Duplikate', () => {
    const user = buildUser({ workSchedule: null, weeklyHours: 40 });

    const days = getAllWorkingDaysBetween('2026-05-04', '2026-05-10', user);

    const sorted = [...days].sort();
    expect(days).toEqual(sorted);
    expect(new Set(days).size).toBe(days.length);
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

  it('Urlaubstag (Soll 4h): unveraendert vacation_credit +4h, keine negative earned-Buchung, Nettowirkung 0h', () => {
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

    const netHours = transactions
      .filter(t => t.date === '2026-01-14')
      .reduce((sum, t) => sum + t.hours, 0);
    expect(netHours).toBe(0);
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
