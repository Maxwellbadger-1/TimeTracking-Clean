import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { checkVacationConsistency } from './vacationConsistencyService.js';
import { recordVacationTransaction } from './vacationTransactionService.js';

/**
 * Tests für den Konsistenzprüfer.
 *
 * Der wichtigste ist "erkennt ein Storno ohne Gegenbuchung" — das ist exakt der Fehler,
 * der drei Monate unentdeckt blieb und 16 Urlaubstage gekostet hat. Der Prüfer existiert,
 * damit so etwas künftig am selben Tag auffällt.
 */
describe('vacationConsistencyService', () => {
  let userId: number;

  beforeEach(() => {
    const u = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testuser_consistency', 'cons@test.local', 'Konsi', 'Stenz', 'hash', 'employee', 40, '2026-01-01');
    userId = u.lastInsertRowid as number;

    db.prepare(`INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
                VALUES (?, 2026, 20, 0, 0)`).run(userId);
  });

  afterEach(() => {
    db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  /** Legt einen Urlaubsantrag an und gibt seine id zurück */
  function createAbsence(status: string, days: number, startDate = '2026-08-24', endDate = '2026-08-28'): number {
    const r = db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, days, status)
      VALUES (?, 'vacation', ?, ?, ?, ?)
    `).run(userId, startDate, endDate, days, status);
    return r.lastInsertRowid as number;
  }

  it('meldet ein sauberes Konto ohne Fehler', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    const report = checkVacationConsistency({ userId });
    expect(report.ok).toBe(true);
    expect(report.summary.error).toBe(0);
  });

  it('erkennt eine Abweichung zwischen Journal und vacation_balance', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    // taken am Journal vorbei verändern — genau das darf nicht unbemerkt bleiben
    db.prepare('UPDATE vacation_balance SET taken = 5 WHERE userId = ? AND year = 2026').run(userId);

    const report = checkVacationConsistency({ userId });
    expect(report.ok).toBe(false);
    const finding = report.findings.find(f => f.check === 'balance');
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('Differenz');
  });

  it('erkennt einen genehmigten Antrag ohne Buchung', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    createAbsence('approved', 5);

    const report = checkVacationConsistency({ userId });
    const finding = report.findings.find(f => f.check === 'missing_booking');
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('genehmigt');
  });

  it('erkennt ein Storno ohne Gegenbuchung — der ursprüngliche Fehler', () => {
    // Carmens Fall: genehmigt, dann storniert, aber die Tage kamen nie zurück.
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    const absenceId = createAbsence('rejected', 6);
    recordVacationTransaction({
      userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6,
      description: 'Urlaub genehmigt', referenceType: 'absence', referenceId: absenceId,
    });
    // Die Gegenbuchung fehlt — genau der Zustand vom Mai bis August 2026.

    const report = checkVacationConsistency({ userId });
    expect(report.ok).toBe(false);
    const finding = report.findings.find(f => f.check === 'missing_reversal');
    expect(finding?.severity).toBe('error');
    expect(finding?.absenceId).toBe(absenceId);
    expect(finding?.message).toContain('zurückgebucht');
  });

  it('akzeptiert ein Storno mit vollständiger Gegenbuchung', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    const absenceId = createAbsence('rejected', 6);
    recordVacationTransaction({ userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6, description: 'genehmigt', referenceType: 'absence', referenceId: absenceId });
    recordVacationTransaction({ userId, year: 2026, date: '2026-08-25', type: 'vacation_reverted', days: 6, description: 'storniert', referenceType: 'absence', referenceId: absenceId });

    const report = checkVacationConsistency({ userId });
    expect(report.findings.filter(f => f.check === 'missing_reversal')).toHaveLength(0);
    expect(report.ok).toBe(true);
  });

  it('meldet verwaiste Buchungen als Hinweis, nicht als Fehler', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    recordVacationTransaction({
      userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -5,
      description: 'Urlaub aus geloeschtem Antrag', referenceType: 'absence', referenceId: 999999,
    });
    // Saldo passend halten, damit nur der Waisen-Befund übrig bleibt
    db.prepare('UPDATE vacation_balance SET taken = 5 WHERE userId = ? AND year = 2026').run(userId);

    const report = checkVacationConsistency({ userId });
    const finding = report.findings.find(f => f.check === 'orphaned_booking');
    expect(finding?.severity).toBe('info');
    expect(report.summary.error).toBe(0);
    expect(report.ok).toBe(true);
  });

  it('fasst ein leeres Journal zu einem Hinweis zusammen statt vieler Fehler', () => {
    // Zustand vor dem Backfill: Konto und Anträge existieren, Journal ist leer.
    createAbsence('approved', 5, '2026-03-01', '2026-03-05');
    createAbsence('approved', 3, '2026-04-01', '2026-04-03');
    createAbsence('rejected', 6);

    const report = checkVacationConsistency({ userId });
    const noJournal = report.findings.filter(f => f.check === 'no_journal');
    expect(noJournal).toHaveLength(1);
    expect(noJournal[0].severity).toBe('info');
    // Keine Einzelmeldungen zu den drei Anträgen — sonst wäre der Bericht unlesbar
    expect(report.findings.filter(f => f.check === 'missing_booking')).toHaveLength(0);
    expect(report.summary.error).toBe(0);
  });

  it('grenzt nach Jahr ein', () => {
    db.prepare(`INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
                VALUES (?, 2027, 20, 0, 0)`).run(userId);
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch 2026' });
    recordVacationTransaction({ userId, year: 2027, date: '2027-01-01', type: 'entitlement', days: 20, description: 'Anspruch 2027' });

    const report = checkVacationConsistency({ userId, year: 2026 });
    expect(report.checkedAccounts).toBe(1);
    expect(report.accounts[0].year).toBe(2026);
  });

  it('liefert je Konto Journal-Saldo, Kontowert und Differenz', () => {
    recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
    recordVacationTransaction({ userId, year: 2026, date: '2026-03-01', type: 'vacation_taken', days: -5, description: 'Urlaub' });
    db.prepare('UPDATE vacation_balance SET taken = 5 WHERE userId = ? AND year = 2026').run(userId);

    const report = checkVacationConsistency({ userId });
    const acc = report.accounts[0];
    expect(acc.journalBalance).toBe(15);
    expect(acc.balanceTableValue).toBe(15);
    expect(acc.difference).toBe(0);
    expect(acc.transactionCount).toBe(2);
  });
});
