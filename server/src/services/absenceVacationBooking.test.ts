import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  createAbsenceRequest,
  approveAbsenceRequest,
  rejectAbsenceRequest,
  deleteAbsenceRequest,
  getVacationBalance,
} from './absenceService.js';
import {
  getVacationBalanceFromTransactions,
  getVacationTransactionsForAbsence,
} from './vacationTransactionService.js';

/**
 * Regressionstests für REQ-05 / REQ-15 — die Fehler, die diesen Milestone ausgelöst haben.
 *
 * Am 18.08.2026 gingen Urlaubstage beim Ablehnen genehmigter Anträge verloren, weil die
 * Gegenbuchung an einer der drei Aufrufstellen (approve/reject/delete) schlicht vergessen
 * wurde. Seit Phase 6 sitzt die Buchung nicht mehr bei den Aufrufern, sondern an der
 * einzigen Stelle, die `vacation_balance.taken` tatsächlich verändert
 * (`updateBalancesAfterApproval` / `revertBalancesAfterDeletion`) — per Konstruktion kann
 * eine Änderung an `taken` jetzt nicht mehr ohne zugehörige Buchung passieren.
 *
 * Jeder Test prüft BEIDES — `vacation_balance.taken` UND den Journal-Saldo. Sie müssen
 * übereinstimmen; genau diese Übereinstimmung ist ab Phase 7 die Grundlage für den
 * abgeleiteten Saldo.
 */
