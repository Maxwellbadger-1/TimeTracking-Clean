import { describe, it, expect } from 'vitest';
import { getAllWorkingDaysBetween } from './overtimeLiveCalculationService.js';
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
