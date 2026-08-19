import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  initializeVacationAccountsForNewUser,
  bulkInitializeVacationBalances,
  calculateProRataVacationDays,
  getVacationBalance,
} from './vacationBalanceService.js';
import { performYearEndRollover } from './yearEndRolloverService.js';
import {
  getVacationTransactions,
  getVacationBalanceFromTransactions,
} from './vacationTransactionService.js';
import { createAbsenceRequest, approveAbsenceRequest } from './absenceService.js';

/**
 * Regressionstests für REQ-07 — Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel.
 *
 * Drei Wege, auf denen ein Urlaubskonto entsteht: Anlage eines Mitarbeiters (Route
 * `POST /api/users`, Buchungslogik in `initializeVacationAccountsForNewUser`),
 * Admin-Massenanlage (`bulkInitializeVacationBalances`) und Jahreswechsel
 * (`performYearEndRollover`, ruft `bulkInitializeVacationBalances` selbst auf).
 *
 * Historischer Kontext: `data.vacationDaysPerYear || 30` gab sechs Mitarbeitern je 30 Tage,
 * obwohl 0 hinterlegt war (behoben seit 18.08. durch `??`). Test 2 hält das dauerhaft fest.
 *
 * `bulkInitializeVacationBalances`/`performYearEndRollover` verarbeiten ALLE aktiven Nutzer
 * der Datenbank (nicht nur die Testnutzer) — Tests 4 und 5 verwenden deshalb weit in der
 * Zukunft liegende, exklusive Jahre (2031-2033) und räumen diese in `finally` global wieder
 * auf, um die echten Bestandsdaten anderer Nutzer nicht dauerhaft zu verändern.
 */
