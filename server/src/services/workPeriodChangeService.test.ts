import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { checkAllPeriodChains } from './workPeriodService.js';
import {
  getOvertimeBalance,
  getOvertimeHistory,
  getOvertimeBalanceAtDate,
  getMonthlyTransactionSummary,
} from './overtimeTransactionService.js';
import {
  calculateLiveOvertimeTransactions,
  calculateCurrentOvertimeBalance,
} from './overtimeLiveCalculationService.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { applyWorkTimeChange, WorkTimeChangeValidationError } from './workPeriodChangeService.js';
import type { WorkTimeChangeInput } from '../types/index.js';

/**
 * WORK PERIOD CHANGE SERVICE TESTS — der Nachweis fuer die vier Erfolgskriterien der
 * ROADMAP (Plan 12-05, REQ-26 bis REQ-29).
 *
 * Laeuft gegen die geteilte Verbindung aus `connection.js` (Muster aus
 * `workPeriodService.test.ts`, `absencePeriodAwareness.test.ts`): kein `:memory:`, echte
 * Testnutzer mit eindeutigem `username` (Praefix `test-12-05-`), Aufraeumen ueber
 * `DELETE FROM users WHERE id = ?` (CASCADE raeumt `user_work_periods` und
 * `overtime_transactions` ab; `time_entries`, `overtime_balance` werden hier zusaetzlich
 * explizit geraeumt, weil parallel arbeitende Testdateien dieselbe Datenbank teilen und ein
 * Aufraeumnachweis maschinell am Dateiende geprueft wird).
 *
 * Alle Datumswerte sind relativ zu `getTodayString()` (Berlin, wie der Service selbst)
 * gebildet, nicht hart codiert — der Testlauf soll unabhaengig vom Kalenderdatum reproduzierbar
 * bleiben. Kein `new Date('YYYY-MM-DD')` (Zeitzonen-Off-by-one, Phase 9); Datumsfortschaltung
 * ausschliesslich ueber lokale Kalenderfelder (`new Date(y, m - 1, d)`), wie im Service selbst.
 */

const USERNAME_PREFIX = 'test-12-05-';
const createdUserIds: number[] = [];

