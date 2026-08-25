import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

/**
 * F-5 — REGRESSIONSNETZ GEGEN DIE RUECKKEHR DER BEDINGTEN DECKELUNG
 * (Phase 14.2, Plan 14.2-05; Befund F-5 aus `14-ABNAHME-SICHT.md` § 5, dazu B-4 aus
 * `14-ABNAHME-SERVER.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: `rebuildOvertimeTransactionsForMonth()` koppelte die Deckelung
 * des Berechnungsendes an den laufenden Monat. Fuer jeden Monat DANACH lief die
 * Tagesberechnung bis zum Monatsletzten und buchte fuer jeden kuenftigen Werktag ein volles
 * Tagessoll ohne Ist. Weil `overtimeService.updateMonthlyOvertime()` diesen Rebuild NACH
 * seinem eigenen, korrekt gedeckelten Upsert in `overtime_balance` aufruft
 * (`overtimeService.ts:163` nach `:144`), ueberschrieb der ungedeckelte Wert das richtige
 * Ergebnis. 14.1-BL-01 hatte dasselbe Muster an zwei anderen Stellen bereits behoben
 * (`unifiedOvertimeService.ts`, `overtimeLiveCalculationService.ts`); diese dritte Stelle lag
 * damals nicht im Umfang.
 *
 * Fuenf Tests, jeder gegen genau eine Aussage:
 *   1. Ein reiner Zukunftsmonat schreibt `targetHours = 0` und `actualHours = 0`.
 *   2. Ein reiner Zukunftsmonat legt keine Journalzeile mit Zukunftsdatum an.
 *   3. Der laufende Monat ist unveraendert — und stimmt mit
 *      `unifiedOvertimeService.calculateMonthlyOvertime()` ueberein (beide Rechenwege
 *      duerfen sich nicht mehr widersprechen).
 *   4. book-once-Zeilen mit Zukunftsdatum (`model_change`, WR-10) ueberleben den Rebuild —
 *      der `REBUILDABLE_TYPES`-Filter des DELETE in STEP 3 schuetzt sie weiterhin.
 *   5. Ein vollstaendig vergangener Monat ist unveraendert (NO REGRESSION).
 *
 * AUFBAU (Muster aus `workPeriodChangeService.test.ts` und `overtimeFutureCapping.test.ts`):
 * geteilte Verbindung aus `connection.js`, kein `:memory:`; eigenes Nutzerpraefix
 * `test-142-05-`, weil parallel arbeitende Testdateien dieselbe Arbeitsdatenbank teilen;
 * „heute" ausschliesslich ueber `getTodayString()` (Berlin), nie ueber `new Date()`;
 * Datumsfortschaltung ueber lokale Kalenderfelder statt `toISOString()`
 * (`.claude/CLAUDE.md`, „Timezone Bugs").
 *
 * KEIN EINZIGES FEST VERDRAHTETES DATUM: Alle Monate werden relativ zu heute gebildet. Die
 * Zukunftsluecke aus 14.1-U30 (ein Test, der nur an bestimmten Kalendertagen etwas misst)
 * wird hier ausdruecklich nicht wiederholt — `heute + 1 Monat` ist an jedem Kalendertag ein
 * reiner Zukunftsmonat, `heute - 2 Monate` an jedem Kalendertag vollstaendig vergangen.
 *
 * D-01: Diese Datei schreibt in KEINE der fuenf geschuetzten Tabellen. Es werden weder
 * Zeiteintraege noch Abwesenheiten noch Korrekturen angelegt — die Sollstunden entstehen
 * allein aus der Arbeitszeitperiode.
 */

const USERNAME_PREFIX = 'test-142-05-';
const createdUserIds: number[] = [];

const today = getTodayString();
const currentMonth = today.slice(0, 7);

