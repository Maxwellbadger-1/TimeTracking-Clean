import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import {
  getWorkPeriodById,
  getWorkPeriods,
  getCurrentWorkPeriod,
  checkPeriodChain,
} from './workPeriodService.js';
import { applyWorkTimeChange, monthsInRange } from './workPeriodChangeService.js';
import { deleteWorkPeriod, WorkPeriodDeletionValidationError } from './workPeriodDeletionService.js';
import { createTransaction } from './overtimeTransactionManager.js';
import { calculateLiveOvertimeTransactions } from './overtimeLiveCalculationService.js';
import type { WorkPeriodDeletionInput, WorkTimeChangeInput } from '../types/index.js';

/**
 * WORK PERIOD DELETION SERVICE TESTS — der Doppelzählungs-Nachweis und die
 * Storno-Sichtbarkeit (13-04-PLAN.md, Task 2).
 *
 * DER NICHT VERHANDELBARE TEST DIESES PLANS ("Umstellung eintragen, löschen, Saldo ist
 * wieder da"): Eine Gegenbuchung, die tatsächlich in eine Summe eingeht, würde die
 * Rückabwicklung des Saldos verdoppeln — einmal aus dem Rebuild ab `validFrom` (die echte,
 * gewollte Wirkung, D4) und einmal aus der Gegenbuchung selbst. Zusicherung A prüft deshalb
 * AUSDRÜCKLICH den tatsächlich berechneten Saldo (`getOvertimeBalance()`), nicht die
 * Journalsumme — eine über die Summe geführte Prüfung würde genau diesen Fehler nicht
 * aufdecken (beide Fehlerquellen würden sich in der Summenprüfung gegenseitig verdecken).
 *
 * Läuft gegen die geteilte Verbindung aus `connection.js` (Muster aus
 * `workPeriodCorrectionService.test.ts`): kein `:memory:`, echte Testnutzer mit eindeutigem
 * `username` (Präfix `test-13-04-`), Aufräumen über `DELETE FROM users WHERE id = ?` (CASCADE
 * räumt `user_work_periods`/`overtime_transactions` ab; die übrigen Tabellen werden zusätzlich
 * explizit geräumt, weil parallel arbeitende Testdateien dieselbe Datenbank teilen).
 *
 * Alle Datumswerte sind relativ zu `getTodayString()` gebildet, kein `new Date('YYYY-MM-DD')`
 * (Zeitzonen-Off-by-one, Phase 9); Datumsfortschaltung ausschließlich über lokale
 * Kalenderfelder, wie im Service selbst.
 */

const USERNAME_PREFIX = 'test-13-04-';
const createdUserIds: number[] = [];

let adminId: number;

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);

  const username = `t1304-admin-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T1304', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  adminId = result.lastInsertRowid as number;
});

afterAll(() => {
  // WR-05-Muster: Jede gespeicherte Löschung legt einen audit_log-Eintrag mit
  // userId = adminId an. audit_log.userId zeigt per FOREIGN KEY auf users(id) OHNE
  // ON DELETE CASCADE — ohne dieses DELETE scheitert das Löschen des Testadmins.
  db.prepare('DELETE FROM audit_log WHERE userId = ?').run(adminId);
  db.prepare('DELETE FROM users WHERE id = ?').run(adminId);
});

/** Legt einen Testnutzer mit eindeutigem Namen an und merkt sich seine id fuer den
 *  Aufraeumnachweis am Dateiende. */
function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T1304', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/** Raeumt einen Testnutzer vollstaendig ab. CASCADE deckt user_work_periods und
 *  overtime_transactions bereits ab; die uebrigen Tabellen werden zur Sicherheit explizit
 *  geraeumt (Muster aus workPeriodCorrectionService.test.ts). */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
}

function countTransactions(userId: number): number {
  return (
    db.prepare('SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ?').get(userId) as {
      c: number;
    }
  ).c;
}

function sumTransactionHours(userId: number): number {
  return (
    db
      .prepare('SELECT COALESCE(SUM(hours), 0) as s FROM overtime_transactions WHERE userId = ?')
      .get(userId) as { s: number }
  ).s;
}

function countAuditLogEntries(entity: string, entityId: number): number {
  return (
    db.prepare('SELECT COUNT(*) as c FROM audit_log WHERE entity = ? AND entityId = ?').get(
      entity,
      entityId
    ) as { c: number }
  ).c;
}

/** YYYY-MM-DD einer lokalen Date-Instanz — keine ISO-String-Konvertierung ueber die
 *  Date-Klasse (Timezone-Bug-Vermeidung, `.claude/CLAUDE.md`). */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Erster Tag des Monats, der `deltaMonths` Monate von `baseIsoDate` entfernt liegt. Reine
 *  Kalenderarithmetik auf Zahlen, kein Date-String-Parsing. */
function firstOfMonthOffset(baseIsoDate: string, deltaMonths: number): string {
  const [y, m] = baseIsoDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + deltaMonths;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}-01`;
}