let adminId: number;

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE user_work_periods/overtime_transactions
  // beim Loeschen des Testnutzers nicht ab (Muster aus workPeriodService.test.ts).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);

  const username = `t1205-admin-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T1205', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  adminId = result.lastInsertRowid as number;
});

afterAll(() => {
  // Bewusst NICHT mit dem Praefix 'test-12-05-' benannt: der Aufraeumnachweis am Dateiende
  // prueft ausschliesslich die Mitarbeiter-Testnutzer und laeuft VOR diesem afterAll — der
  // Admin darf zu diesem Zeitpunkt noch existieren.
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
    .run(username, `${username}@test.local`, 'T1205', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/** Raeumt einen Testnutzer vollstaendig ab. CASCADE deckt user_work_periods und
 *  overtime_transactions bereits ab; die uebrigen Tabellen werden zur Sicherheit explizit
 *  geraeumt (Muster aus overtimeTransactionRebuildService.test.ts). */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
}

function countPeriods(userId: number): number {
  return (
    db.prepare('SELECT COUNT(*) as c FROM user_work_periods WHERE userId = ?').get(userId) as {
      c: number;
    }
  ).c;
}

function countTransactions(userId: number): number {
  return (
    db.prepare('SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ?').get(userId) as {
      c: number;
    }
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

describe('applyWorkTimeChange — Erfolgskriterien der Phase 12 (ROADMAP)', () => {
  it('REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung', () => {
    const userId = createEmployee('nullwirkung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const monthAgo2 = firstOfMonthOffset(today, -2);
      const monthAgo1 = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, monthAgo2, today, 8);
      rebuildOvertimeTransactionsForMonth(userId, monthAgo2.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, monthAgo1.slice(0, 7));
      rebuildOvertimeTransactionsForMonth(userId, today.slice(0, 7));

      const validFrom = firstOfMonthOffset(today, 4);

      const before = db
        .prepare(
          `SELECT id, date, type, hours FROM overtime_transactions
           WHERE userId = ? AND date < ? ORDER BY date, id`
        )
        .all(userId, validFrom);
      expect(before.length).toBeGreaterThan(0);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Reduzierung auf Teilzeit ab einem kuenftigen Stichtag',
      };
      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

      const after = db
        .prepare(
          `SELECT id, date, type, hours FROM overtime_transactions
           WHERE userId = ? AND date < ? ORDER BY date, id`
        )
        .all(userId, validFrom);

      expect(after).toEqual(before);
      expect(outcome.preview.balanceDelta).toBe(0);

      const modelChangeCount = (
        db
          .prepare(`SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND type = 'model_change'`)
          .get(userId) as { c: number }
      ).c;
      expect(modelChangeCount).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('REQ-26: Ein rueckwirkender Stichtag rechnet ab seinem Datum neu und laesst jede Buchung davor unveraendert', () => {
    const userId = createEmployee('rueckwirkung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const validFrom = firstOfMonthOffset(today, -2);
      const priorMonth = firstOfMonthOffset(today, -3);

      // Vorperiode: eine echte, bereits abgerechnete Buchungszeile, die unveraendert
      // bleiben muss — bewusst VOR dem Aufruf von applyWorkTimeChange abgerechnet.
      insertWeekdayTimeEntries(userId, priorMonth, lastOfMonth(priorMonth), 8);
      rebuildOvertimeTransactionsForMonth(userId, priorMonth.slice(0, 7));

      // Rueckwirkender Zeitraum: dieselben taeglichen Ist-Stunden wie bisher (8h/Werktag) —
      // applyWorkTimeChange rechnet diesen Bereich selbst neu (D3), kein eigener Rebuild hier.
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const before = db
        .prepare(
          `SELECT id, date, type, hours FROM overtime_transactions
           WHERE userId = ? AND date < ? ORDER BY date, id`
        )
        .all(userId, validFrom);
      expect(before.length).toBeGreaterThan(0);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Reduzierung der Wochenstunden rueckwirkend zum Stichtag',
      };
      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

      const after = db
        .prepare(
          `SELECT id, date, type, hours FROM overtime_transactions
           WHERE userId = ? AND date < ? ORDER BY date, id`
        )
        .all(userId, validFrom);
      expect(after).toEqual(before);

      expect(outcome.preview.balanceDelta).toBeGreaterThan(0);

      const modelChangeRows = db
        .prepare(
          `SELECT date, referenceType, referenceId FROM overtime_transactions
           WHERE userId = ? AND type = 'model_change'`
        )
        .all(userId) as Array<{ date: string; referenceType: string; referenceId: number }>;

      expect(modelChangeRows).toHaveLength(1);
      expect(modelChangeRows[0].date).toBe(validFrom);
      expect(modelChangeRows[0].referenceType).toBe('work_period');
      expect(modelChangeRows[0].referenceId).toBe(outcome.period!.id);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('REQ-27: Vorschau und Speichern liefern paarweise exakt dieselben Werte, der gespeicherte Saldo stimmt mit getOvertimeBalance() ueberein', () => {
    const userId = createEmployee('vorschau-gleich-speichern', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 30,
        workSchedule: null,
        reason: 'Anpassung der Wochenstunden zu Testzwecken (Vorschau=Speichern)',
      };

      const previewOutcome = applyWorkTimeChange(input, { dryRun: true, createdBy: adminId });
      const saveOutcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

      const comparedFields = [
        'targetHoursBefore',
        'targetHoursAfter',
        'targetHoursDelta',
        'balanceBefore',
        'balanceAfter',
        'balanceDelta',
        'workingDaysInRange',
      ] as const;

      for (const field of comparedFields) {
        expect(saveOutcome.preview[field]).toBe(previewOutcome.preview[field]);
      }

      expect(getOvertimeBalance(userId)).toBe(saveOutcome.preview.balanceAfter);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Trockenlauf schreibt nichts: Zeilenzahlen, Saldosumme und getOvertimeBalance() bleiben unveraendert', () => {
    const userId = createEmployee('dryrun-schreibt-nichts', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const periodsCountBefore = countPeriods(userId);
      const transactionsCountBefore = countTransactions(userId);
      const balanceSumBefore = (
        db
          .prepare('SELECT COALESCE(SUM(actualHours - targetHours), 0) as s FROM overtime_balance WHERE userId = ?')
          .get(userId) as { s: number }
      ).s;
      const overtimeBalanceBefore = getOvertimeBalance(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 25,
        workSchedule: null,
        reason: 'Nur zur Vorschau — dieser Wechsel wird nicht gespeichert',
      };
      applyWorkTimeChange(input, { dryRun: true, createdBy: adminId });

      expect(countPeriods(userId)).toBe(periodsCountBefore);
      expect(countTransactions(userId)).toBe(transactionsCountBefore);
      expect(
        (
          db
            .prepare('SELECT COALESCE(SUM(actualHours - targetHours), 0) as s FROM overtime_balance WHERE userId = ?')
            .get(userId) as { s: number }
        ).s
      ).toBe(balanceSumBefore);
      expect(getOvertimeBalance(userId)).toBe(overtimeBalanceBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('REQ-29: Die model_change-Zeile ist im Journal sichtbar, traegt die Begruendung woertlich, und wird im ueber getOvertimeBalance() gelesenen Saldo nicht doppelt gezaehlt', () => {
    const userId = createEmployee('journal-sichtbarkeit', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const reason = 'Journalsichtbarkeit-Test-Begruendung-eindeutig-98765';
      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason,
      };
      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });
      expect(outcome.transactionId).not.toBeNull();

      const history = getOvertimeHistory(userId);
      const journalRow = history.find((row) => row.type === 'model_change');
      expect(journalRow).toBeDefined();
      expect(journalRow!.description).toContain(reason);

      const balanceWithRow = getOvertimeBalance(userId);
      db.prepare('DELETE FROM overtime_transactions WHERE id = ?').run(outcome.transactionId);
      const balanceWithoutRow = getOvertimeBalance(userId);

      expect(balanceWithoutRow).toBe(balanceWithRow);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('CR-01: Die model_change-Zeile wird in KEINEM transaktionssummierenden Lesepfad mitgezaehlt (Kontoauszug, Monatliche Entwicklung, Saldo zum Stichtag)', () => {
    const userId = createEmployee('cr01-lesepfade', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const outcome = applyWorkTimeChange(
        {
          userId,
          validFrom,
          weeklyHours: 20,
          workSchedule: null,
          reason: 'Rueckwirkende Reduzierung — Nachweis der Lesepfade (CR-01)',
        },
        { dryRun: false, createdBy: adminId }
      );

      // Vorbedingung: Es gibt ueberhaupt eine Differenz, sonst waere jeder Vergleich unten
      // trivial gruen.
      expect(outcome.transactionId).not.toBeNull();
      expect(outcome.preview.balanceDelta).not.toBe(0);

      const journalRow = db
        .prepare(
          `SELECT hours, balanceBefore, balanceAfter FROM overtime_transactions WHERE id = ?`
        )
        .get(outcome.transactionId!) as {
        hours: number;
        balanceBefore: number | null;
        balanceAfter: number | null;
      };
      expect(journalRow.hours).toBe(outcome.preview.balanceDelta);

      // CR-02: Die Zeile steht auf der Journal-Skala und verschiebt den Laufsaldo der Kette
      // um 0 — balanceBefore und balanceAfter sind identisch.
      expect(journalRow.balanceAfter).toBe(journalRow.balanceBefore);

      // --- Lesepfad 1: Kontoauszug (live, produktiv) ---
      const liveRows = calculateLiveOvertimeTransactions(userId, validFrom, today);
      const modelChangeRows = liveRows.filter((r) => r.type === 'model_change');
      expect(modelChangeRows).toHaveLength(1); // REQ-29: sichtbar bleibt sie
      expect(modelChangeRows[0].hours).toBe(0);
      expect(modelChangeRows[0].documentedDelta).toBe(outcome.preview.balanceDelta);

      const liveSum =
        Math.round(liveRows.reduce((sum, r) => sum + r.hours, 0) * 100) / 100;
      const liveBalance = calculateCurrentOvertimeBalance(userId, validFrom, today);
      // Die angezeigten Zeilen summieren sich auf den daneben angezeigten Saldo.
      expect(Math.abs(liveSum - liveBalance)).toBeLessThan(0.011);

      // --- Lesepfad 2/3: Monatliche Entwicklung und Saldo zum Stichtag ---
      const summaryWithRow = getMonthlyTransactionSummary(userId, 12);
      const balanceAtDateWithRow = getOvertimeBalanceAtDate(userId, today);

      // Gegenprobe: Genau diese eine Zeile entfernen und dieselben Lesepfade erneut fragen.
      // Wuerde einer von ihnen sie mitzaehlen, waeren die Werte danach andere.
      db.prepare('DELETE FROM overtime_transactions WHERE id = ?').run(outcome.transactionId!);

      expect(getMonthlyTransactionSummary(userId, 12)).toEqual(summaryWithRow);
      expect(getOvertimeBalanceAtDate(userId, today)).toBe(balanceAtDateWithRow);

      const liveRowsWithout = calculateLiveOvertimeTransactions(userId, validFrom, today);
      expect(liveRowsWithout.filter((r) => r.type === 'model_change')).toHaveLength(0);
      expect(Math.round(liveRowsWithout.reduce((sum, r) => sum + r.hours, 0) * 100) / 100).toBe(
        liveSum
      );
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('CR-01: Ein Wechsel VOR dem Fenster der Monatlichen Entwicklung wird nicht in previousBalance eingerechnet', () => {
    const userId = createEmployee('cr01-previousbalance', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      // Eine model_change-Zeile weit VOR dem 12-Monats-Fenster von
      // getMonthlyTransactionSummary(): frueher floss sie ueber previousBalance in JEDEN
      // Monatssaldo ein, obwohl sie innerhalb des Fensters bewusst verworfen wird.
      const outsideWindow = firstOfMonthOffset(today, -30);

      const summaryBefore = getMonthlyTransactionSummary(userId, 12);
      const balanceAtDateBefore = getOvertimeBalanceAtDate(userId, today);

      db.prepare(
        `INSERT INTO overtime_transactions
           (userId, date, type, hours, description, referenceType, referenceId, balanceBefore, balanceAfter)
         VALUES (?, ?, 'model_change', ?, ?, 'work_period', NULL, 0, 0)`
      ).run(userId, outsideWindow, -42.5, 'Alter Stundenwechsel ausserhalb des Fensters');

      expect(getMonthlyTransactionSummary(userId, 12)).toEqual(summaryBefore);
      expect(getOvertimeBalanceAtDate(userId, today)).toBe(balanceAtDateBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Stichtag mitten im Monat: midMonthEffective ist true, ein Tag davor traegt das alte, ein Tag ab dem Stichtag das neue Tagessoll', () => {
    const userId = createEmployee('monatsmitte', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const monthStart = firstOfMonthOffset(today, -1);
      const validFrom = `${monthStart.slice(0, 8)}15`;
      insertWeekdayTimeEntries(userId, monthStart, today, 8);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Wechsel mitten im Monat zu Testzwecken',
      };
      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

      expect(outcome.preview.midMonthEffective).toBe(true);

      const dayBefore = db
        .prepare(
          `SELECT hours FROM overtime_transactions
           WHERE userId = ? AND type = 'time_entry' AND date < ?
           ORDER BY date DESC LIMIT 1`
        )
        .get(userId, validFrom) as { hours: number } | undefined;
      const dayFrom = db
        .prepare(
          `SELECT hours FROM overtime_transactions
           WHERE userId = ? AND type = 'time_entry' AND date >= ?
           ORDER BY date ASC LIMIT 1`
        )
        .get(userId, validFrom) as { hours: number } | undefined;

      expect(dayBefore).toBeDefined();
      expect(dayFrom).toBeDefined();
      expect(dayBefore!.hours).toBe(0); // 8h Ist - 8h Soll (altes Modell, 40h/Woche)
      expect(dayFrom!.hours).toBe(4); // 8h Ist - 4h Soll (neues Modell, 20h/Woche)
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('WR-02: Ein bereits materialisierter Zukunftsmonat wird mit dem neuen Sollmodell nachgezogen, balanceDelta bleibt davon unberuehrt', () => {
    const userId = createEmployee('wr02-zukunftsmonat', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      // Zukunftsmonat vorab materialisieren — genau die Lage, die durch genehmigten
      // Zukunftsurlaub im Bestand entsteht (siehe Kommentar in getOvertimeBalance()).
      const futureMonth = firstOfMonthOffset(today, 2).slice(0, 7);
      rebuildOvertimeTransactionsForMonth(userId, futureMonth);

      const futureBefore = db
        .prepare('SELECT targetHours FROM overtime_balance WHERE userId = ? AND month = ?')
        .get(userId, futureMonth) as { targetHours: number } | undefined;
      expect(futureBefore).toBeDefined();
      expect(futureBefore!.targetHours).toBeGreaterThan(0);

      const outcome = applyWorkTimeChange(
        {
          userId,
          validFrom,
          weeklyHours: 20,
          workSchedule: null,
          reason: 'Halbierung der Wochenstunden — Nachweis fuer den Zukunftsmonat (WR-02)',
        },
        { dryRun: false, createdBy: adminId }
      );

      const futureAfter = db
        .prepare('SELECT targetHours FROM overtime_balance WHERE userId = ? AND month = ?')
        .get(userId, futureMonth) as { targetHours: number };

      // Halbe Wochenstunden -> halbes Monatssoll. Der Zukunftsmonat traegt jetzt das neue
      // Modell und nicht mehr das alte.
      expect(futureAfter.targetHours).toBeCloseTo(futureBefore!.targetHours / 2, 2);

      // Der gemessene und gebuchte balanceDelta stammt weiterhin ausschliesslich aus dem
      // Zeitraum bis heute: getOvertimeBalance() blendet Zukunftsmonate aus.
      expect(outcome.preview.balanceDelta).toBe(
        Math.round((outcome.preview.balanceAfter - outcome.preview.balanceBefore) * 100) / 100
      );
      expect(outcome.preview.affectedMonths).not.toContain(futureMonth);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Wechsel ueber einen Jahreswechsel: affectedMonths deckt zwei Kalenderjahre ab, der Lauf endet ohne Fehler', () => {
    const userId = createEmployee('jahreswechsel', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const [todayYear] = today.split('-').map(Number);
      const validFrom = `${todayYear - 1}-12-01`;

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Rueckwirkender Wechsel ueber einen Jahreswechsel zu Testzwecken',
      };
      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

      const years = new Set(outcome.preview.affectedMonths.map((m) => m.slice(0, 4)));
      expect(years.size).toBeGreaterThanOrEqual(2);
      expect(outcome.preview.affectedMonths).toContain(`${todayYear - 1}-12`);
    } finally {
      cleanupEmployee(userId);
    }
  });
});

describe('applyWorkTimeChange — Validierung (kein Schreibvorgang bei Ablehnung)', () => {
  it('Stichtag vor dem Eintrittsdatum wirft WorkTimeChangeValidationError, keine Schreibwirkung', () => {
    const userId = createEmployee('vor-hiredate', 40, '2026-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: '2025-12-01',
        weeklyHours: 30,
        workSchedule: null,
        reason: 'Stichtag liegt vor dem Eintrittsdatum',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('CR-03: Ein formal passender, aber unmoeglicher Kalendertag wird abgewiesen, keine Schreibwirkung', () => {
    const userId = createEmployee('kein-echtes-datum', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      // Alle drei bestehen die reine Formatpruefung /^\d{4}-\d{2}-\d{2}$/ und landeten vor
      // dem CR-03-Fix unveraendert in user_work_periods.validFrom.
      for (const validFrom of ['2026-02-31', '2026-13-45', '0000-00-00', '2025-02-29']) {
        const input: WorkTimeChangeInput = {
          userId,
          validFrom,
          weeklyHours: 30,
          workSchedule: null,
          reason: `Unmoegliches Kalenderdatum ${validFrom} darf nicht gespeichert werden`,
        };

        expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
          WorkTimeChangeValidationError
        );
        expect(() => applyWorkTimeChange(input, { dryRun: true, createdBy: adminId })).toThrow(
          WorkTimeChangeValidationError
        );
      }

      // Gegenprobe: der 29.02. eines echten Schaltjahres wird NICHT abgewiesen (der Lauf
      // scheitert dann an einer anderen Regel oder laeuft durch — jedenfalls nicht an der
      // Kalenderpruefung).
      expect(new Date(2028, 2, 0).getDate()).toBe(29);

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Stichtag identisch zu einer bestehenden Periode wirft WorkTimeChangeValidationError, keine Schreibwirkung', () => {
    const userId = createEmployee('doppelter-stichtag', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, {
        validFrom: '2020-01-01',
        validTo: '2026-01-01',
        weeklyHours: 40,
        workSchedule: null,
      });
      insertTestWorkPeriod(userId, { validFrom: '2026-01-01', weeklyHours: 20, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: '2026-01-01',
        weeklyHours: 25,
        workSchedule: null,
        reason: 'Stichtag existiert bereits als Periodenbeginn',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Wochenstunden ueber 60 wirft WorkTimeChangeValidationError, keine Schreibwirkung', () => {
    const userId = createEmployee('zu-viele-stunden', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: firstOfMonthOffset(today, 1),
        weeklyHours: 61,
        workSchedule: null,
        reason: 'Unzulaessige Wochenstundenzahl ueber 60',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('WR-03: Ein Stichtag vor dem Beginn des Vorjahres wird abgewiesen, keine Schreibwirkung', () => {
    const [todayYear] = today.split('-').map(Number);
    // hireDate weit zurueck, damit die Ablehnung nachweislich an der Rueckwirkungsgrenze
    // haengt und nicht am Eintrittsdatum.
    const userId = createEmployee('wr03-rueckwirkung', 40, `${todayYear - 6}-01-01`);
    try {
      insertTestWorkPeriod(userId, {
        validFrom: `${todayYear - 6}-01-01`,
        weeklyHours: 40,
        workSchedule: null,
      });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const zuWeitZurueck: WorkTimeChangeInput = {
        userId,
        validFrom: `${todayYear - 2}-12-31`,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'Stichtag liegt vor dem Beginn des Vorjahres und muss abgelehnt werden',
      };

      expect(() =>
        applyWorkTimeChange(zuWeitZurueck, { dryRun: false, createdBy: adminId })
      ).toThrow(WorkTimeChangeValidationError);
      expect(() =>
        applyWorkTimeChange(zuWeitZurueck, { dryRun: true, createdBy: adminId })
      ).toThrow(WorkTimeChangeValidationError);

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);

      // Gegenprobe: exakt der Beginn des Vorjahres ist noch erlaubt.
      const geradeNochErlaubt: WorkTimeChangeInput = {
        ...zuWeitZurueck,
        validFrom: `${todayYear - 1}-01-01`,
        reason: 'Stichtag genau am Beginn des Vorjahres ist zulaessig',
      };
      const outcome = applyWorkTimeChange(geradeNochErlaubt, {
        dryRun: false,
        createdBy: adminId,
      });
      expect(outcome.period).not.toBeNull();
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('CR-04: Tagesplan ausserhalb 0..24 und Tagesplansumme ueber 60 werden abgewiesen, keine Schreibwirkung', () => {
    const userId = createEmployee('tagesplan-grenzen', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);
      const validFrom = firstOfMonthOffset(today, -1);

      const unzulaessig = [
        // negativ — erzeugte vor dem Fix eine negative Soll-Summe und damit einen frei
        // waehlbaren, beliebig grossen balanceDelta als schreibende Gutschrift
        { monday: -100, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
        // ueber 24 Stunden an einem Kalendertag
        { monday: 25, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
        // absurd gross
        { monday: 8.5e15, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
        // jeder Tag fuer sich zulaessig (<= 24), die Wochensumme aber 168 > 60
        { monday: 24, tuesday: 24, wednesday: 24, thursday: 24, friday: 24, saturday: 24, sunday: 24 },
      ];

      for (const workSchedule of unzulaessig) {
        const input: WorkTimeChangeInput = {
          userId,
          validFrom,
          weeklyHours: 40,
          workSchedule,
          reason: 'Unzulaessiger Tagesplan darf nicht gespeichert werden',
        };
        expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
          WorkTimeChangeValidationError
        );
        expect(() => applyWorkTimeChange(input, { dryRun: true, createdBy: adminId })).toThrow(
          WorkTimeChangeValidationError
        );
      }

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('CR-04 Gegenprobe: ein zulaessiger Tagesplan (Summe 30 h, jeder Tag <= 24) wird angenommen', () => {
    const userId = createEmployee('tagesplan-zulaessig', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const validFrom = firstOfMonthOffset(today, -1);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 30,
        workSchedule: {
          monday: 8,
          tuesday: 8,
          wednesday: 8,
          thursday: 6,
          friday: 0,
          saturday: 0,
          sunday: 0,
        },
        reason: 'Zulaessiger Tagesplan mit 30 Wochenstunden zu Testzwecken',
      };

      const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });
      expect(outcome.period).not.toBeNull();
      expect(outcome.period!.weeklyHours).toBe(30);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Leere Begruendung im Speicherpfad wirft WorkTimeChangeValidationError, keine Schreibwirkung', () => {
    const userId = createEmployee('leere-begruendung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: firstOfMonthOffset(today, 1),
        weeklyHours: 30,
        workSchedule: null,
        reason: '',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('WR-04: Ueberlange Begruendung und Steuerzeichen werden abgewiesen; gespeichert wird die getrimmte Fassung', () => {
    const userId = createEmployee('wr04-begruendung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const validFrom = firstOfMonthOffset(today, -1);
      insertWeekdayTimeEntries(userId, validFrom, today, 8);

      const periodsBefore = countPeriods(userId);

      const zuLang: WorkTimeChangeInput = {
        userId,
        validFrom,
        weeklyHours: 20,
        workSchedule: null,
        reason: 'A'.repeat(501),
      };
      expect(() => applyWorkTimeChange(zuLang, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      const mitSteuerzeichen: WorkTimeChangeInput = {
        ...zuLang,
        reason: `Begruendung mit Steuerzeichen${String.fromCharCode(0)}im Text`,
      };
      expect(() =>
        applyWorkTimeChange(mitSteuerzeichen, { dryRun: false, createdBy: adminId })
      ).toThrow(WorkTimeChangeValidationError);

      expect(countPeriods(userId)).toBe(periodsBefore);

      // Gegenprobe: 500 Zeichen sind erlaubt, und umgebende Leerzeichen werden vor dem
      // Speichern abgeschnitten — weder in der Periode noch im Journaltext.
      const kern = 'Begruendung mit umgebenden Leerzeichen zu Testzwecken';
      const outcome = applyWorkTimeChange(
        { ...zuLang, reason: `   ${kern}   ` },
        { dryRun: false, createdBy: adminId }
      );

      expect(outcome.period!.note).toBe(kern);
      const journalDescription = (
        db
          .prepare('SELECT description FROM overtime_transactions WHERE id = ?')
          .get(outcome.transactionId!) as { description: string }
      ).description;
      expect(journalDescription).toContain(`(Grund: ${kern})`);
      expect(journalDescription).not.toContain('   ');
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Werte identisch zur aktuell gueltigen Periode (isNoOp) wirft WorkTimeChangeValidationError im Speicherpfad, keine Schreibwirkung', () => {
    const userId = createEmployee('nichts-zu-tun', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: firstOfMonthOffset(today, 1),
        weeklyHours: 40,
        workSchedule: null,
        reason: 'Diese Aenderung sollte als nichts zu tun erkannt werden',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);
    } finally {
      cleanupEmployee(userId);
    }
  });
});

describe('applyWorkTimeChange — D7: eine Transaktionsklammer (Periode + Rebuild + Buchung)', () => {
  /**
   * Woertliche Kopie des INSERT-Guard-Triggers aus
   * `server/src/database/migrations/008_create_user_work_periods.ts:176-196` — genutzt, um
   * innerhalb einer einzigen atomaren Transaktion eine Luecke einzuschleusen, die der
   * Trigger selbst nicht verhindern kann, weil sie unter dessen Umgehung entsteht (Muster
   * aus `workPeriodService.test.ts`, "checkPeriodChain — Service-Check ergaenzt die Trigger").
   */
  const INSERT_GUARD_TRIGGER_SQL = `
    CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_insert_guard
    BEFORE INSERT ON user_work_periods
    BEGIN
      SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
      WHERE EXISTS (
        SELECT 1 FROM user_work_periods p
        WHERE p.userId = NEW.userId
          AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
          AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
      );
      SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
      WHERE EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId)
        AND NOT EXISTS (
          SELECT 1 FROM user_work_periods p
          WHERE p.userId = NEW.userId
            AND (p.validTo = NEW.validFrom
                 OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
        );
    END
  `;

  it('Bricht die Kettenpruefung nach dem Anlegen der neuen Periode ab, bleibt weder die neue Periode noch eine model_change-Buchung bestehen', () => {
    const userId = createEmployee('atomaritaet', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, {
        validFrom: '2020-01-01',
        validTo: '2026-01-01',
        weeklyHours: 40,
        workSchedule: null,
      });

      // Luecke absichtlich unter Umgehung des Insert-Guards einschleusen: zwischen
      // 2026-01-01 und 2026-03-01 existiert keine Periode. checkPeriodChain() findet diese
      // Luecke; der Insert-Trigger selbst kann sie nicht verhindern, weil sie unter dessen
      // Umgehung entstanden ist — genau der Fall, den D3 (checkPeriodChain als Zusatzriegel)
      // beschreibt.
      const injectGap = db.transaction(() => {
        db.exec('DROP TRIGGER trg_user_work_periods_insert_guard');
        db.prepare(
          `INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule, note)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, '2026-03-01', null, 20, null, 'test-12-05-atomaritaet-luecke');
        db.exec(INSERT_GUARD_TRIGGER_SQL);
      });
      injectGap();

      const periodsBefore = countPeriods(userId);
      const transactionsBefore = countTransactions(userId);
      const openPeriodBefore = db
        .prepare(`SELECT id, validTo FROM user_work_periods WHERE userId = ? AND validTo IS NULL`)
        .get(userId) as { id: number; validTo: string | null } | undefined;
      expect(openPeriodBefore).toBeDefined();

      const input: WorkTimeChangeInput = {
        userId,
        validFrom: '2026-04-01',
        weeklyHours: 25,
        workSchedule: null,
        reason: 'Sollte an der Kettenpruefung scheitern (eingeschleuste Luecke)',
      };

      expect(() => applyWorkTimeChange(input, { dryRun: false, createdBy: adminId })).toThrow(
        WorkTimeChangeValidationError
      );

      expect(countPeriods(userId)).toBe(periodsBefore);
      expect(countTransactions(userId)).toBe(transactionsBefore);

      const openPeriodAfter = db
        .prepare(`SELECT id, validTo FROM user_work_periods WHERE userId = ? AND validTo IS NULL`)
        .get(userId) as { id: number; validTo: string | null } | undefined;
      expect(openPeriodAfter).toEqual(openPeriodBefore);

      const modelChangeCount = (
        db
          .prepare(`SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND type = 'model_change'`)
          .get(userId) as { c: number }
      ).c;
      expect(modelChangeCount).toBe(0);
    } finally {
      // Aufraeumen inkl. der absichtlich kaputten Kette — der Aufraeumnachweis unten prueft,
      // dass danach kein Befund fuer diesen Nutzer mehr besteht.
      cleanupEmployee(userId);
    }
  });
});

it('Aufraeumnachweis: kein Testnutzer mit Praefix test-12-05- bleibt zurueck, checkAllPeriodChains() meldet fuer die angelegten Testnutzer nichts', () => {
  expect(createdUserIds.length).toBeGreaterThan(0);

  const leftover = db.prepare(`SELECT id FROM users WHERE username LIKE 'test-12-05-%'`).all();
  expect(leftover).toHaveLength(0);

  const allIssues = checkAllPeriodChains();
  const ownIssues = allIssues.filter((issue) => createdUserIds.includes(issue.userId));
  expect(ownIssues).toEqual([]);

  for (const userId of createdUserIds) {
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeUndefined();
    expect(db.prepare('SELECT id FROM user_work_periods WHERE userId = ?').get(userId)).toBeUndefined();
    expect(db.prepare('SELECT id FROM overtime_transactions WHERE userId = ?').get(userId)).toBeUndefined();
    expect(db.prepare('SELECT userId FROM overtime_balance WHERE userId = ?').get(userId)).toBeUndefined();
    expect(db.prepare('SELECT id FROM time_entries WHERE userId = ?').get(userId)).toBeUndefined();
  }
});