/** `YYYY-MM` um `delta` Monate verschoben — reine Zahlenarithmetik, kein Date-Parsing. */
function monthOffset(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

/** Erster Tag des Monats `YYYY-MM`. */
function firstOfMonth(month: string): string {
  return `${month}-01`;
}

/** Zahl der Kalendertage des Monats `YYYY-MM` — ueber lokale Kalenderfelder. */
function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Ein Tag mitten im Monat `YYYY-MM` — reicht als Datum einer Journalzeile. */
function midOfMonth(month: string): string {
  return `${month}-15`;
}

interface BalanceRow {
  targetHours: number;
  actualHours: number;
}

function isBalanceRow(value: unknown): value is BalanceRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.targetHours === 'number' && typeof row.actualHours === 'number';
}

/** Die `overtime_balance`-Zeile eines Nutzers fuer einen Monat — oder `null`. */
function readBalance(userId: number, month: string): BalanceRow | null {
  const row: unknown = db
    .prepare('SELECT targetHours, actualHours FROM overtime_balance WHERE userId = ? AND month = ?')
    .get(userId, month);
  return isBalanceRow(row) ? row : null;
}

function countRows(sql: string, ...params: Array<number | string>): number {
  const row: unknown = db.prepare(sql).get(...params);
  if (typeof row === 'object' && row !== null && typeof (row as Record<string, unknown>).c === 'number') {
    return (row as { c: number }).c;
  }
  throw new Error(`Zaehlabfrage lieferte kein Ergebnis: ${sql}`);
}

/**
 * Legt einen Testnutzer samt laufender Arbeitszeitperiode an. `hireDate` liegt bewusst weit
 * in der Vergangenheit, damit die `hireDate > endDate`-Wache im Rebuild nicht greift und der
 * Nachweis wirklich die Deckelung misst und nicht das Einstellungsdatum.
 */
function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14205', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);

  insertTestWorkPeriod(userId, {
    validFrom: hireDate,
    validTo: null,
    weeklyHours,
    workSchedule: null,
    note: 'test-142-05-fixture',
  });

  return userId;
}

/**
 * Raeumt einen Testnutzer ab. REIHENFOLGE: erst `users`, dann die abhaengigen Zeilen — auf
 * `user_work_periods` liegt ein Trigger, der das Loeschen der letzten Periode eines noch
 * bestehenden Nutzers verhindert (deferred-items.md, Plan 14.1-03, Punkt 2).
 */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
}

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE die abhaengigen Zeilen beim
  // Loeschen des Testnutzers nicht ab (Muster aus workPeriodChangeService.test.ts).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  // Sicherheitsnetz: Was ein fehlgeschlagener Test im `finally` nicht abgeraeumt hat, faellt
  // hier weg — der Aufraeumnachweis am Dateiende laeuft davor und wuerde es sonst melden.
  for (const userId of createdUserIds) {
    cleanupEmployee(userId);
  }
});

