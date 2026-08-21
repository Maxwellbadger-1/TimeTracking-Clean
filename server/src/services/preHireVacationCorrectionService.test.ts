import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { getVacationBalance } from './vacationBalanceService.js';
import { getVacationBalanceFromTransactions } from './vacationTransactionService.js';
import {
  PRE_HIRE_CORRECTION_MARKER,
  hasExistingPreHireCorrection,
  buildPreHireCorrectionPlan,
  applyPreHireCorrection,
} from './preHireVacationCorrectionService.js';

/**
 * Regressionstests für die Korrektur der 06-04-Pro-rata-Artefakte (06-07).
 *
 * Ausschließlich synthetische Testnutzer — keine echten userIds (2/3 bleiben der
 * Kandidatenliste im CLI-Skript vorbehalten, siehe 06-07-PLAN.md).
 */
describe('preHireVacationCorrectionService', () => {
  const testUserIds: number[] = [];
  let userCounter = 0;

  function createTestUser(opts: {
    vacationDaysPerYear: number;
    hireDate: string;
  }): number {
    userCounter += 1;
    const username = `prehire_correction_${Date.now()}_${userCounter}`;
    const result = db.prepare(`
      INSERT INTO users
        (username, email, firstName, lastName, password, role, weeklyHours, vacationDaysPerYear, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      username,
      `${username}@test.local`,
      'PreHire',
      'Test',
      'hash',
      'employee',
      40,
      opts.vacationDaysPerYear,
      opts.hireDate
    );
    const id = result.lastInsertRowid as number;
    testUserIds.push(id);
    return id;
  }

  function setBalance(userId: number, year: number, entitlement: number, carryover: number, taken: number): number {
    const r = db.prepare(`
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, year, entitlement, carryover, taken);
    return r.lastInsertRowid as number;
  }

  function addEntitlementTransaction(userId: number, year: number, days: number, description: string) {
    db.prepare(`
      INSERT INTO vacation_transactions (userId, year, date, type, days, description, referenceType)
      VALUES (?, ?, ?, 'entitlement', ?, ?, 'system')
    `).run(userId, year, `${year}-01-01`, days, description);
  }

  afterEach(() => {
    if (testUserIds.length === 0) return;
    const placeholders = testUserIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM vacation_transactions WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM vacation_balance WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...testUserIds);
    testUserIds.length = 0;
  });

  it('1. korrigiert ein passendes Konto — Eintritt nach dem angefragten Jahr, frisches Fehlkonto', () => {
    const userId = createTestUser({ vacationDaysPerYear: 7, hireDate: '2026-01-01' });
    const balanceId = setBalance(userId, 2025, 7, 0, 0);
    addEntitlementTransaction(userId, 2025, 7, 'Jahresanspruch 2025 (rückwirkend erzeugt)');

    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(plan).toHaveLength(1);
    expect(plan[0].eligible).toBe(true);
    if (!plan[0].eligible) throw new Error('unreachable');
    expect(plan[0].balanceId).toBe(balanceId);
    expect(plan[0].currentEntitlement).toBe(7);

    const updated = applyPreHireCorrection(plan[0]);
    expect(updated.entitlement).toBe(0);
    expect(updated.taken).toBe(0);
    expect(updated.remaining).toBe(0);

    expect(getVacationBalanceFromTransactions(userId, 2025)).toBe(0);
    const balance = getVacationBalance(userId, 2025);
    expect(balance?.entitlement).toBe(0);
    expect(balance?.taken).toBe(0);
    expect(balance?.remaining).toBe(0);

    expect(hasExistingPreHireCorrection(userId, 2025)).toBe(true);
  });

  it('2. Idempotenz — ein zweiter Plan-Aufbau erkennt die bereits erfolgte Korrektur', () => {
    const userId = createTestUser({ vacationDaysPerYear: 13, hireDate: '2026-01-01' });
    setBalance(userId, 2025, 13, 0, 0);
    addEntitlementTransaction(userId, 2025, 13, 'Jahresanspruch 2025 (rückwirkend erzeugt)');

    const firstPlan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(firstPlan[0].eligible).toBe(true);
    if (!firstPlan[0].eligible) throw new Error('unreachable');
    applyPreHireCorrection(firstPlan[0]);

    const secondPlan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(secondPlan[0].eligible).toBe(false);
    if (secondPlan[0].eligible) throw new Error('unreachable');
    expect(secondPlan[0].reason).toContain('Bereits korrigiert');
  });

  it('3. lehnt ein Konto ab, dessen Eintritt tatsächlich im angefragten Jahr liegt (passt nicht zum Fehlerbild)', () => {
    // Eintritt mitten in 2025 -> calculateProRataVacationDays liefert != 0 fuer 2025
    const userId = createTestUser({ vacationDaysPerYear: 20, hireDate: '2025-06-01' });
    setBalance(userId, 2025, 20, 0, 0);
    addEntitlementTransaction(userId, 2025, 20, 'Jahresanspruch 2025');

    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(plan[0].eligible).toBe(false);
    if (plan[0].eligible) throw new Error('unreachable');
    expect(plan[0].reason).toMatch(/Anspruch/);
  });

  it('4. lehnt einen Kandidaten ganz ohne vacation_balance-Konto ab', () => {
    const userId = createTestUser({ vacationDaysPerYear: 10, hireDate: '2026-01-01' });
    // Kein setBalance() aufgerufen -> kein Konto vorhanden

    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(plan[0].eligible).toBe(false);
    if (plan[0].eligible) throw new Error('unreachable');
    expect(plan[0].reason).toContain('Kein Konto vorhanden');
  });

  it('5. lehnt ein Konto mit vorhandenem carryover ab (kein frisches, unberührtes Fehlkonto)', () => {
    const userId = createTestUser({ vacationDaysPerYear: 7, hireDate: '2026-01-01' });
    setBalance(userId, 2025, 7, 3, 0);
    addEntitlementTransaction(userId, 2025, 7, 'Jahresanspruch 2025 (rückwirkend erzeugt)');

    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(plan[0].eligible).toBe(false);
    if (plan[0].eligible) throw new Error('unreachable');
    expect(plan[0].reason).toMatch(/carryover/i);
  });

  it('6. applyPreHireCorrection wirft bei einem eligible:false-Eintrag', () => {
    const userId = createTestUser({ vacationDaysPerYear: 10, hireDate: '2026-01-01' });
    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    expect(plan[0].eligible).toBe(false);
    expect(() => applyPreHireCorrection(plan[0] as never)).toThrow();
  });

  it('7. der Reason-Text der Korrekturbuchung enthaelt den Marker', () => {
    const userId = createTestUser({ vacationDaysPerYear: 7, hireDate: '2026-01-01' });
    setBalance(userId, 2025, 7, 0, 0);
    addEntitlementTransaction(userId, 2025, 7, 'Jahresanspruch 2025 (rückwirkend erzeugt)');

    const plan = buildPreHireCorrectionPlan([{ userId, year: 2025 }]);
    if (!plan[0].eligible) throw new Error('unreachable');
    applyPreHireCorrection(plan[0]);

    const row = db.prepare(`
      SELECT description FROM vacation_transactions
      WHERE userId = ? AND year = ? AND type = 'correction'
    `).get(userId, 2025) as { description: string } | undefined;

    expect(row?.description).toContain(PRE_HIRE_CORRECTION_MARKER);
  });
});
