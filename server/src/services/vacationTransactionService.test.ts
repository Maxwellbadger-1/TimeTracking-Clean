import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  recordVacationTransaction,
  getVacationBalanceFromTransactions,
  getVacationTransactions,
  getVacationTransactionsForAbsence,
  getVacationJournalEntries,
  getVacationAccountStatement,
} from './vacationTransactionService.js';

/**
 * Tests für das Urlaubs-Journal.
 *
 * Der wichtigste Test ist Nr. 4 unter "Der auslösende Fall": Er bildet exakt den Vorgang
 * ab, der diese ganze Arbeit ausgelöst hat — ein genehmigter Urlaub, der später storniert
 * wurde, ohne dass die Tage zurückkamen. In Buchungsform darf das nicht mehr möglich sein.
 */
describe('vacationTransactionService', () => {
  let userId: number;
  let adminId: number;
  let absenceId: number;

  beforeEach(() => {
    const user = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testuser_vacation_tx', 'vac@test.local', 'Test', 'User', 'hash', 'employee', 40, '2026-01-01');
    userId = user.lastInsertRowid as number;

    const admin = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('testadmin_vacation_tx', 'vacadmin@test.local', 'Test', 'Admin', 'hash', 'admin', 40, '2026-01-01');
    adminId = admin.lastInsertRowid as number;

    // Für die Kontoauszug-Tests: eine vacation_balance-Zeile 2026 und ein Antrag,
    // auf den eine Journalzeile mit referenceType='absence' verweisen kann.
    db.prepare(`
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 2026, 20, 0, 0);

    const absence = db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, days, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'vacation', '2026-08-24', '2026-08-29', 4, 'approved');
    absenceId = absence.lastInsertRowid as number;
  });

  afterEach(() => {
    db.prepare('DELETE FROM vacation_transactions WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM vacation_balance WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM absence_requests WHERE userId IN (?, ?)').run(userId, adminId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userId, adminId);
  });

  describe('Buchen und Lesen', () => {
    it('schreibt eine Buchung mit allen Feldern', () => {
      const id = recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'entitlement',
        days: 20, description: 'Jahresanspruch 2026',
        referenceType: 'system', createdBy: adminId,
      });

      const tx = db.prepare('SELECT * FROM vacation_transactions WHERE id = ?').get(id) as any;
      expect(tx.userId).toBe(userId);
      expect(tx.year).toBe(2026);
      expect(tx.type).toBe('entitlement');
      expect(tx.days).toBe(20);
      expect(tx.description).toBe('Jahresanspruch 2026');
      expect(tx.referenceType).toBe('system');
      expect(tx.createdBy).toBe(adminId);
    });

    it('führt balanceBefore/balanceAfter über eine Kette korrekt fort', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-03-01', type: 'vacation_taken', days: -5, description: 'Urlaub März' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-06-01', type: 'vacation_taken', days: -3, description: 'Urlaub Juni' });

      const txs = getVacationTransactions(userId, { year: 2026 });
      expect(txs.map(t => [t.balanceBefore, t.balanceAfter])).toEqual([[0, 20], [20, 15], [15, 12]]);
    });

    it('liefert 0 für ein leeres Konto', () => {
      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(0);
    });

    it('summiert halbe Tage korrekt', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 25.5, description: 'Anspruch anteilig' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-05-01', type: 'vacation_taken', days: -0.5, description: 'Halber Tag' });
      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(25);
    });

    it('trennt Jahre voneinander', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch 2026' });
      recordVacationTransaction({ userId, year: 2027, date: '2027-01-01', type: 'entitlement', days: 30, description: 'Anspruch 2027' });
      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(20);
      expect(getVacationBalanceFromTransactions(userId, 2027)).toBe(30);
    });
  });

  describe('Der auslösende Fall — Storno eines genehmigten Urlaubs', () => {
    it('gibt die Tage bei einem Storno vollständig zurück', () => {
      // Carmen Rothemund, August 2026: 20 Tage Anspruch, 6 Tage genehmigt (24.08.–03.09.),
      // später storniert mit dem Vermerk "Änderung". Vor dem Fix blieb ihr Konto bei 14 —
      // die 6 Tage waren dauerhaft weg. Als Buchungen muss der Rest wieder 20 sein.
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Jahresanspruch 2026' });
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6,
        description: 'Urlaub 24.08.–03.09. genehmigt', referenceType: 'absence', referenceId: 61, createdBy: adminId,
      });
      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(14);

      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-18', type: 'vacation_reverted', days: 6,
        description: 'Storno: Änderung', referenceType: 'absence', referenceId: 61, createdBy: adminId,
      });

      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(20);
    });

    it('macht eine fehlende Gegenbuchung am Antrag sichtbar', () => {
      // Der Konsistenzprüfer in Phase 7 baut darauf auf: Buchungen zu einem stornierten
      // Antrag müssen sich zu 0 aufheben. Tun sie das nicht, fehlt die Gegenbuchung.
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6,
        description: 'Urlaub genehmigt', referenceType: 'absence', referenceId: 61,
      });
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-18', type: 'vacation_reverted', days: 6,
        description: 'Storno', referenceType: 'absence', referenceId: 61,
      });

      const forAbsence = getVacationTransactionsForAbsence(61);
      expect(forAbsence).toHaveLength(2);
      expect(forAbsence.reduce((s, t) => s + t.days, 0)).toBe(0);
    });

    it('bucht bei Wieder-Genehmigung nicht doppelt', () => {
      // pending -> approved -> rejected -> approved ergab früher taken = 2 x Tage.
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6, description: 'genehmigt', referenceType: 'absence', referenceId: 61 });
      recordVacationTransaction({ userId, year: 2026, date: '2026-08-25', type: 'vacation_reverted', days: 6, description: 'storniert', referenceType: 'absence', referenceId: 61 });
      recordVacationTransaction({ userId, year: 2026, date: '2026-08-26', type: 'vacation_taken', days: -6, description: 'erneut genehmigt', referenceType: 'absence', referenceId: 61 });

      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(14);
    });
  });

  describe('Ungültige Buchungen werden abgewiesen', () => {
    it('ohne Begründung', () => {
      expect(() => recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: '',
      })).toThrow(/description ist Pflicht/);
    });

    it('mit nur Leerzeichen als Begründung', () => {
      expect(() => recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: '   ',
      })).toThrow(/description ist Pflicht/);
    });

    it('mit days = 0', () => {
      expect(() => recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'correction', days: 0, description: 'Nullbuchung',
      })).toThrow(/ungleich 0/);
    });

    it('mit unbekanntem Typ', () => {
      expect(() => recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'quatsch' as never, days: 1, description: 'Test',
      })).toThrow(/unbekannter Typ/);
    });

    it('mit unplausiblem Jahr', () => {
      expect(() => recordVacationTransaction({
        userId, year: 1899, date: '1899-01-01', type: 'entitlement', days: 20, description: 'Test',
      })).toThrow(/year muss zwischen/);
    });
  });

  describe('Reihenfolge und Transaktionsklammer', () => {
    it('sortiert bei gleichem Datum stabil nach id', () => {
      const a = recordVacationTransaction({ userId, year: 2026, date: '2026-08-18', type: 'vacation_reverted', days: 6, description: 'Storno' });
      const b = recordVacationTransaction({ userId, year: 2026, date: '2026-08-18', type: 'vacation_taken', days: -1, description: 'Neuer Antrag' });
      expect(getVacationTransactions(userId, { year: 2026 }).map(t => t.id)).toEqual([a, b]);
    });

    it('ist in db.transaction() verwendbar und wird bei einem Fehler zurückgerollt', () => {
      // Das ist die Voraussetzung für Phase 6: Statuswechsel und Buchung müssen gemeinsam
      // gelingen oder gemeinsam scheitern.
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });

      const failing = db.transaction(() => {
        recordVacationTransaction({ userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6, description: 'Urlaub' });
        throw new Error('Simulierter Fehler nach der Buchung');
      });

      expect(() => failing()).toThrow('Simulierter Fehler nach der Buchung');
      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(20);
      expect(getVacationTransactions(userId, { year: 2026 })).toHaveLength(1);
    });

    it('schreibt mehrere Buchungen einer Transaktion gemeinsam', () => {
      const ok = db.transaction(() => {
        recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
        recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'carryover', days: 5, description: 'Übertrag 2025' });
      });
      ok();

      expect(getVacationBalanceFromTransactions(userId, 2026)).toBe(25);
      expect(getVacationTransactions(userId, { year: 2026 })).toHaveLength(2);
    });
  });

  describe('Kontoauszug', () => {
    it('liefert absence === null für eine Buchung ohne referenceType absence', () => {
      recordVacationTransaction({
        userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20,
        description: 'Jahresanspruch', referenceType: 'system',
      });

      const entries = getVacationJournalEntries(userId, { year: 2026 });
      expect(entries).toHaveLength(1);
      expect(entries[0].absence).toBeNull();
    });

    it('liefert die Antragsdaten für eine Buchung mit referenceType absence und existierendem Antrag', () => {
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -4,
        description: 'Urlaub genehmigt', referenceType: 'absence', referenceId: absenceId,
      });

      const entries = getVacationJournalEntries(userId, { year: 2026 });
      expect(entries).toHaveLength(1);
      expect(entries[0].absence).toEqual({
        id: absenceId,
        type: 'vacation',
        startDate: '2026-08-24',
        endDate: '2026-08-29',
        status: 'approved',
        days: 4,
      });
    });

    it('liefert absence === null, wenn der verknüpfte Antrag gelöscht wurde (kein Absturz)', () => {
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -4,
        description: 'Urlaub zu gelöschtem Antrag', referenceType: 'absence', referenceId: 999999,
      });

      const entries = getVacationJournalEntries(userId, { year: 2026 });
      expect(entries).toHaveLength(1);
      expect(entries[0].absence).toBeNull();
    });

    it('sortiert date ASC, id ASC — ein Storno steht nach der Genehmigung, die er aufhebt', () => {
      const approved = recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -4,
        description: 'genehmigt', referenceType: 'absence', referenceId: absenceId,
      });
      const reverted = recordVacationTransaction({
        userId, year: 2026, date: '2026-08-25', type: 'vacation_reverted', days: 4,
        description: 'storniert', referenceType: 'absence', referenceId: absenceId,
      });

      const entries = getVacationJournalEntries(userId, { year: 2026 });
      expect(entries.map(e => e.id)).toEqual([approved, reverted]);
    });

    it('grenzt year auf ein Jahr ein und limit begrenzt die Zeilenzahl', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch 2026' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-02-01', type: 'correction', days: 1, description: 'Korrektur' });
      recordVacationTransaction({ userId, year: 2027, date: '2027-01-01', type: 'entitlement', days: 25, description: 'Anspruch 2027' });

      const entries2026 = getVacationJournalEntries(userId, { year: 2026 });
      expect(entries2026).toHaveLength(2);
      expect(entries2026.every(e => e.year === 2026)).toBe(true);

      const limited = getVacationJournalEntries(userId, { year: 2026, limit: 1 });
      expect(limited).toHaveLength(1);
    });

    it('liest entitlement, carryover, taken aus vacation_balance; available = entitlement + carryover - taken', () => {
      db.prepare(`UPDATE vacation_balance SET entitlement = ?, carryover = ?, taken = ? WHERE userId = ? AND year = ?`)
        .run(20, 3, 5, userId, 2026);

      const statement = getVacationAccountStatement(userId, 2026);
      expect(statement.entitlement).toBe(20);
      expect(statement.carryover).toBe(3);
      expect(statement.taken).toBe(5);
      expect(statement.available).toBe(18);
    });

    it('journalBalance ist die Summe aller days des Jahres', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
      recordVacationTransaction({ userId, year: 2026, date: '2026-03-01', type: 'vacation_taken', days: -6, description: 'Urlaub' });

      const statement = getVacationAccountStatement(userId, 2026);
      expect(statement.journalBalance).toBe(14);
    });

    it('nach Anspruchs- und Urlaubsbuchung gilt available === journalBalance (Phase-7-Invariante)', () => {
      recordVacationTransaction({ userId, year: 2026, date: '2026-01-01', type: 'entitlement', days: 20, description: 'Anspruch' });
      recordVacationTransaction({
        userId, year: 2026, date: '2026-08-24', type: 'vacation_taken', days: -6,
        description: 'Urlaub genehmigt', referenceType: 'absence', referenceId: absenceId,
      });

      const statement = getVacationAccountStatement(userId, 2026);
      expect(statement.available).toBe(statement.journalBalance);
    });

    it('ohne vacation_balance-Zeile sind entitlement, carryover, taken, available je 0 — transactions bleibt gefüllt', () => {
      recordVacationTransaction({ userId, year: 2025, date: '2025-01-01', type: 'entitlement', days: 15, description: 'Anspruch 2025' });

      const statement = getVacationAccountStatement(userId, 2025);
      expect(statement.entitlement).toBe(0);
      expect(statement.carryover).toBe(0);
      expect(statement.taken).toBe(0);
      expect(statement.available).toBe(0);
      expect(statement.transactions).toHaveLength(1);
    });
  });
});
