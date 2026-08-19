import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { buildBackfillPlan, hasExistingBackfill, BACKFILL_MARKER } from './vacationBackfillService.js';
import { recordVacationTransaction } from './vacationTransactionService.js';

/**
 * Tests für den Backfill.
 *
 * Kernbedingung: Die geplanten Buchungen müssen exakt den heutigen Saldo ergeben.
 * Der Backfill darf keinen einzigen Tag erfinden oder verlieren.
 */
describe('vacationBackfillService', () => {
  let userId: number;

  beforeEach(() => {
    const u = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testuser_backfill', 'bf@test.local', 'Back', 'Fill', 'hash', 'employee', 40, '2026-01-01');
    userId = u.lastInsertRowid as number;
  });

  afterEach(() => {
    db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(userId);
    db.prepare(`DELETE FROM audit_log WHERE entity = 'absence_request' AND entityId IN
                (SELECT id FROM absence_requests WHERE userId = ?)`).run(userId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  function setBalance(year: number, entitlement: number, carryover: number, taken: number) {
    db.prepare(`INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
                VALUES (?, ?, ?, ?, ?)`).run(userId, year, entitlement, carryover, taken);
  }

  function addAbsence(status: string, days: number, startDate: string, endDate: string): number {
    const r = db.prepare(`INSERT INTO absence_requests (userId, type, startDate, endDate, days, status)
                          VALUES (?, 'vacation', ?, ?, ?, ?)`).run(userId, startDate, endDate, days, status);
    return r.lastInsertRowid as number;
  }

  function addAudit(absenceId: number, action: string, createdAt: string) {
    db.prepare(`INSERT INTO audit_log (userId, action, entity, entityId, changes, createdAt)
                VALUES (?, 'update', 'absence_request', ?, ?, ?)`)
      .run(userId, absenceId, JSON.stringify({ action }), createdAt);
  }

  function planFor(year: number) {
    return buildBackfillPlan().accounts.find(a => a.userId === userId && a.year === year);
  }

  it('erzeugt Anspruch und Verbrauch, Summe entspricht dem Konto', () => {
    setBalance(2026, 20, 0, 5);
    addAbsence('approved', 5, '2026-03-01', '2026-03-05');

    const acc = planFor(2026)!;
    expect(acc.entries).toHaveLength(2);
    expect(acc.plannedSum).toBe(15);
    expect(acc.actualBalance).toBe(15);
    expect(acc.reconciliation).toBe(0);
  });

  it('rekonstruiert ein Storno als Buchungspaar — der auslösende Fall', () => {
    // Carmens Antrag #61: genehmigt, später storniert. Nach dem Fix ist taken = 0,
    // das Journal muss beide Vorgänge zeigen und sich zu 0 aufheben.
    setBalance(2026, 20, 0, 0);
    const id = addAbsence('rejected', 6, '2026-08-24', '2026-09-03');
    addAudit(id, 'approve', '2026-05-22 08:00:45');
    addAudit(id, 'reject', '2026-08-18 08:28:50');

    const acc = planFor(2026)!;
    const taken = acc.entries.find(e => e.type === 'vacation_taken');
    const reverted = acc.entries.find(e => e.type === 'vacation_reverted');

    expect(taken?.days).toBe(-6);
    expect(reverted?.days).toBe(6);
    expect(acc.plannedSum).toBe(20);
    expect(acc.reconciliation).toBe(0);

    // Chronologie: Genehmigung trägt das Genehmigungsdatum, nicht den Urlaubsbeginn —
    // sonst stünde der Storno im Auszug vor der Genehmigung.
    expect(taken?.date).toBe('2026-05-22');
    expect(reverted?.date).toBe('2026-08-18');
    expect(taken!.date < reverted!.date).toBe(true);
  });

  it('bucht nichts für einen direkt abgelehnten Antrag', () => {
    // Nie genehmigt = nie verbraucht = nichts zurückzubuchen.
    setBalance(2026, 20, 0, 0);
    const id = addAbsence('rejected', 6, '2026-08-24', '2026-09-03');
    addAudit(id, 'reject', '2026-08-18 08:28:50');

    const acc = planFor(2026)!;
    expect(acc.entries.filter(e => e.referenceId === id)).toHaveLength(0);
    expect(acc.plannedSum).toBe(20);
  });

  it('erzeugt keine Anspruchsbuchung bei 0 Urlaubstagen', () => {
    // Der Fall der sechs Mitarbeiter: Konto existiert, Anspruch ist 0.
    setBalance(2026, 0, 0, 0);
    const acc = planFor(2026)!;
    expect(acc.entries).toHaveLength(0);
    expect(acc.plannedSum).toBe(0);
    expect(acc.actualBalance).toBe(0);
  });

  it('stellt eine nicht erklärbare Differenz als Ausgleichsbuchung ein', () => {
    // taken = 6, aber kein Antrag erklärt das (Direkteingriff in die Datenbank).
    setBalance(2026, 20, 0, 6);

    const acc = planFor(2026)!;
    const reconciliation = acc.entries.find(e => e.type === 'correction');
    expect(reconciliation?.days).toBe(-6);
    expect(reconciliation?.description).toContain('Nicht rekonstruierbare');
    expect(acc.plannedSum).toBe(acc.actualBalance);
  });

  it('bucht den Übertrag aus dem Vorjahr', () => {
    setBalance(2026, 20, 5, 0);
    const acc = planFor(2026)!;
    const carryover = acc.entries.find(e => e.type === 'carryover');
    expect(carryover?.days).toBe(5);
    expect(carryover?.description).toContain('Übertrag aus 2025');
    expect(acc.plannedSum).toBe(25);
  });

  it('markiert jede Buchung als rückwirkend erzeugt', () => {
    setBalance(2026, 20, 0, 0);
    const acc = planFor(2026)!;
    for (const e of acc.entries) {
      expect(e.description).toContain(BACKFILL_MARKER);
    }
  });

  it('erkennt einen bereits gelaufenen Backfill', () => {
    setBalance(2026, 20, 0, 0);
    expect(hasExistingBackfill()).toBe(false);

    recordVacationTransaction({
      userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20,
      description: `Jahresanspruch 2026 ${BACKFILL_MARKER}`,
    });

    expect(hasExistingBackfill()).toBe(true);
  });

  it('sortiert die Buchungen chronologisch', () => {
    setBalance(2026, 20, 0, 3);
    addAbsence('approved', 3, '2026-06-01', '2026-06-03');

    const acc = planFor(2026)!;
    const dates = acc.entries.map(e => e.date);
    expect([...dates].sort()).toEqual(dates);
  });
});