/** Fuegt fuer jeden Werktag (kein Wochenende, kein Feiertag) im Bereich [from, to] einen
 *  Zeiteintrag mit exakt `hoursPerWeekday` Stunden ein — reine Fixture, kein zweiter
 *  Rechenweg (die Sollstunden-Seite bleibt ausschliesslich Sache des Service). */
function insertWeekdayTimeEntries(
  userId: number,
  from: string,
  to: string,
  hoursPerWeekday: number
): void {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cursor = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);

  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = isoDate(cursor);
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) continue;

    db.prepare(
      `INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, dateStr, '08:00', '17:00', 0, hoursPerWeekday, 'office');
  }
}

function rebuildRange(userId: number, from: string, to: string): void {
  for (const month of monthsInRange(from, to)) {
    rebuildOvertimeTransactionsForMonth(userId, month);
  }
}

const today = getTodayString();

describe('deleteWorkPeriod — Doppelzaehlungs-Nachweis und Storno-Sichtbarkeit (13-04-PLAN.md)', () => {
  it(
    'Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE ' +
      'Saldo ist danach auf die Minute genau wieder der Stand von vorher (nicht nur die ' +
      'Journalsumme). Eine Gegenbuchung, die tatsaechlich in eine Summe eingeht, wuerde die ' +
      'Rueckabwicklung verdoppeln — Zusicherung A wuerde dann um genau balanceDelta ' +
      'danebenliegen.',
    () => {
      const hireDate = firstOfMonthOffset(today, -4);
      const changeDate = firstOfMonthOffset(hireDate, 2);
      const userId = createEmployee('doppelzaehlung', 40, hireDate);
      try {
        insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
        // 9h/Werktag gegen ein 40h/5-Tage-Sollmodell (8h/Tag) — ein echter, von 0
        // verschiedener Saldo vor jeder Umstellung.
        insertWeekdayTimeEntries(userId, hireDate, today, 9);
        rebuildRange(userId, hireDate, today);

        const saldoVorher = getOvertimeBalance(userId);
        const summeVorher = sumTransactionHours(userId);
        expect(saldoVorher).not.toBe(0);

        const changeInput: WorkTimeChangeInput = {
          userId,
          validFrom: changeDate,
          weeklyHours: 20,
          workSchedule: null,
          reason: 'Versehentlich eingetragene Umstellung fuer den Doppelzaehlungs-Nachweis',
        };
        const changeOutcome = applyWorkTimeChange(changeInput, { dryRun: false, createdBy: adminId });
        expect(changeOutcome.period).not.toBeNull();
        expect(changeOutcome.transactionId).not.toBeNull();
        expect(changeOutcome.preview.balanceDelta).not.toBe(0);

        // Schritt 3 (Plantext): Die Umstellung muss den Saldo nachweislich verschieben,
        // sonst misst der Rest dieses Tests nichts.
        expect(getOvertimeBalance(userId)).not.toBe(saldoVorher);

        const newPeriod = changeOutcome.period!;
        const originalTransactionId = changeOutcome.transactionId!;

        const deleteInput: WorkPeriodDeletionInput = {
          periodId: newPeriod.id,
          reason: 'Ruecknahme der versehentlich eingetragenen Umstellung',
        };
        const deleteOutcome = deleteWorkPeriod(deleteInput, { dryRun: false, createdBy: adminId });
        expect(deleteOutcome.reversalTransactionIds.length).toBe(1);

        // Zusicherung A — der eigentliche Nachweis: der TATSAECHLICH BERECHNETE Saldo, nicht
        // die Journalsumme, ist wieder auf die Minute (1/60 h) genau der Stand von vorher.
        expect(Math.abs(getOvertimeBalance(userId) - saldoVorher)).toBeLessThan(0.017);

        // Zusicherung B — Original und Gegenbuchung heben sich in der Datenbank exakt auf.
        expect(Math.abs(sumTransactionHours(userId) - summeVorher)).toBeLessThanOrEqual(0.01);

        // Zusicherung C — der Anzeigepfad: beide model_change-Zeilen mit hours === 0, und die
        // Summe der gelieferten hours entspricht dem tatsaechlich berechneten Saldo.
        const liveTransactions = calculateLiveOvertimeTransactions(userId, hireDate, today);
        const modelChangeRows = liveTransactions.filter((t) => t.type === 'model_change');
        expect(modelChangeRows.length).toBe(2);
        for (const row of modelChangeRows) {
          expect(row.hours).toBe(0);
        }
        const liveSum = liveTransactions.reduce((sum, t) => sum + t.hours, 0);
        expect(Math.abs(liveSum - getOvertimeBalance(userId))).toBeLessThanOrEqual(0.01);

        // Zusicherung D — nichts wurde entfernt: genau 2 Zeilen (Original + Gegenbuchung),
        // Original unveraendert, Gegenbuchung mit reversalOf und entgegengesetztem hours-Wert.
        const pairRows = db
          .prepare(
            `SELECT id, hours, reversalOf FROM overtime_transactions
             WHERE referenceType = 'work_period' AND referenceId = ?`
          )
          .all(newPeriod.id) as Array<{ id: number; hours: number; reversalOf: number | null }>;
        expect(pairRows.length).toBe(2);
        const originalRow = pairRows.find((r) => r.id === originalTransactionId);
        expect(originalRow).toBeDefined();
        expect(originalRow!.hours).toBe(changeOutcome.preview.balanceDelta);
        const reversalRow = pairRows.find((r) => r.reversalOf === originalTransactionId);
        expect(reversalRow).toBeDefined();
        expect(reversalRow!.hours).toBe(-originalRow!.hours);
      } finally {
        cleanupEmployee(userId);
      }
    }
  );

  it('D3: Loeschen von B in der Kette A-B-C schliesst die Luecke — A.validTo === C.validFrom', () => {
    const hireDate = firstOfMonthOffset(today, -3);
    const dateAB = firstOfMonthOffset(today, -2);
    const dateBC = firstOfMonthOffset(today, -1);
    const userId = createEmployee('lueckenschluss', 40, hireDate);
    try {
      insertTestWorkPeriod(userId, { validFrom: hireDate, validTo: dateAB, weeklyHours: 40, workSchedule: null });
      const periodB = insertTestWorkPeriod(userId, {
        validFrom: dateAB,
        validTo: dateBC,
        weeklyHours: 30,
        workSchedule: null,
      });
      insertTestWorkPeriod(userId, { validFrom: dateBC, weeklyHours: 40, workSchedule: null });

      const outcome = deleteWorkPeriod(
        { periodId: periodB.id, reason: 'Luecken-Test: B wird herausgenommen' },
        { dryRun: false, createdBy: adminId }
      );
      expect(outcome.preview.previousPeriod.newValidTo).toBe(dateBC);

      const remaining = getWorkPeriods(userId);
      expect(remaining.length).toBe(2);
      const periodA = remaining.find((p) => p.validFrom === hireDate)!;
      const periodC = remaining.find((p) => p.validFrom === dateBC)!;
      expect(periodA.validTo).toBe(periodC.validFrom);
      expect(checkPeriodChain(userId).ok).toBe(true);
      expect(getWorkPeriodById(periodB.id)).toBeNull();
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Die offene letzte Periode loeschen: die Vorperiode wird wieder offen (partieller UNIQUE-Index, Migration 013)', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const dateAB = firstOfMonthOffset(today, -1);
    const userId = createEmployee('offene-letzte', 40, hireDate);
    try {
      const periodA = insertTestWorkPeriod(userId, {
        validFrom: hireDate,
        validTo: dateAB,
        weeklyHours: 40,
        workSchedule: null,
      });
      const periodB = insertTestWorkPeriod(userId, { validFrom: dateAB, weeklyHours: 20, workSchedule: null });
      expect(periodB.validTo).toBeNull();

      deleteWorkPeriod(
        { periodId: periodB.id, reason: 'Offene letzte Periode wird geloescht' },
        { dryRun: false, createdBy: adminId }
      );

      const periodAAfter = getWorkPeriodById(periodA.id)!;
      expect(periodAAfter.validTo).toBeNull();
      const current = getCurrentWorkPeriod(userId);
      expect(current).not.toBeNull();
      expect(current!.id).toBe(periodA.id);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('DD-17: Die erste Periode eines Nutzers ist nicht loeschbar', () => {
    const hireDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('erste-periode', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });

      expect(() =>
        deleteWorkPeriod({ periodId: period.id, reason: 'Versuch, die erste Periode zu loeschen' }, { dryRun: false, createdBy: adminId })
      ).toThrow(WorkPeriodDeletionValidationError);
      expect(() =>
        deleteWorkPeriod({ periodId: period.id, reason: 'Versuch, die erste Periode zu loeschen' }, { dryRun: false, createdBy: adminId })
      ).toThrow('Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen.');

      const after = getWorkPeriodById(period.id);
      expect(after).not.toBeNull();
      expect(after!.validFrom).toBe(hireDate);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('D7: leere oder zu kurze Begruendung wird im Service abgewiesen, ohne etwas zu schreiben', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const dateAB = firstOfMonthOffset(today, -1);
    const userId = createEmployee('pflichtbegruendung', 40, hireDate);
    try {
      insertTestWorkPeriod(userId, { validFrom: hireDate, validTo: dateAB, weeklyHours: 40, workSchedule: null });
      const periodB = insertTestWorkPeriod(userId, { validFrom: dateAB, weeklyHours: 20, workSchedule: null });

      const txCountBefore = countTransactions(userId);
      const auditCountBefore = countAuditLogEntries('work_period', periodB.id);

      expect(() =>
        deleteWorkPeriod({ periodId: periodB.id, reason: '   ' }, { dryRun: false, createdBy: adminId })
      ).toThrow('Begründung ist erforderlich');
      expect(() =>
        deleteWorkPeriod({ periodId: periodB.id, reason: 'zu kurz' }, { dryRun: false, createdBy: adminId })
      ).toThrow('Begründung muss mindestens 10 Zeichen lang sein');

      expect(getWorkPeriodById(periodB.id)).not.toBeNull();
      expect(countTransactions(userId)).toBe(txCountBefore);
      expect(countAuditLogEntries('work_period', periodB.id)).toBe(auditCountBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Trockenlauf schreibt nicht — Vorschau ist gefuellt, balanceDelta stimmt mit dem Speicherlauf auf 0,01 ueberein', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const changeDate = firstOfMonthOffset(hireDate, 1);
    const userId = createEmployee('trockenlauf', 40, hireDate);
    try {
      insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, hireDate, today, 9);
      rebuildRange(userId, hireDate, today);

      const changeOutcome = applyWorkTimeChange(
        {
          userId,
          validFrom: changeDate,
          weeklyHours: 10,
          workSchedule: null,
          reason: 'Umstellung fuer den Trockenlauf-Test',
        },
        { dryRun: false, createdBy: adminId }
      );
      const newPeriod = changeOutcome.period!;
      const previousPeriodId = getWorkPeriods(userId).find((p) => p.validFrom === hireDate)!.id;
      const previousValidToBefore = getWorkPeriodById(previousPeriodId)!.validTo;

      const dryRunOutcome = deleteWorkPeriod(
        { periodId: newPeriod.id, reason: 'Nur eine Vorschau, wird nicht gespeichert' },
        { dryRun: true, createdBy: adminId }
      );
      expect(dryRunOutcome.preview.reversedTransactions.length).toBeGreaterThan(0);
      expect(typeof dryRunOutcome.preview.balanceDelta).toBe('number');
      expect(dryRunOutcome.reversalTransactionIds).toEqual([]);

      // Nach dem Trockenlauf ist nichts geschrieben: Periode nicht weggenommen, keine
      // Gegenbuchung, Vorperiode unveraendert.
      expect(getWorkPeriodById(newPeriod.id)).not.toBeNull();
      expect(getWorkPeriodById(previousPeriodId)!.validTo).toBe(previousValidToBefore);
      const pairRowsAfterDryRun = db
        .prepare(
          `SELECT id FROM overtime_transactions WHERE referenceType = 'work_period' AND referenceId = ? AND reversalOf IS NOT NULL`
        )
        .all(newPeriod.id);
      expect(pairRowsAfterDryRun.length).toBe(0);

      const saveOutcome = deleteWorkPeriod(
        { periodId: newPeriod.id, reason: 'Jetzt tatsaechlich loeschen' },
        { dryRun: false, createdBy: adminId }
      );
      expect(
        Math.abs(saveOutcome.preview.balanceDelta - dryRunOutcome.preview.balanceDelta)
      ).toBeLessThanOrEqual(0.01);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('DD-15: mehrere Buchungen an derselben Periode erzeugen je eine eigene Gegenbuchung — die Summe bleibt unveraendert', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const changeDate = firstOfMonthOffset(hireDate, 1);
    const userId = createEmployee('mehrere-buchungen', 40, hireDate);
    try {
      insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, hireDate, today, 9);
      rebuildRange(userId, hireDate, today);

      // Baseline VOR der Umstellung (Muster aus Test 1, Zusicherung B): nach Umstellung,
      // zweiter Buchung UND Loeschung muss die Journalsumme wieder hier ankommen — jede
      // model_change-Zeile hebt sich mit ihrer Gegenbuchung exakt auf (DD-14), die
      // Tageszeilen kehren nach dem Rebuild ab validFrom zum Ausgangsmodell zurueck (D4).
      const summeVorher = sumTransactionHours(userId);

      const changeOutcome = applyWorkTimeChange(
        {
          userId,
          validFrom: changeDate,
          weeklyHours: 15,
          workSchedule: null,
          reason: 'Umstellung fuer den Mehrfachbuchungs-Test',
        },
        { dryRun: false, createdBy: adminId }
      );
      const newPeriod = changeOutcome.period!;

      // Simuliert eine spaetere Korrektur derselben Periode (Plan 13-03), ohne sich an
      // workPeriodCorrectionService.ts zu binden, damit dieser Test unabhaengig von jenem
      // Plan in derselben Welle laufen kann (DD-15).
      const secondTransactionId = createTransaction({
        userId,
        date: newPeriod.validFrom,
        type: 'model_change',
        hours: 3.25,
        description: 'Zweite Buchung an derselben Periode fuer den DD-15-Test',
        referenceType: 'work_period',
        referenceId: newPeriod.id,
        createdBy: adminId,
        balanceBefore: 0,
        balanceAfter: 0,
      });
      expect(secondTransactionId).not.toBeNull();

      const deleteOutcome = deleteWorkPeriod(
        { periodId: newPeriod.id, reason: 'Loeschen mit zwei zu stornierenden Buchungen' },
        { dryRun: false, createdBy: adminId }
      );
      expect(deleteOutcome.reversalTransactionIds.length).toBe(2);

      const pairRows = db
        .prepare(
          `SELECT id, hours, reversalOf FROM overtime_transactions
           WHERE referenceType = 'work_period' AND referenceId = ?`
        )
        .all(newPeriod.id) as Array<{ id: number; hours: number; reversalOf: number | null }>;
      expect(pairRows.length).toBe(4);
      const reversalRows = pairRows.filter((r) => r.reversalOf !== null);
      expect(reversalRows.length).toBe(2);
      expect(new Set(reversalRows.map((r) => r.reversalOf)).size).toBe(2);

      expect(Math.abs(sumTransactionHours(userId) - summeVorher)).toBeLessThanOrEqual(0.01);
    } finally {
      cleanupEmployee(userId);
    }
  });
});
