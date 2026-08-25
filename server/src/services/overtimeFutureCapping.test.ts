import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import {
  calculateLiveOvertimeTransactions,
  calculateCurrentOvertimeBalance,
} from './overtimeLiveCalculationService.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

/**
 * BL-01 — REGRESSIONSNETZ GEGEN DIE RUECKKEHR DES ZUKUNFTSFEHLERS
 * (Phase 14.1, Plan 14.1-01, D-01; Befund BL-01 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: Im Kontoauszug stehen zwei Zahlen uebereinander — der fette
 * Saldo (`calculateCurrentOvertimeBalance`) und die Buchungsliste darunter
 * (`calculateLiveOvertimeTransactions`). Der Client schickt beiden denselben `toDate`, und das
 * ist der letzte Tag des gewaehlten Monats, also regelmaessig ein Datum in der Zukunft
 * (`routes/overtime.ts:519`/`:527`, `desktop/src/hooks/useWorkTimeAccounts.ts:296-304`). Die
 * Liste deckelte seit dem WR-10-Fix auf heute, der Saldo darueber nicht — jeder kuenftige
 * Arbeitstag ging mit vollem Tagessoll ohne Ist als Minus ein. Fuer Nutzer 17 waren das am
 * 24.08.2026 acht Stunden Unterschied auf einem Bildschirm.
 *
 * Vier Tests, jeder gegen genau eine Aussage aus D-01:
 *   1. `calculateCurrentOvertimeBalance` deckelt ein `toDate` in der Zukunft auf heute.
 *   2. Saldo und Summe der Buchungen darunter stimmen ueberein (das erste Erfolgskriterium
 *      der Phase, hier an einem Testnutzer, im Nachweisdokument an allen echten Nutzern).
 *   3. Ein soft-geloeschter Nutzer bekommt keinen Saldo mehr, sondern eine Ablehnung.
 *   4. `calculatePeriodOvertime` deckelt selbst — direkt geprueft, nicht nur ueber den
 *      Aufrufer, damit ein kuenftiger zweiter Aufrufer die Deckelung nicht erneut verlieren
 *      kann.
 *
 * AUFBAU (Muster aus `workPeriodChangeService.test.ts`): geteilte Verbindung aus
 * `connection.js`, kein `:memory:`; eigenes Nutzerpraefix `test-141-01-`, weil parallel
 * arbeitende Testdateien dieselbe `development.db` teilen; „heute" ausschliesslich ueber
 * `getTodayString()` (Berlin), nie ueber `new Date()`; Datumsfortschaltung ueber lokale
 * Kalenderfelder statt `toISOString()` (`.claude/CLAUDE.md`, „Timezone Bugs").
 *
 * WARUM DER TEST AM MONATSLETZTEN NICHT TRIVIAL GRUEN WIRD: Faellt „heute" auf den letzten
 * Tag des Monats, waere das Zukunftsfenster [heute+1 … Monatsende] leer und jeder Vergleich
 * ginge auch ohne Deckelung auf. Der Test waehlt in diesem Fall den letzten Tag des
 * FOLGEmonats als Zukunftsende (`FUTURE_END` unten) — das Fenster ist damit an jedem
 * Kalendertag nicht leer.
 */

const USERNAME_PREFIX = 'test-141-01-';
const createdUserIds: number[] = [];

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE user_work_periods/
  // overtime_transactions beim Loeschen des Testnutzers nicht ab.
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

/** YYYY-MM-DD einer lokalen Date-Instanz — keine ISO-String-Konvertierung. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Erster Tag des Monats, der `deltaMonths` Monate von `baseIsoDate` entfernt liegt. */
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

function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14101', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
}

/** Zeiteintraege fuer jeden Werktag (kein Wochenende, kein Feiertag) in [from, to]. */
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bewusst 9 statt 8 Stunden je Werktag bei 40 Wochenstunden (Tagessoll 8 h): Jeder
 * VERGANGENE Werktag traegt damit +1,00 h bei, und Saldo wie Journalsumme sind von null
 * verschieden. Mit 8 h waeren beide exakt 0,00 h — Test 2 wuerde dann „0 gleich 0" pruefen
 * und auch bei einem voellig kaputten Rechenwerk gruen bleiben. Die Tests unten sichern
 * diese Nichttrivialitaet zusaetzlich mit einer eigenen Erwartung ab.
 */
const WORKED_HOURS_PER_WEEKDAY = 9;

const TODAY = getTodayString();
const MONTH_START = firstOfMonthOffset(TODAY, 0);
const MONTH_END = lastOfMonth(MONTH_START);