describe('F-5: rebuildOvertimeTransactionsForMonth deckelt das Berechnungsende unbedingt auf heute', () => {
  it('Test 1: Ein reiner Zukunftsmonat schreibt targetHours = 0 und actualHours = 0', () => {
    const hireDate = firstOfMonth(monthOffset(currentMonth, -12));
    const userId = createEmployee('zukunft-null', 40, hireDate);
    const futureMonth = monthOffset(currentMonth, 1);

    try {
      rebuildOvertimeTransactionsForMonth(userId, futureMonth);

      const balance = readBalance(userId, futureMonth);
      expect(balance).not.toBeNull();
      expect(balance?.targetHours).toBe(0);
      expect(balance?.actualHours).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 2: Ein reiner Zukunftsmonat legt keine Journalzeile mit Zukunftsdatum an', () => {
    const hireDate = firstOfMonth(monthOffset(currentMonth, -12));
    const userId = createEmployee('zukunft-journal', 40, hireDate);
    const futureMonth = monthOffset(currentMonth, 1);

    try {
      rebuildOvertimeTransactionsForMonth(userId, futureMonth);

      // Bewusst gegen `getTodayString()` (Berlin) und nicht gegen SQLites `date('now')`
      // (UTC) verglichen — sonst haengt das Ergebnis in den ersten beiden Nachtstunden von
      // der Zeitzone ab (`.claude/CLAUDE.md`, „Timezone Bugs").
      const futureRows = countRows(
        'SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND date > ?',
        userId,
        today
      );
      expect(futureRows).toBe(0);

      const rowsInFutureMonth = countRows(
        'SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND date LIKE ?',
        userId,
        `${futureMonth}-%`
      );
      expect(rowsInFutureMonth).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 3: Der laufende Monat ist unveraendert und stimmt mit calculateMonthlyOvertime ueberein', () => {
    const hireDate = firstOfMonth(monthOffset(currentMonth, -12));
    const userId = createEmployee('laufend', 40, hireDate);

    try {
      rebuildOvertimeTransactionsForMonth(userId, currentMonth);

      const balance = readBalance(userId, currentMonth);
      expect(balance).not.toBeNull();

      // Der Vergleichswert wird NICHT als Konstante hinterlegt, sondern aus dem zweiten
      // Rechenweg gezogen. Dass beide Wege dieselbe Zahl liefern, ist der eigentliche
      // Beweis: vorher widersprachen sie sich fuer Zukunftsmonate.
      const unified = unifiedOvertimeService.calculateMonthlyOvertime(userId, currentMonth);

      expect(balance?.targetHours).toBeCloseTo(unified.targetHours, 2);
      expect(balance?.actualHours).toBeCloseTo(unified.actualHours, 2);
      expect(unified.targetHours).toBeGreaterThan(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 4: Eine model_change-Zeile mit Zukunftsdatum ueberlebt den Rebuild (WR-10)', () => {
    const hireDate = firstOfMonth(monthOffset(currentMonth, -12));
    const userId = createEmployee('bookonce', 40, hireDate);
    const futureMonth = monthOffset(currentMonth, 1);
    const futureDate = midOfMonth(futureMonth);

    try {
      db.prepare(
        `INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType)
         VALUES (?, ?, 'model_change', ?, ?, 'work_period')`
      ).run(userId, futureDate, 4, 'Testzeile 14.2-05: Modellwechsel mit Zukunftsdatum');

      const before = countRows(
        "SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND type = 'model_change' AND date = ?",
        userId,
        futureDate
      );
      expect(before).toBe(1);

      rebuildOvertimeTransactionsForMonth(userId, futureMonth);

      const after = countRows(
        "SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND type = 'model_change' AND date = ?",
        userId,
        futureDate
      );
      expect(after).toBe(1);

      // Und es ist die EINZIGE Zeile geblieben — der Rebuild hat keine Tageszeile
      // hinzugefuegt.
      const allInMonth = countRows(
        'SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND date LIKE ?',
        userId,
        `${futureMonth}-%`
      );
      expect(allInMonth).toBe(1);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 5: Ein vollstaendig vergangener Monat ist unveraendert (NO REGRESSION)', () => {
    const hireDate = firstOfMonth(monthOffset(currentMonth, -12));
    const userId = createEmployee('vergangen', 40, hireDate);
    const pastMonth = monthOffset(currentMonth, -2);

    try {
      rebuildOvertimeTransactionsForMonth(userId, pastMonth);

      const balance = readBalance(userId, pastMonth);
      expect(balance).not.toBeNull();
      expect(balance?.targetHours).toBeGreaterThan(0);

      // Eine Tageszeile je Kalendertag des Monats — der Rebuild hat den vollen Monat
      // gerechnet und nicht etwa auf heute gedeckelt.
      const dayRows = countRows(
        "SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ? AND type = 'time_entry' AND date LIKE ?",
        userId,
        `${pastMonth}-%`
      );
      expect(dayRows).toBe(daysInMonth(pastMonth));
    } finally {
      cleanupEmployee(userId);
    }
  });
});
