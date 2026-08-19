import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  updateVacationBalance,
  upsertVacationBalance,
  getVacationBalanceById,
} from './vacationBalanceService.js';
import {
  getVacationTransactions,
  getVacationBalanceFromTransactions,
} from './vacationTransactionService.js';

/**
 * Regressionstests für REQ-06 — Admin-Änderungen am Urlaubskonto erzeugen eine
 * correction-Buchung mit Pflichtbegründung statt eines stillen Überschreibens.
 *
 * Der Auslöser: Bei der Ursachensuche am 18.08.2026 wiesen sechs Konten 30 Tage aus, obwohl
 * die Stammdaten 0 sagten. Ob das ein Admin eingetragen hatte oder das System, ließ sich
 * NICHT feststellen — Änderungen am Urlaubskonto wurden nirgends protokolliert. Test 7 bildet
 * genau diesen Fall nach und prüft, dass der Kontoauszug die Frage jetzt in einer Zeile
 * beantwortet.
 *
 * `updateVacationBalance` (PUT, id-basiert) und `upsertVacationBalance` (POST — der Pfad,
 * den die Admin-Oberfläche `VacationBalanceEditModal.tsx` tatsächlich verwendet, auch zum
 * Bearbeiten bestehender Konten) teilen dieselbe Korrekturlogik. Beide werden getestet.
 */