/**
 * Das angefragte Ende, das der Client schickt — garantiert in der Zukunft. Am Monatsletzten
 * waere `MONTH_END === TODAY` und das Zukunftsfenster leer; dann wird auf den letzten Tag des
 * Folgemonats ausgewichen.
 */
const FUTURE_END = MONTH_END > TODAY ? MONTH_END : lastOfMonth(firstOfMonthOffset(TODAY, 1));

describe('BL-01: Deckelung auf heute (Phase 14.1, D-01)', () => {
  it('Test 1: calculateCurrentOvertimeBalance liefert fuer ein Monatsende in der Zukunft denselben Saldo wie fuer heute', () => {
    const userId = createEmployee('deckelung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, MONTH_START, TODAY, WORKED_HOURS_PER_WEEKDAY);

      expect(FUTURE_END > TODAY).toBe(true);

      const balanceBisZukunft = calculateCurrentOvertimeBalance(userId, MONTH_START, FUTURE_END);
      const balanceBisHeute = calculateCurrentOvertimeBalance(userId, MONTH_START, TODAY);

      // Nichttrivialitaet: Der Saldo bis heute muss von null verschieden sein, sonst
      // verglichen die Erwartungen unten zwei Nullen.
      expect(balanceBisHeute).not.toBe(0);

      // Vor dem Fix waeren die beiden Werte um das gesamte Restmonatssoll verschieden
      // (jeder kuenftige Arbeitstag: volles Tagessoll ohne Ist).
      expect(balanceBisZukunft).toBe(balanceBisHeute);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 2: Der Saldo stimmt mit der Summe der darunter gezeigten Buchungen ueberein', () => {
    const userId = createEmployee('uebereinstimmung', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, MONTH_START, TODAY, WORKED_HOURS_PER_WEEKDAY);

      // Beide Funktionen mit IDENTISCHEN Argumenten — genau so ruft die Route sie auf
      // (`routes/overtime.ts:519` und `:527`, dieselben fromDateStr/toDateStr).
      const transactions = calculateLiveOvertimeTransactions(userId, MONTH_START, FUTURE_END);
      const journalSum = round2(transactions.reduce((sum, t) => sum + t.hours, 0));
      const balance = calculateCurrentOvertimeBalance(userId, MONTH_START, FUTURE_END);

      // Nichttrivialitaet: beide Zahlen muessen von null verschieden sein.
      expect(journalSum).not.toBe(0);
      expect(balance).not.toBe(0);

      expect(round2(journalSum - balance)).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 3: Ein soft-geloeschter Nutzer bekommt keinen Saldo, sondern eine Ablehnung', () => {
    const userId = createEmployee('softdelete', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, MONTH_START, TODAY, WORKED_HOURS_PER_WEEKDAY);

      // Vor der Loeschung liefert die Funktion einen Saldo — sonst wuerde der Test unten auch
      // dann bestehen, wenn er aus einem ganz anderen Grund wirft.
      expect(() => calculateCurrentOvertimeBalance(userId, MONTH_START, TODAY)).not.toThrow();

      db.prepare('UPDATE users SET deletedAt = ? WHERE id = ?').run(new Date().toISOString(), userId);

      expect(() => calculateCurrentOvertimeBalance(userId, MONTH_START, TODAY)).toThrow();
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 4: calculatePeriodOvertime deckelt selbst, nicht erst der Aufrufer', () => {
    const userId = createEmployee('periode', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      insertWeekdayTimeEntries(userId, MONTH_START, TODAY, WORKED_HOURS_PER_WEEKDAY);

      const bisZukunft = unifiedOvertimeService.calculatePeriodOvertime(
        userId,
        MONTH_START,
        FUTURE_END
      );
      const bisHeute = unifiedOvertimeService.calculatePeriodOvertime(userId, MONTH_START, TODAY);

      expect(round2(bisHeute.overtime)).not.toBe(0);
      expect(round2(bisZukunft.overtime)).toBe(round2(bisHeute.overtime));
      // Auch die Zahl der Tageszeilen darf nicht ueber heute hinauswachsen.
      expect(bisZukunft.dailyResults.length).toBe(bisHeute.dailyResults.length);
    } finally {
      cleanupEmployee(userId);
    }
  });
});

describe('Aufraeumnachweis', () => {
  it('kein Testnutzer mit dem Praefix test-141-01- bleibt in users stehen', () => {
    const rest = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(rest.c).toBe(0);
  });
});
