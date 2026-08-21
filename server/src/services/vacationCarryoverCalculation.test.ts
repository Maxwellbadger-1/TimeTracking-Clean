import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  calculateCarryover,
  upsertVacationBalance,
  updateVacationBalance,
  bulkInitializeVacationBalances,
  getVacationBalance,
  type VacationBalance,
} from './vacationBalanceService.js';
import { initializeVacationBalance } from './absenceService.js';
import { previewYearEndRollover } from './yearEndRolloverService.js';

/**
 * Regressionstests für den Blocker, den der Plan-Checker beim Review von 06-04/06-05 gefunden
 * hat (06-REVIEW.md WR-03, Nachtrag des Koordinators zur Admin-Vorschau).
 *
 * Vor diesem Fix implementierten fünf Stellen die Übertragsregel unabhängig voneinander, mit
 * drei unterschiedlichen Verhaltensweisen: drei Stellen deckelten auf 5 Tage
 * (upsertVacationBalance, updateVacationBalance, absenceService.initializeVacationBalance),
 * eine Stelle war unbegrenzt mit Untergrenze 0 (bulkInitializeVacationBalances — die fachlich
 * korrekte Referenz laut Anwenderentscheidung), und eine Stelle (previewYearEndRollover, die
 * Admin-Vorschau vor dem echten Jahreswechsel) war unbegrenzt UND ohne Untergrenze.
 *
 * Warum das den Nachbuchungs-Fix aus 06-05 unterlaufen hätte (06-VERIFICATION.md Gap 1/Gap 2
 * Interaktion): Beantragt jemand im Dezember Urlaub für Januar, bucht der Auto-Init-Pfad
 * (absenceService.initializeVacationBalance) einen gedeckelten Übertrag von 5 Tagen. Der
 * spätere echte Jahreswechsel findet eine vorhandene carryover-Buchung und trägt nichts mehr
 * nach — ein Mitarbeiter mit 20 Resttagen behielte dauerhaft nur 5.
 *
 * Dieser Test deckt genau diese Interaktion und den Vorschau-vs-Buchung-Abgleich ab, die keiner
 * der 27 bestehenden Tests aus 06-01/06-02/06-03 abdeckt.
 */

describe('calculateCarryover — Unit-Tests', () => {
  it('liefert 0, wenn kein Vorjahreskonto existiert', () => {
    expect(calculateCarryover(null)).toBe(0);
  });

  it('liefert 0 für remaining = 0', () => {
    expect(calculateCarryover({ remaining: 0 } as VacationBalance)).toBe(0);
  });

  it('liefert 0 für einen negativen Rest (defensiv, kann in der Praxis nicht vorkommen)', () => {
    expect(calculateCarryover({ remaining: -3 } as VacationBalance)).toBe(0);
  });

  it('liefert den vollen Rest für remaining = 3', () => {
    expect(calculateCarryover({ remaining: 3 } as VacationBalance)).toBe(3);
  });

  it('liefert den vollen Rest für remaining = 20 — nicht gekappt auf 5 Tage', () => {
    expect(calculateCarryover({ remaining: 20 } as VacationBalance)).toBe(20);
  });
});

