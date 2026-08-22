import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { getWorkPeriodById, withSuspendedChainGuard, checkPeriodChain } from './workPeriodService.js';
import { correctWorkPeriod, WorkPeriodCorrectionValidationError } from './workPeriodCorrectionService.js';
import type { WorkPeriodCorrectionInput } from '../types/index.js';

/**
 * WORK PERIOD CORRECTION SERVICE TESTS — der Nachweis für die in 13-03-PLAN.md (Task 2)
 * geforderten neun Fälle: Pflichtbegründung im Service (D7), Trockenlauf schreibt nicht,
 * Vorschau/Speichern liefern denselben Betrag, rückwirkende Wirkung (D4), kein Rebuild vor
 * rangeStart (D4), Lückenschluss beim Verschieben von validFrom in beide Richtungen (DD-11),
 * gesperrter Beginn der ersten Periode, „nichts geändert" und Rollback bei Kettenfehler
 * (T-13-14).
 *
 * Läuft gegen die geteilte Verbindung aus `connection.js` (Muster aus
 * `workPeriodChangeService.test.ts`): kein `:memory:`, echte Testnutzer mit eindeutigem
 * `username` (Präfix `test-13-03-`), Aufräumen über `DELETE FROM users WHERE id = ?` (CASCADE
 * räumt `user_work_periods`/`overtime_transactions` ab; die übrigen Tabellen werden zusätzlich
 * explizit geräumt, weil parallel arbeitende Testdateien dieselbe Datenbank teilen).
 *
 * Alle Datumswerte sind relativ zu `getTodayString()` gebildet, kein `new Date('YYYY-MM-DD')`
 * (Zeitzonen-Off-by-one, Phase 9); Datumsfortschaltung ausschließlich über lokale
 * Kalenderfelder, wie im Service selbst.
 */

const USERNAME_PREFIX = 'test-13-03-';
const createdUserIds: number[] = [];