describe('absenceService — Urlaubsbuchungen bei jedem Vorgang', () => {
  let userId: number;
  let adminId: number;
  const YEAR = 2026;

  beforeEach(() => {
    const user = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testuser_absence_booking', 'absence-booking@test.local', 'Test', 'User', 'hash', 'employee', 40, '2020-01-01');
    userId = user.lastInsertRowid as number;

    const admin = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testadmin_absence_booking', 'absence-booking-admin@test.local', 'Test', 'Admin', 'hash', 'admin', 40, '2020-01-01');
    adminId = admin.lastInsertRowid as number;
  });

  afterEach(() => {
    db.prepare('DELETE FROM vacation_transactions WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM overtime_balance WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM work_time_accounts WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM absence_requests WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM vacation_balance WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userId, adminId);
  });

  /**
   * `taken` aus vacation_balance und der verbrauchte Anteil laut Journal.
   *
   * ANGEPASST IN PHASE 7. Ursprünglich verglich dieser Helfer `taken` direkt mit der
   * Journal-Summe und erwartete `journal === -taken`. Diese Annahme galt nur, solange das
   * Journal ausschließlich Verbrauchsbuchungen enthielt.
   *
   * Seit das Journal auch Anspruch und Übertrag führt (06-02, und in Phase 7 garantiert für
   * jedes Konto), ist die Journal-Summe der **verfügbare Rest**, nicht der Verbrauch:
   *
   *     journalSaldo = entitlement + carryover − taken
   *
   * `consumed` rechnet das auf den Verbrauch zurück, damit die Aussagen der Tests
   * unverändert lesbar bleiben. Zusätzlich prüft jeder Aufruf die Invariante selbst —
   * damit testet dieser Helfer genau das, was Phase 7 garantieren soll.
   */
  function balances(): { taken: number; journal: number } {
    const balance = getVacationBalance(userId, YEAR);
    const taken = balance?.taken ?? 0;
    const journalSaldo = getVacationBalanceFromTransactions(userId, YEAR);
    const entitlement = balance?.entitlement ?? 0;
    const carryover = balance?.carryover ?? 0;

    // Invariante: Journal-Saldo und Konto müssen sich entsprechen — aber nur, wenn
    // überhaupt gebucht wurde. Ein Konto ohne jede Buchung ist der legitime Zustand vor
    // dem ersten Vorgang (und vor dem Backfill); der Konsistenzprüfer behandelt ihn
    // ebenfalls gesondert als `no_journal` statt als Fehler.
    const hasJournal = db.prepare(
      'SELECT COUNT(*) AS cnt FROM vacation_transactions WHERE userId = ? AND year = ?'
    ).get(userId, YEAR) as { cnt: number };

    if (hasJournal.cnt > 0) {
      expect(Math.abs(journalSaldo - (entitlement + carryover - taken))).toBeLessThan(0.011);
    }

    // Ohne Journal gibt es keinen gebuchten Verbrauch — dann ist der Zählerstand die
    // einzige Aussage. Die Rückrechnung würde hier den ungebuchten Anspruch als
    // vermeintlichen Verbrauch ausweisen (−30 statt 0).
    const consumed = hasJournal.cnt > 0
      ? Math.round((journalSaldo - entitlement - carryover) * 100) / 100
      : -taken;

    // `-0` normalisieren: toBe() nutzt Object.is, und Object.is(-0, 0) ist false.
    return { taken, journal: consumed === 0 ? 0 : consumed };
  }

  it('1. Genehmigung: taken steigt um die Tage, eine vacation_taken-Buchung mit negativen Tagen', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-02', endDate: '2026-03-03',
    });
    expect(request.days).toBe(2);

    await approveAbsenceRequest(request.id, adminId);

    const { taken, journal } = balances();
    expect(taken).toBe(2);
    expect(journal).toBe(-2);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('vacation_taken');
    expect(txs[0].days).toBe(-2);
  });

  it('2. Der auslösende Fall: genehmigen, dann ablehnen — taken zurück, zwei Buchungen heben sich zu 0 auf', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-09', endDate: '2026-03-10',
    });

    await approveAbsenceRequest(request.id, adminId);
    await rejectAbsenceRequest(request.id, adminId);

    const { taken, journal } = balances();
    expect(taken).toBe(0);
    expect(journal).toBe(0);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(2);
    expect(txs[0].type).toBe('vacation_taken');
    expect(txs[1].type).toBe('vacation_reverted');
    expect(txs[0].days + txs[1].days).toBe(0);
  });

  it('3. Doppelbuchung: pending → approved → rejected → approved — taken = Tage (nicht 2x), drei Buchungen', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-16', endDate: '2026-03-17',
    });

    await approveAbsenceRequest(request.id, adminId);
    await rejectAbsenceRequest(request.id, adminId);
    await approveAbsenceRequest(request.id, adminId);

    const { taken, journal } = balances();
    expect(taken).toBe(2);
    expect(journal).toBe(-2);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(3);
  });

  it('4. Löschung eines genehmigten Antrags — taken zurück, Gegenbuchung vorhanden', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-23', endDate: '2026-03-24',
    });

    await approveAbsenceRequest(request.id, adminId);
    deleteAbsenceRequest(request.id, adminId);

    const { taken, journal } = balances();
    expect(taken).toBe(0);
    expect(journal).toBe(0);

    // Journalbuchungen überleben das Löschen des Antrags (referenceId zeigt bewusst ins Leere)
    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(2);
    expect(txs[1].type).toBe('vacation_reverted');
    expect(txs[1].createdBy).toBe(adminId);
  });

  it('5. Ablehnung eines noch offenen Antrags — taken unverändert, keine Buchung', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-30', endDate: '2026-03-31',
    });

    await rejectAbsenceRequest(request.id, adminId);

    const { taken, journal } = balances();
    expect(taken).toBe(0);
    expect(journal).toBe(0);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(0);
  });

  it('6. Krankmeldung (auto-genehmigt) — keine Urlaubsbuchung', () => {
    const request = createAbsenceRequest({
      userId, type: 'sick', startDate: '2026-05-04', endDate: '2026-05-05',
    });
    expect(request.status).toBe('approved');

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(0);
    expect(getVacationBalance(userId, YEAR)?.taken ?? 0).toBe(0);
  });

  it('7a. Unbezahlter Urlaub — keine Urlaubsbuchung', async () => {
    const request = createAbsenceRequest({
      userId, type: 'unpaid', startDate: '2026-05-11', endDate: '2026-05-12',
    });

    await approveAbsenceRequest(request.id, adminId);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(0);
    expect(getVacationBalance(userId, YEAR)?.taken ?? 0).toBe(0);
  });

  it('7b. Überstundenausgleich — keine Urlaubsbuchung', async () => {
    // Überstundenguthaben aufbauen — createAbsenceRequest prüft für overtime_comp direkt
    // getOvertimeBalance() gegen die benötigten Stunden (2 Tage à 8h = 16h).
    db.prepare(`
      INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
      VALUES (?, '2026-01', 100, 120)
    `).run(userId);

    const request = createAbsenceRequest({
      userId, type: 'overtime_comp', startDate: '2026-05-18', endDate: '2026-05-19',
    });

    await approveAbsenceRequest(request.id, adminId);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(0);
    expect(getVacationBalance(userId, YEAR)?.taken ?? 0).toBe(0);
  });

  it('8. Konsistenz nach jedem Vorgang: taken == -(Summe der Journalbuchungen des Jahres)', async () => {
    // taken + journal muss immer 0 ergeben. Summenvergleich statt direktem Vorzeichenvergleich,
    // damit +0/-0 (JS-Fließkomma-Eigenheit bei runden Salden) die Assertion nicht verfälscht.
    const assertConsistent = () => {
      const { taken, journal } = balances();
      expect(taken + journal).toBe(0);
    };

    const r1 = createAbsenceRequest({ userId, type: 'vacation', startDate: '2026-03-02', endDate: '2026-03-03' });
    await approveAbsenceRequest(r1.id, adminId);
    assertConsistent();

    const r2 = createAbsenceRequest({ userId, type: 'vacation', startDate: '2026-03-09', endDate: '2026-03-10' });
    await approveAbsenceRequest(r2.id, adminId);
    assertConsistent();

    await rejectAbsenceRequest(r2.id, adminId);
    assertConsistent();

    deleteAbsenceRequest(r1.id, adminId);
    assertConsistent();
  });

  it('9. Der Auslöser ist im Journal nachvollziehbar: createdBy und referenceId gesetzt', async () => {
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2026-03-16', endDate: '2026-03-17',
    });

    await approveAbsenceRequest(request.id, adminId);

    const txs = getVacationTransactionsForAbsence(request.id);
    expect(txs).toHaveLength(1);
    expect(txs[0].createdBy).toBe(adminId);
    expect(txs[0].referenceId).toBe(request.id);
    expect(txs[0].referenceType).toBe('absence');
  });
});