describe('Konsistenz: alle Buchungspfade und die Admin-Vorschau liefern denselben Übertrag über 5 Tage hinaus', () => {
  // Jahre 2050-2057 sind exklusiv für diese Datei (2031-2035 sind bereits in
  // vacationEntitlementBooking.test.ts belegt). bulkInitializeVacationBalances/
  // previewYearEndRollover verarbeiten ALLE aktiven Nutzer der Datenbank — deshalb räumt
  // afterEach global für diese Jahre auf, nicht nur nach userId gefiltert (exakt das
  // bestehende Muster aus Test 4/5 in vacationEntitlementBooking.test.ts).
  const YEARS = [2050, 2051, 2052, 2053, 2054, 2055, 2056, 2057];

  let adminId: number;
  const testUserIds: number[] = [];
  let userCounter = 0;

  function createTestUser(): number {
    userCounter += 1;
    const username = `carryover_consistency_${Date.now()}_${userCounter}`;
    const result = db
      .prepare(
        `
      INSERT INTO users
        (username, email, firstName, lastName, password, role, weeklyHours, vacationDaysPerYear, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(username, `${username}@test.local`, 'Test', 'User', 'hash', 'employee', 40, 25, '2020-01-01');
    const id = result.lastInsertRowid as number;
    testUserIds.push(id);
    return id;
  }

  beforeEach(() => {
    adminId = createTestUser();
  });

  afterEach(() => {
    const yearPlaceholders = YEARS.map(() => '?').join(', ');
    db.prepare(`DELETE FROM vacation_transactions WHERE year IN (${yearPlaceholders})`).run(...YEARS);
    db.prepare(`DELETE FROM vacation_balance WHERE year IN (${yearPlaceholders})`).run(...YEARS);

    if (testUserIds.length > 0) {
      const userPlaceholders = testUserIds.map(() => '?').join(', ');
      // Reihenfolge wegen FOREIGN KEY-Constraints: abhängige Tabellen zuerst.
      db.prepare(`DELETE FROM vacation_transactions WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM overtime_transactions WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM overtime_balance WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM work_time_accounts WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM time_entries WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM absence_requests WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM vacation_balance WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM audit_log WHERE userId IN (${userPlaceholders})`).run(...testUserIds);
      db.prepare(`DELETE FROM users WHERE id IN (${userPlaceholders})`).run(...testUserIds);
      testUserIds.length = 0;
    }
  });

  it('vier Buchungspfade und die Admin-Vorschau liefern für denselben Vorjahresrest (20 Tage) denselben Übertrag', () => {
    const userA = createTestUser();
    const userB = createTestUser();
    const userC = createTestUser();
    const userD = createTestUser();

    // --- Nutzer A: upsertVacationBalance() ---
    const PREV_A = 2050;
    db.prepare(
      `INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken) VALUES (?, ?, ?, ?, ?)`
    ).run(userA, PREV_A, 25, 0, 5); // remaining = 25 + 0 - 5 = 20

    let resultA: VacationBalance | undefined;
    expect(() => {
      resultA = upsertVacationBalance({
        userId: userA,
        year: 2051,
        entitlement: 25,
        carryover: 20,
        actorId: null,
      });
    }).not.toThrow(); // vor diesem Fix hätte hier bereits die `> 10`-Validierung geworfen
    expect(resultA?.carryover).toBe(20);

    // --- Nutzer B: updateVacationBalance() ---
    const PREV_B = 2052;
    db.prepare(
      `INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken) VALUES (?, ?, ?, ?, ?)`
    ).run(userB, PREV_B, 25, 0, 5); // remaining = 20

    const targetInsert = db
      .prepare(
        `INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken) VALUES (?, ?, ?, ?, ?)`
      )
      .run(userB, 2053, 25, 0, 0);
    const targetId = targetInsert.lastInsertRowid as number;

    expect(() => updateVacationBalance(targetId, { carryover: 20 })).not.toThrow();
    expect(getVacationBalance(userB, 2053)?.carryover).toBe(20);

    // --- Nutzer C: previewYearEndRollover() (Admin-Vorschau) vs. bulkInitializeVacationBalances() (tatsächliche Buchung) ---
    const PREV_C = 2054;
    db.prepare(
      `INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken) VALUES (?, ?, ?, ?, ?)`
    ).run(userC, PREV_C, 25, 0, 5); // remaining = 20

    // Vorschau VOR der tatsächlichen Massenanlage aufrufen — wie in Produktion vor dem echten
    // Jahreswechsel angezeigt.
    const preview = previewYearEndRollover(2055);
    const previewEntry = preview.users.find((u) => u.userId === userC);
    expect(previewEntry?.vacationCarryover).toBe(20);

    bulkInitializeVacationBalances(2055, adminId);
    const bookedC = getVacationBalance(userC, 2055);
    expect(bookedC?.carryover).toBe(20);

    // Kernaussage, die der Plan-Checker als fehlend markiert hatte: Vorschau und tatsächliche
    // Buchung stimmen für denselben Nutzer/dasselbe Jahr direkt überein — nicht nur beide
    // unabhängig gegen dieselbe hartkodierte Erwartungszahl.
    expect(previewEntry?.vacationCarryover).toBe(bookedC?.carryover);

    // --- Nutzer D: absenceService.initializeVacationBalance() ---
    const PREV_D = 2056;
    db.prepare(
      `INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken) VALUES (?, ?, ?, ?, ?)`
    ).run(userD, PREV_D, 25, 0, 5); // remaining = 20

    const resultD = initializeVacationBalance(userD, 2057);
    expect(resultD.carryover).toBe(20);

    // Gemeinsame Assertion: alle vier Pfade sowie der Vorschauwert aus previewYearEndRollover
    // für Nutzer C sind gleich (20) — keiner der fünf Werte weicht ab.
    expect([resultA?.carryover, getVacationBalance(userB, 2053)?.carryover, bookedC?.carryover, resultD.carryover, previewEntry?.vacationCarryover]).toEqual([
      20, 20, 20, 20, 20,
    ]);
  });
});