describe('vacationBalanceService / yearEndRolloverService — Anspruch & Übertrag buchen', () => {
  let adminId: number;
  const testUserIds: number[] = [];
  let userCounter = 0;

  function createTestUser(opts: {
    vacationDaysPerYear: number;
    hireDate: string;
    role?: 'admin' | 'employee';
  }): number {
    userCounter += 1;
    const username = `entitlement_booking_${Date.now()}_${userCounter}`;
    const result = db.prepare(`
      INSERT INTO users
        (username, email, firstName, lastName, password, role, weeklyHours, vacationDaysPerYear, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      username,
      `${username}@test.local`,
      'Test',
      'User',
      'hash',
      opts.role ?? 'employee',
      40,
      opts.vacationDaysPerYear,
      opts.hireDate
    );
    const id = result.lastInsertRowid as number;
    testUserIds.push(id);
    return id;
  }

  beforeEach(() => {
    adminId = createTestUser({ vacationDaysPerYear: 30, hireDate: '2020-01-01', role: 'admin' });
  });

  afterEach(() => {
    if (testUserIds.length === 0) return;
    const placeholders = testUserIds.map(() => '?').join(', ');
    // Reihenfolge wegen FOREIGN KEY-Constraints: abhängige Tabellen zuerst. Tests 5/6 lösen
    // über performYearEndRollover/approveAbsenceRequest auch Überstunden- und Zeiteintrags-
    // Buchungen für dieselben Nutzer aus — ohne diese Zeilen schlägt DELETE users fehl.
    db.prepare(`DELETE FROM vacation_transactions WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM overtime_transactions WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM overtime_balance WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM work_time_accounts WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM time_entries WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM absence_requests WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM vacation_balance WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM audit_log WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...testUserIds);
    testUserIds.length = 0;
  });

  it('1. Anlage mit 20 Urlaubstagen: entitlement-Buchung über 20 für laufendes Jahr und Folgejahr', () => {
    const hireDate = '2020-01-01'; // vor diesem Jahr eingetreten → voller Jahreswert, kein Pro-rata
    const userId = createTestUser({ vacationDaysPerYear: 20, hireDate });

    const result = initializeVacationAccountsForNewUser({
      userId,
      hireDate,
      vacationDaysPerYear: 20,
      createdBy: adminId,
    });

    expect(result.currentYearEntitlement).toBe(20);
    expect(result.nextYearEntitlement).toBe(20);

    const currentYearTxs = getVacationTransactions(userId, { year: result.currentYear });
    expect(currentYearTxs).toHaveLength(1);
    expect(currentYearTxs[0].type).toBe('entitlement');
    expect(currentYearTxs[0].days).toBe(20);

    const nextYearTxs = getVacationTransactions(userId, { year: result.nextYear });
    expect(nextYearTxs).toHaveLength(1);
    expect(nextYearTxs[0].type).toBe('entitlement');
    expect(nextYearTxs[0].days).toBe(20);

    const balance = getVacationBalance(userId, result.currentYear);
    expect(balance?.entitlement).toBe(20);
  });

  it('2. Anlage mit 0 Urlaubstagen: Konto mit entitlement=0, keine Buchung, kein Fehler', () => {
    const hireDate = '2020-01-01';
    const userId = createTestUser({ vacationDaysPerYear: 0, hireDate });

    // Der historische Fehler: `0 || 30` hätte hier fälschlich 30 gebucht. `??` in
    // initializeVacationAccountsForNewUser muss 0 als gültigen Wert respektieren, und
    // recordVacationTransaction lehnt days=0 ab — der Aufruf darf trotzdem nicht werfen.
    const result = initializeVacationAccountsForNewUser({
      userId,
      hireDate,
      vacationDaysPerYear: 0,
      createdBy: adminId,
    });
    expect(result.currentYearEntitlement).toBe(0);
    expect(result.nextYearEntitlement).toBe(0);

    const balance = getVacationBalance(userId, result.currentYear);
    expect(balance?.entitlement).toBe(0);

    // Konto existiert (mit entitlement=0), aber keine einzige Journalbuchung dafür.
    const txs = getVacationTransactions(userId, { year: result.currentYear });
    expect(txs).toHaveLength(0);
    const nextYearTxs = getVacationTransactions(userId, { year: result.nextYear });
    expect(nextYearTxs).toHaveLength(0);
  });

  it('3. Unterjähriger Eintritt: Buchung trägt den Pro-rata-Wert, nicht den vollen Jahreswert', () => {
    const currentYear = new Date().getFullYear();
    const hireDate = `${currentYear}-02-27`; // Eintritt mitten im laufenden Jahr
    const userId = createTestUser({ vacationDaysPerYear: 30, hireDate });

    const expectedProRata = calculateProRataVacationDays(hireDate, 30, currentYear);
    expect(expectedProRata).toBeLessThan(30); // Sanity: tatsächlich anteilig, nicht voll

    const result = initializeVacationAccountsForNewUser({
      userId,
      hireDate,
      vacationDaysPerYear: 30,
      createdBy: adminId,
    });

    expect(result.currentYear).toBe(currentYear);
    expect(result.currentYearEntitlement).toBe(expectedProRata);
    // Folgejahr: voller Jahreswert (Planungsgröße), kein Pro-rata mehr
    expect(result.nextYearEntitlement).toBe(30);

    const txs = getVacationTransactions(userId, { year: currentYear });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('entitlement');
    expect(txs[0].days).toBe(expectedProRata);
    expect(txs[0].date).toBe(hireDate); // Anspruch entsteht am Eintrittsdatum
    expect(txs[0].description).toContain('anteilig');
  });

  it('4. Massenanlage: je Konto genau eine Anspruchsbuchung; zweiter Lauf erzeugt keine weitere', () => {
    const BULK_YEAR = 2033; // weit in der Zukunft, exklusiv für diesen Test
    const hireDate = '2020-01-01';
    const user1 = createTestUser({ vacationDaysPerYear: 10, hireDate });
    const user2 = createTestUser({ vacationDaysPerYear: 15, hireDate });

    try {
      bulkInitializeVacationBalances(BULK_YEAR, adminId);

      const balance1 = getVacationBalance(user1, BULK_YEAR);
      const balance2 = getVacationBalance(user2, BULK_YEAR);
      expect(balance1?.entitlement).toBe(10);
      expect(balance2?.entitlement).toBe(15);

      const tx1 = getVacationTransactions(user1, { year: BULK_YEAR });
      const tx2 = getVacationTransactions(user2, { year: BULK_YEAR });
      expect(tx1).toHaveLength(1);
      expect(tx1[0].type).toBe('entitlement');
      expect(tx1[0].days).toBe(10);
      expect(tx2).toHaveLength(1);
      expect(tx2[0].days).toBe(15);

      // Zweiter Lauf: bestehende Konten werden übersprungen (if (existing) continue) —
      // keine weitere, doppelte Anspruchsbuchung.
      bulkInitializeVacationBalances(BULK_YEAR, adminId);

      const tx1Again = getVacationTransactions(user1, { year: BULK_YEAR });
      expect(tx1Again).toHaveLength(1);
    } finally {
      db.prepare('DELETE FROM vacation_transactions WHERE year = ?').run(BULK_YEAR);
      db.prepare('DELETE FROM vacation_balance WHERE year = ?').run(BULK_YEAR);
    }
  });

  it('5. Jahreswechsel: entitlement und carryover für das neue Jahr gebucht, Übertrag = Rest des Vorjahres', () => {
    const PREV_YEAR = 2031;
    const NEW_YEAR = 2032;
    const hireDate = '2020-01-01';
    const userId = createTestUser({ vacationDaysPerYear: 25, hireDate });

    try {
      // Vorjahreskonto mit einem Rest von 20 Tagen (25 Anspruch − 5 genommen) anlegen.
      const insertPrevYear = db.prepare(`
        INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertPrevYear.run(userId, PREV_YEAR, 25, 0, 5);

      const result = performYearEndRollover(NEW_YEAR, adminId);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);

      const newBalance = getVacationBalance(userId, NEW_YEAR);
      expect(newBalance?.entitlement).toBe(25);
      expect(newBalance?.carryover).toBe(20); // 25 + 0 − 5 = 20 Rest aus dem Vorjahr

      const txs = getVacationTransactions(userId, { year: NEW_YEAR });
      expect(txs).toHaveLength(2);

      const entitlementTx = txs.find((t) => t.type === 'entitlement');
      const carryoverTx = txs.find((t) => t.type === 'carryover');
      expect(entitlementTx?.days).toBe(25);
      expect(carryoverTx?.days).toBe(20);
      expect(carryoverTx?.description).toContain(String(PREV_YEAR)); // Herkunftsjahr im Auszug
    } finally {
      db.prepare('DELETE FROM vacation_transactions WHERE year IN (?, ?)').run(PREV_YEAR, NEW_YEAR);
      db.prepare('DELETE FROM vacation_balance WHERE year IN (?, ?)').run(PREV_YEAR, NEW_YEAR);
      // performYearEndRollover bucht als Nebeneffekt auch den Überstunden-Jahreswechsel
      // (Step 2, für ALLE aktiven Nutzer) und einen Audit-Log-Eintrag — beides ebenfalls
      // aufräumen, damit die echten Bestandsdaten anderer Nutzer unverändert bleiben.
      db.prepare(`DELETE FROM overtime_balance WHERE month = ?`).run(`${NEW_YEAR}-01`);
      db.prepare(`DELETE FROM audit_log WHERE entity = 'year_end_rollover' AND entityId = ?`).run(NEW_YEAR);
    }
  });

  it('6. Vollständigkeitsprüfung: Journal-Saldo == entitlement + carryover − taken nach Anlage und genehmigtem Urlaub', async () => {
    const hireDate = '2020-01-01';
    const userId = createTestUser({ vacationDaysPerYear: 20, hireDate });

    const { currentYear } = initializeVacationAccountsForNewUser({
      userId,
      hireDate,
      vacationDaysPerYear: 20,
      createdBy: adminId,
    });

    // Zwei Werktage Urlaub im laufenden Jahr beantragen und genehmigen.
    const request = createAbsenceRequest({
      userId,
      type: 'vacation',
      startDate: `${currentYear}-06-01`,
      endDate: `${currentYear}-06-02`,
    });
    await approveAbsenceRequest(request.id, adminId);

    const balance = getVacationBalance(userId, currentYear);
    expect(balance).not.toBeNull();

    const journal = getVacationBalanceFromTransactions(userId, currentYear);

    // Das ist die Bedingung, auf der Phase 7 aufbaut: Journal-Saldo == entitlement +
    // carryover − taken. Kein zweiter, unabhängig gepflegter Wert darf abweichen.
    expect(journal).toBe(balance!.entitlement + balance!.carryover - balance!.taken);
  });
});
