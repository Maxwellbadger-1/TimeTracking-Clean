import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  createAbsenceRequest,
  approveAbsenceRequest,
  rejectAbsenceRequest,
  deleteAbsenceRequest,
  getVacationBalance,
  hasEnoughVacationDays,
  initializeVacationBalance,
} from './absenceService.js';
import {
  getVacationBalanceFromTransactions,
  getVacationTransactionsForAbsence,
  getVacationTransactions,
} from './vacationTransactionService.js';
import { calculateProRataVacationDays } from './vacationBalanceService.js';
import { getUserById, ensureInitialWorkPeriod } from './userService.js';

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

    // Phase 11 (D4): Sollstunden-Berechnungen werfen ohne Arbeitszeitperiode
    // (MissingWorkPeriodError). Dieses Insert läuft am createUser()-Service vorbei, der eine
    // Periode automatisch anlegt — hier deshalb explizit nachgezogen (ensureInitialWorkPeriod
    // ist genau für diesen Fall gebaut, s. userService.ts).
    const testUser = getUserById(userId);
    if (testUser) ensureInitialWorkPeriod(testUser);
    const testAdmin = getUserById(adminId);
    if (testAdmin) ensureInitialWorkPeriod(testAdmin);
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

  it('10. Gap 1 (CR-02): hasEnoughVacationDays löst Auto-Init aus, die sofort ins Journal bucht', () => {
    // Bewusst OHNE approve/reject davor: eine Genehmigung würde ensureVacationBalanceExists()
    // auslösen und die Buchungslücke aus Gap 1 retroaktiv kaschieren, siehe 06-VERIFICATION.md.
    // Der in beforeEach angelegte Testnutzer hat hireDate '2020-01-01' — lange vor YEAR (2026) —
    // wodurch calculateProRataVacationDays() den vollen Jahreswert liefert. Dieser Test
    // exerziert damit NICHT den Pro-rata-Zweig (das leisten Test 12/13), sondern ausschließlich
    // die Buchungs-Delegation über upsertVacationBalance() selbst.
    const hasEnough = hasEnoughVacationDays(userId, YEAR, 5);
    expect(hasEnough).toBe(true);

    const balance = getVacationBalance(userId, YEAR);
    expect(balance).not.toBeNull();
    expect(balance?.entitlement).toBe(30);

    const txs = getVacationTransactions(userId, { year: YEAR });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('entitlement');
    expect(txs[0].days).toBe(30);

    expect(getVacationBalanceFromTransactions(userId, YEAR)).toBe(30);
  });

  it('11. Gap 3 (REQ-15): jahresübergreifender Antrag bucht vollständig ins Startjahr (bekannt, laut ROADMAP.md bewusst nicht behoben)', async () => {
    // 2090er-Datumsbereich: `holidays` enthält laut Verifikation (2026-08-21, `SELECT MAX(date)
    // FROM holidays` = 2029-12-26) keine Einträge nach 2029 — dieser Test bleibt damit robust
    // gegen künftige Änderungen/Ergänzungen der Feiertagsdaten für 2026/2027.
    // Dieser Test dokumentiert das bekannte Verhalten, ohne es zu verändern: kein Task in
    // diesem Plan ändert updateBalancesAfterApproval()s Jahresermittlung
    // (parseInt(request.startDate.substring(0, 4))).
    const request = createAbsenceRequest({
      userId, type: 'vacation', startDate: '2090-12-27', endDate: '2091-01-02',
    });

    await approveAbsenceRequest(request.id, adminId);

    // Für dieses (frische, weil 2090 zuvor unbenutzte) Jahr bucht die Genehmigung zusätzlich
    // zur eigentlichen vacation_taken-Buchung auch den Auto-Init-Anspruch (Gap 1, Test 10) —
    // deshalb wird hier gezielt nach dem Verbrauchs-Buchungstyp gefiltert statt die
    // Jahressumme zu bilden.
    const startYearTxs = getVacationTransactions(userId, { year: 2090 });
    const takenTxs = startYearTxs.filter((tx) => tx.type === 'vacation_taken');
    expect(takenTxs).toHaveLength(1);
    expect(takenTxs[0].days).toBe(-request.days);

    // Die Buchung fällt vollständig ins Startjahr — keine anteilige Gegenbuchung im Folgejahr.
    const endYearTxs = getVacationTransactions(userId, { year: 2091 });
    const endYearTakenTxs = endYearTxs.filter((tx) => tx.type === 'vacation_taken');
    expect(endYearTakenTxs).toHaveLength(0);
  });

  it('12. Zusatzbefund: unterjähriger Eintritt bucht den Pro-rata-Wert, nicht den vollen Jahresanspruch', () => {
    // Vor diesem Fix hätte initializeVacationBalance() hier entitlement === 24 (voller
    // Jahreswert) gebucht statt des anteiligen Werts — dieser Test ist ein Regressionswächter
    // spezifisch für den Koordinator-Zusatzbefund aus 06-VERIFICATION.md, unabhängig von der
    // Buchungs-Delegation aus Task 1.
    const hireDate = `${YEAR}-07-01`; // Eintritt mitten im Jahr
    const vacationDaysPerYear = 24; // bewusst von Test 10s Wert (30) verschieden

    const newUser = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, vacationDaysPerYear, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_proRata_midyear', 'proRata-midyear@test.local', 'Test', 'User', 'hash',
      'employee', 40, vacationDaysPerYear, hireDate
    );
    const newUserId = newUser.lastInsertRowid as number;

    try {
      const expectedProRata = calculateProRataVacationDays(hireDate, vacationDaysPerYear, YEAR);
      expect(expectedProRata).toBeLessThan(vacationDaysPerYear); // Sanity: tatsächlich anteilig

      const result = initializeVacationBalance(newUserId, YEAR);
      expect(result.entitlement).toBe(expectedProRata);

      const txs = getVacationTransactions(newUserId, { year: YEAR });
      expect(txs).toHaveLength(1);
      expect(txs[0].type).toBe('entitlement');
      expect(txs[0].days).toBe(expectedProRata);
    } finally {
      db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(newUserId);
      db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(newUserId);
      db.prepare('DELETE FROM users WHERE id = ?').run(newUserId);
    }
  });

  it('13. Zusatzbefund: Eintritt nach dem angefragten Jahr bucht entitlement=0, keine Buchung (reproduziert den realen Produktionsfehler)', () => {
    // Reproduziert exakt das Muster, das die realen 2025er-Artefakte (Karin Jochem 7 Tage,
    // Christine Glas 13 Tage) erzeugt hat: initializeVacationBalance() für ein Jahr VOR dem
    // Eintrittsjahr anfragen. Vor diesem Fix hätte die Funktion hier fälschlich
    // entitlement === 20 gebucht, obwohl der Nutzer erst im Folgejahr eintritt.
    const hireDate = `${YEAR}-01-01`; // Eintritt IN YEAR
    const vacationDaysPerYear = 20;

    const newUser = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, vacationDaysPerYear, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_proRata_notyet', 'proRata-notyet@test.local', 'Test', 'User', 'hash',
      'employee', 40, vacationDaysPerYear, hireDate
    );
    const newUserId = newUser.lastInsertRowid as number;

    try {
      expect(() => {
        const result = initializeVacationBalance(newUserId, YEAR - 1);
        expect(result.entitlement).toBe(0);
      }).not.toThrow();

      const txs = getVacationTransactions(newUserId, { year: YEAR - 1 });
      expect(txs).toHaveLength(0);
    } finally {
      db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(newUserId);
      db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(newUserId);
      db.prepare('DELETE FROM users WHERE id = ?').run(newUserId);
    }
  });
});