let adminId: number;

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE user_work_periods/overtime_transactions
  // beim Loeschen des Testnutzers nicht ab (Muster aus workPeriodChangeService.test.ts).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);

  const username = `t1303-admin-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T1303', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  adminId = result.lastInsertRowid as number;
});

afterAll(() => {
  // WR-05-Muster: Jede gespeicherte Korrektur legt einen audit_log-Eintrag mit
  // userId = adminId an. audit_log.userId zeigt per FOREIGN KEY auf users(id) OHNE
  // ON DELETE CASCADE — ohne dieses DELETE scheitert das Loeschen des Testadmins.
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
    .run(username, `${username}@test.local`, 'T1303', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/** Raeumt einen Testnutzer vollstaendig ab. CASCADE deckt user_work_periods und
 *  overtime_transactions bereits ab; die uebrigen Tabellen werden zur Sicherheit explizit
 *  geraeumt (Muster aus workPeriodChangeService.test.ts). */
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

/** Letzter Tag des Monats, dessen erster Tag `isoFirstOfMonth` ist. */
function lastOfMonth(isoFirstOfMonth: string): string {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  return isoDate(new Date(y, m, 0));
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
    ).run(userId, dateStr, '08:00', '16:00', 0, hoursPerWeekday, 'office');
  }
}

const today = getTodayString();

describe('correctWorkPeriod — Pflichtbegruendung, Rebuild-Grenze, Lueckenschluss, Rollback (13-03-PLAN.md)', () => {
  it('D7: leere oder zu kurze Begruendung wird im Service abgewiesen, ohne etwas zu schreiben', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const userId = createEmployee('pflichtbegruendung', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      const txCountBefore = countTransactions(userId);

      const emptyReasonInput: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: '   ',
      };
      expect(() => correctWorkPeriod(emptyReasonInput, { dryRun: false, createdBy: adminId })).toThrow(
        WorkPeriodCorrectionValidationError
      );
      expect(() => correctWorkPeriod(emptyReasonInput, { dryRun: false, createdBy: adminId })).toThrow(
        'Begründung ist erforderlich'
      );

      const shortReasonInput: WorkPeriodCorrectionInput = { ...emptyReasonInput, reason: 'zu kurz' };
      expect(() => correctWorkPeriod(shortReasonInput, { dryRun: false, createdBy: adminId })).toThrow(
        'Begründung muss mindestens 10 Zeichen lang sein'
      );

      const after = getWorkPeriodById(period.id)!;
      expect(after.weeklyHours).toBe(40);
      expect(countTransactions(userId)).toBe(txCountBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Der Trockenlauf liefert eine Vorschau mit balanceDelta !== 0 fuer eine rueckwirkende Reduzierung, schreibt aber nichts', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const userId = createEmployee('dryrun-schreibt-nichts', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, hireDate, today, 8);
      rebuildOvertimeTransactionsForMonth(userId, hireDate.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, today.slice(0, 7));

      const periodBefore = getWorkPeriodById(period.id)!;
      const txCountBefore = countTransactions(userId);
      const auditCountBefore = countAuditLogEntries('work_period_correction', period.id);

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Dies ist nur eine Vorschau und wird nicht gespeichert',
      };
      const previewOutcome = correctWorkPeriod(input, { dryRun: true, createdBy: adminId });

      expect(previewOutcome.preview.balanceDelta).not.toBe(0);
      expect(previewOutcome.period).toBeNull();
      expect(previewOutcome.transactionId).toBeNull();

      const periodAfter = getWorkPeriodById(period.id)!;
      expect(periodAfter.weeklyHours).toBe(periodBefore.weeklyHours);
      expect(countTransactions(userId)).toBe(txCountBefore);
      expect(countAuditLogEntries('work_period_correction', period.id)).toBe(auditCountBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Vorschau (dryRun) und Speichern liefern denselben balanceDelta auf 0,01 genau', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const userId = createEmployee('vorschau-gleich-speichern', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, hireDate, today, 8);
      rebuildOvertimeTransactionsForMonth(userId, hireDate.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, today.slice(0, 7));

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: 25,
        workSchedule: null,
        reason: 'Vergleich Vorschau gegen Speichern zu Testzwecken',
      };

      const previewOutcome = correctWorkPeriod(input, { dryRun: true, createdBy: adminId });
      const saveOutcome = correctWorkPeriod(input, { dryRun: false, createdBy: adminId });

      expect(
        Math.abs(saveOutcome.preview.balanceDelta - previewOutcome.preview.balanceDelta)
      ).toBeLessThan(0.01);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('D4: Eine rueckwirkende Korrektur verschiebt getOvertimeBalance() um genau preview.balanceDelta und erzeugt genau eine model_change-Buchung', () => {
    const hireDate = firstOfMonthOffset(today, -2);
    const userId = createEmployee('rueckwirkend-wirkt', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, hireDate, today, 8);
      rebuildOvertimeTransactionsForMonth(userId, hireDate.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, today.slice(0, 7));

      const balanceBefore = getOvertimeBalance(userId);

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Rueckwirkende Korrektur von 40 auf 20 Wochenstunden',
      };
      const outcome = correctWorkPeriod(input, { dryRun: false, createdBy: adminId });

      const balanceAfter = getOvertimeBalance(userId);
      expect(Math.round((balanceAfter - balanceBefore) * 100) / 100).toBe(outcome.preview.balanceDelta);

      const modelChangeRows = db
        .prepare(
          `SELECT id, referenceId, hours FROM overtime_transactions
           WHERE userId = ? AND type = 'model_change'`
        )
        .all(userId) as Array<{ id: number; referenceId: number; hours: number }>;

      expect(modelChangeRows).toHaveLength(1);
      expect(modelChangeRows[0].referenceId).toBe(period.id);
      expect(modelChangeRows[0].hours).toBe(outcome.preview.balanceDelta);
      expect(outcome.transactionId).toBe(modelChangeRows[0].id);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('D4: Ein Monat vor rangeStart bleibt unveraendert — kein Rebuild vor Beginn der betroffenen Periode', () => {
    const hireDate = firstOfMonthOffset(today, -4);
    const splitDate = firstOfMonthOffset(today, -2);
    const monthBeforeRangeStart = firstOfMonthOffset(today, -3);
    const userId = createEmployee('kein-rebuild-vor-rangestart', 40, hireDate);
    try {
      insertTestWorkPeriod(userId, {
        validFrom: hireDate,
        validTo: splitDate,
        weeklyHours: 40,
        workSchedule: null,
      });
      const period = insertTestWorkPeriod(userId, { validFrom: splitDate, weeklyHours: 40, workSchedule: null });

      // Vorperiode: eine echte, bereits abgerechnete Buchungszeile vor rangeStart.
      insertWeekdayTimeEntries(userId, hireDate, lastOfMonth(monthBeforeRangeStart), 8);
      rebuildOvertimeTransactionsForMonth(userId, hireDate.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, monthBeforeRangeStart.slice(0, 7));

      // Zu korrigierender Zeitraum.
      insertWeekdayTimeEntries(userId, splitDate, today, 8);
      rebuildOvertimeTransactionsForMonth(userId, splitDate.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, today.slice(0, 7));

      const monthKey = monthBeforeRangeStart.slice(0, 7);
      const balanceRowBefore = db
        .prepare('SELECT actualHours, targetHours FROM overtime_balance WHERE userId = ? AND month = ?')
        .get(userId, monthKey);
      expect(balanceRowBefore).toBeDefined();

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Nachweis, dass vor rangeStart nichts neu gerechnet wird',
      };
      correctWorkPeriod(input, { dryRun: false, createdBy: adminId });

      const balanceRowAfter = db
        .prepare('SELECT actualHours, targetHours FROM overtime_balance WHERE userId = ? AND month = ?')
        .get(userId, monthKey);

      expect(balanceRowAfter).toEqual(balanceRowBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('DD-11: Verschieben des Beginns nach hinten (spaeter) laesst A.validTo == B.validFrom und die Kette gueltig', () => {
    const hireDate = firstOfMonthOffset(today, -3);
    const splitDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('luecke-verschieben-spaeter', 40, hireDate);
    try {
      const periodA = insertTestWorkPeriod(userId, {
        validFrom: hireDate,
        validTo: splitDate,
        weeklyHours: 40,
        workSchedule: null,
      });
      const periodB = insertTestWorkPeriod(userId, { validFrom: splitDate, weeklyHours: 30, workSchedule: null });

      const newValidFrom = firstOfMonthOffset(today, 0);
      expect(newValidFrom > splitDate).toBe(true);

      const input: WorkPeriodCorrectionInput = {
        periodId: periodB.id,
        validFrom: newValidFrom,
        weeklyHours: periodB.weeklyHours,
        workSchedule: null,
        reason: 'Beginn von Periode B nach hinten verschoben',
      };
      correctWorkPeriod(input, { dryRun: false, createdBy: adminId });

      const aAfter = getWorkPeriodById(periodA.id)!;
      const bAfter = getWorkPeriodById(periodB.id)!;
      expect(aAfter.validTo).toBe(newValidFrom);
      expect(bAfter.validFrom).toBe(newValidFrom);
      expect(checkPeriodChain(userId).ok).toBe(true);

      const guard = db
        .prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1')
        .get() as { suspended: number };
      expect(guard.suspended).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('DD-11: Verschieben des Beginns nach vorn (frueher) laesst A.validTo == B.validFrom und die Kette gueltig', () => {
    const hireDate = firstOfMonthOffset(today, -3);
    const splitDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('luecke-verschieben-frueher', 40, hireDate);
    try {
      const periodA = insertTestWorkPeriod(userId, {
        validFrom: hireDate,
        validTo: splitDate,
        weeklyHours: 40,
        workSchedule: null,
      });
      const periodB = insertTestWorkPeriod(userId, { validFrom: splitDate, weeklyHours: 30, workSchedule: null });

      const newValidFrom = firstOfMonthOffset(today, -2);
      expect(newValidFrom > hireDate && newValidFrom < splitDate).toBe(true);

      const input: WorkPeriodCorrectionInput = {
        periodId: periodB.id,
        validFrom: newValidFrom,
        weeklyHours: periodB.weeklyHours,
        workSchedule: null,
        reason: 'Beginn von Periode B nach vorn verschoben',
      };
      correctWorkPeriod(input, { dryRun: false, createdBy: adminId });

      const aAfter = getWorkPeriodById(periodA.id)!;
      const bAfter = getWorkPeriodById(periodB.id)!;
      expect(aAfter.validTo).toBe(newValidFrom);
      expect(bAfter.validFrom).toBe(newValidFrom);
      expect(checkPeriodChain(userId).ok).toBe(true);

      const guard = db
        .prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1')
        .get() as { suspended: number };
      expect(guard.suspended).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('DD-11: Verschieben des Beginns der ersten Periode wird abgewiesen', () => {
    const hireDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('erste-periode-gesperrt', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });
      const laterDate = firstOfMonthOffset(today, 0);

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: laterDate,
        weeklyHours: period.weeklyHours,
        workSchedule: null,
        reason: 'Versuch, die erste Periode zu verschieben',
      };

      expect(() => correctWorkPeriod(input, { dryRun: false, createdBy: adminId })).toThrow(
        'Die erste Periode beginnt immer am Eintrittsdatum und kann nicht verschoben werden.'
      );

      const after = getWorkPeriodById(period.id)!;
      expect(after.validFrom).toBe(hireDate);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('D7/DD-13: identische Werte werden im Speicherpfad abgewiesen, im Trockenlauf als isNoOp gemeldet', () => {
    const hireDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('nichts-geaendert', 40, hireDate);
    try {
      const period = insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 40, workSchedule: null });

      const input: WorkPeriodCorrectionInput = {
        periodId: period.id,
        validFrom: period.validFrom,
        weeklyHours: period.weeklyHours,
        workSchedule: period.workSchedule,
        reason: 'Diese Begruendung darf wegen isNoOp nie ausgewertet werden',
      };

      expect(() => correctWorkPeriod(input, { dryRun: false, createdBy: adminId })).toThrow(
        'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.'
      );

      const previewOutcome = correctWorkPeriod(input, { dryRun: true, createdBy: adminId });
      expect(previewOutcome.preview.isNoOp).toBe(true);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('T-13-14: Ein bereits bestehender Kettenschaden laesst die Korrektur an checkPeriodChain scheitern und rollt vollstaendig zurueck', () => {
    const hireDate = firstOfMonthOffset(today, -3);
    const splitDate = firstOfMonthOffset(today, -1);
    const userId = createEmployee('kettenfehler-rollback', 40, hireDate);
    try {
      const periodA = insertTestWorkPeriod(userId, {
        validFrom: hireDate,
        validTo: splitDate,
        weeklyHours: 40,
        workSchedule: null,
      });
      const periodB = insertTestWorkPeriod(userId, { validFrom: splitDate, weeklyHours: 30, workSchedule: null });

      // Erzwingt einen bereits bestehenden Kettenschaden, den weder die Nachbarschaftspruefung
      // in Schritt 2 noch der normale Schreibweg von periodB je verursacht haetten: eine mit
      // periodA ueberlappende Periode C wird UNTER Aussetzung des Riegels direkt eingefuegt
      // (Bypass der Trigger) — genau das Bild, das ein defekter Altbestand hinterlassen koennte.
      const conflictStart = firstOfMonthOffset(today, -2);
      withSuspendedChainGuard(() => {
        db.prepare(
          `INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule, note, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(userId, conflictStart, splitDate, 25, null, 'conflict-fixture-13-03', null);
      });

      const guardAfterFixture = db
        .prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1')
        .get() as { suspended: number };
      expect(guardAfterFixture.suspended).toBe(0);
      expect(checkPeriodChain(userId).ok).toBe(false);

      const periodBBefore = getWorkPeriodById(periodB.id)!;
      const txCountBefore = countTransactions(userId);
      const auditCountBefore = countAuditLogEntries('work_period_correction', periodB.id);

      const input: WorkPeriodCorrectionInput = {
        periodId: periodB.id,
        validFrom: periodB.validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Diese Korrektur soll an der Kettenpruefung scheitern und zurueckrollen',
      };

      expect(() => correctWorkPeriod(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkPeriodCorrectionValidationError
      );
      expect(() => correctWorkPeriod(input, { dryRun: false, createdBy: adminId })).toThrow(
        'Die Periodenkette wäre nach dieser Korrektur ungültig'
      );

      const periodBAfter = getWorkPeriodById(periodB.id)!;
      expect(periodBAfter.weeklyHours).toBe(periodBBefore.weeklyHours);
      expect(countTransactions(userId)).toBe(txCountBefore);
      expect(countAuditLogEntries('work_period_correction', periodB.id)).toBe(auditCountBefore);

      const guardFinal = db
        .prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1')
        .get() as { suspended: number };
      expect(guardFinal.suspended).toBe(0);

      // periodA bleibt ebenfalls unangetastet — der Rollback betrifft die gesamte Klammer.
      expect(getWorkPeriodById(periodA.id)!.validTo).toBe(splitDate);
    } finally {
      cleanupEmployee(userId);
    }
  });
});

describe('Aufraeumnachweis (13-03)', () => {
  it('alle Testnutzer mit dem Praefix test-13-03- wurden abgeraeumt', () => {
    const remaining = db
      .prepare(`SELECT COUNT(*) as c FROM users WHERE username LIKE ?`)
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(remaining.c).toBe(0);
    expect(createdUserIds.length).toBeGreaterThan(0);
  });
});