describe('vacationBalanceService — Korrekturbuchungen bei Admin-Änderungen', () => {
  let adminId: number;
  const testUserIds: number[] = [];
  let userCounter = 0;
  const YEAR = 2026;

  function createTestUser(): number {
    userCounter += 1;
    const username = `correction_booking_${Date.now()}_${userCounter}`;
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
      'employee',
      40,
      30,
      '2020-01-01'
    );
    const id = result.lastInsertRowid as number;
    testUserIds.push(id);
    return id;
  }

  /** Legt ein Urlaubskonto direkt an (ohne Buchung) — definierte Ausgangslage für die
   *  Korrektur-Tests, unabhängig von den Entstehungswegen aus 06-01/06-02. */
  function createTestBalance(
    userId: number,
    year: number,
    entitlement: number,
    carryover: number,
    taken: number
  ): number {
    const result = db.prepare(`
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, year, entitlement, carryover, taken);
    return result.lastInsertRowid as number;
  }

  beforeEach(() => {
    adminId = createTestUser();
  });

  afterEach(() => {
    if (testUserIds.length === 0) return;
    const placeholders = testUserIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM vacation_transactions WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM vacation_balance WHERE userId IN (${placeholders})`).run(...testUserIds);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...testUserIds);
    testUserIds.length = 0;
  });

  it('1. Anspruch 30 → 0 mit Begründung: eine correction-Buchung über -30, Begründung und createdBy gesetzt', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 0);

    updateVacationBalance(balanceId, {
      entitlement: 0,
      reason: 'Stammdaten korrigiert',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('correction');
    expect(txs[0].days).toBe(-30);
    expect(txs[0].description).toContain('Stammdaten korrigiert');
    expect(txs[0].createdBy).toBe(adminId);
  });

  it('2. taken 21 → 15: Buchung über +6 (weniger verbraucht = mehr verfügbar)', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 21);

    updateVacationBalance(balanceId, {
      taken: 15,
      reason: 'Fehlerhafte Buchung korrigiert',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('correction');
    expect(txs[0].days).toBe(6);
  });

  it('3. Zwei Felder gleichzeitig geändert: zwei Buchungen', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 10);

    updateVacationBalance(balanceId, {
      entitlement: 25,
      taken: 8,
      reason: 'Doppelkorrektur',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(2);

    const entitlementTx = txs.find((t) => t.description?.includes('Anspruch'));
    const takenTx = txs.find((t) => t.description?.includes('Genommen'));
    expect(entitlementTx?.days).toBe(-5); // 30 → 25
    expect(takenTx?.days).toBe(2); // 10 → 8, weniger verbraucht = mehr verfügbar
  });

  it('4. Unverändertes Feld erzeugt keine Buchung', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 10);

    updateVacationBalance(balanceId, {
      entitlement: 30, // identisch zum bestehenden Wert
      reason: 'Kein Effekt erwartet',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(0);
  });

  it('5. Leere Begründung wird abgewiesen — kein UPDATE, keine Buchung', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 0);

    expect(() =>
      updateVacationBalance(balanceId, {
        entitlement: 0,
        reason: '',
        actorId: adminId,
      })
    ).toThrow(/Begründung/);

    // Die gesamte Operation muss fehlschlagen — weder Update noch Buchung dürfen entstehen.
    const balance = getVacationBalanceById(balanceId);
    expect(balance?.entitlement).toBe(30);
    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(0);
  });

  it('6. Fehlende Begründung erzeugt einen gekennzeichneten Ersatztext, Buchung entsteht trotzdem', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 0);

    updateVacationBalance(balanceId, {
      entitlement: 0,
      actorId: adminId,
      // reason bewusst weggelassen
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toContain('Korrektur durch Admin');
    expect(txs[0].description).toContain('Anspruch 30 → 0');
  });

  it('7. Der 18.08.-Fall, rückwärts gelesen: Konto von 30 auf 0 korrigieren — der Kontoauszug beantwortet wer/wann/warum', () => {
    const userId = createTestUser();
    const balanceId = createTestBalance(userId, YEAR, 30, 0, 0);

    updateVacationBalance(balanceId, {
      entitlement: 0,
      reason: 'Stammdaten korrigiert nach Rückfrage mit HR',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    const [tx] = txs;

    // WER hat geändert?
    expect(tx.createdBy).toBe(adminId);
    // WANN geschah die Änderung?
    expect(tx.createdAt).toBeTruthy();
    // WARUM wurde geändert?
    expect(tx.description).toContain('Stammdaten korrigiert nach Rückfrage mit HR');
    // Alter und neuer Wert bleiben nachvollziehbar.
    expect(tx.balanceBefore).toBe(0);
    expect(tx.balanceAfter).toBe(-30);
  });

  it('8. Konsistenz: nach der Korrektur gilt weiterhin Journal-Saldo == entitlement + carryover − taken', () => {
    // Die Prüfung ist nur aussagekräftig, wenn das Journal die GESAMTE Historie des Kontos
    // trägt — deshalb entsteht das Konto hier über einen buchenden Pfad (upsertVacationBalance,
    // wie bei einer echten Neuanlage), statt wie in den übrigen Tests direkt per SQL. Backfill
    // für Bestandskonten ohne Journal-Historie ist Phase 7, nicht dieser Plan.
    const userId = createTestUser();
    const created = upsertVacationBalance({ userId, year: YEAR, entitlement: 30, carryover: 0 });

    updateVacationBalance(created.id, {
      entitlement: 25,
      reason: 'Konsistenzcheck',
      actorId: adminId,
    });

    const balance = getVacationBalanceById(created.id);
    const journal = getVacationBalanceFromTransactions(userId, YEAR);

    expect(journal).toBe(balance!.entitlement + balance!.carryover - balance!.taken);
  });

  it('9. upsertVacationBalance bucht bei bestehendem Konto ebenfalls eine Korrektur (der tatsächliche Admin-Editier-Pfad)', () => {
    // VacationBalanceEditModal.tsx ruft für Neuanlage UND Bearbeitung immer POST auf —
    // dieser Pfad, nicht PUT/updateVacationBalance, ist der in Produktion genutzte.
    const userId = createTestUser();
    createTestBalance(userId, YEAR, 30, 0, 0);

    upsertVacationBalance({
      userId,
      year: YEAR,
      entitlement: 20,
      carryover: 0, // unverändert — keine zusätzliche Buchung
      reason: 'Jahresupdate',
      actorId: adminId,
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('correction');
    expect(txs[0].days).toBe(-10); // 30 → 20
    expect(txs[0].description).toContain('Jahresupdate');
  });

  it('10. upsertVacationBalance bucht bei Neuanlage entitlement/carryover — keine Korrektur', () => {
    const userId = createTestUser();
    const previousYear = YEAR - 1;
    // Vorjahreskonto mit Rest 10, damit die Übertrag-Validierung (max. 5 Tage) den
    // gewünschten Testwert von 4 zulässt.
    createTestBalance(userId, previousYear, 10, 0, 0);

    upsertVacationBalance({
      userId,
      year: YEAR,
      entitlement: 12,
      carryover: 4,
      actorId: adminId,
      // reason bewusst weggelassen — Neuanlage bucht ohnehin keine Korrektur
    });

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.type !== 'correction')).toBe(true);
    expect(txs.some((t) => t.type === 'entitlement' && t.days === 12)).toBe(true);
    expect(txs.some((t) => t.type === 'carryover' && t.days === 4)).toBe(true);
  });

  it('11. upsertVacationBalance weist eine leere Begründung ebenfalls ab', () => {
    const userId = createTestUser();
    createTestBalance(userId, YEAR, 30, 0, 0);

    expect(() =>
      upsertVacationBalance({
        userId,
        year: YEAR,
        entitlement: 0,
        carryover: 0,
        reason: '',
        actorId: adminId,
      })
    ).toThrow(/Begründung/);

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(0);
  });
});
