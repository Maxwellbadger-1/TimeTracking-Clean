import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import {
  createAbsenceRequest,
  approveAbsenceRequest,
  deleteAbsenceRequest,
} from './absenceService.js';
import { updateAllOvertimeLevels } from './overtimeService.js';

/**
 * BL-02 — REGRESSIONSNETZ FUER DEN LOESCHPFAD VON ABWESENHEITEN
 * (Phase 14.1, Plan 14.1-02, D-02; Befund BL-02 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: `absenceService.ts` rief an zwei Stellen des Loeschpfads
 * CommonJS auf — in einem Modul, das als ES-Modul laeuft (`server/package.json` ->
 * `"type": "module"`, `tsconfig.json` -> `"module": "ESNext"`). Beide Aufrufe warfen sofort.
 * Im ausgelieferten Betrieb (node, ESM) ist die CommonJS-Ladefunktion gar nicht definiert —
 * ReferenceError. Unter tsx/vitest stellt der Laufzeit-Shim sie bereit, die CJS-Aufloesung
 * bildet aber `./overtimeService.js` nicht auf die `.ts`-Datei ab — MODULE_NOT_FOUND
 * (so im Gegenversuch gemessen, s. 14.1-NACHWEIS-BL02.md, Abschnitt 3). Die Wirkung ist
 * dieselbe: Der Aufruf wirft. Beide standen in einem try/catch, das den Fehler nur
 * weglogte. Nach aussen meldete die Loeschung Erfolg, waehrend die Neuberechnung nie lief:
 * Die Gutschriftszeilen blieben im Journal stehen und der Kontostand-Cache in
 * `work_time_accounts` blieb stehen.
 *
 * Zwei Sachtests, jeder gegen genau eine der beiden Fundstellen:
 *   1. `deleteAbsenceRequest` (frueher :1198) — nach dem Loeschen eines genehmigten Urlaubs
 *      sind die `overtime_transactions`-Zeilen des Antrags weg.
 *   2. `deleteSickLeaveTimeEntries` (frueher :1421) — nach dem Loeschen einer genehmigten
 *      Krankmeldung ist `work_time_accounts.currentBalance` nachgezogen.
 * Dazu ein Aufraeumnachweis am Dateiende.
 *
 * ------------------------------------------------------------------------------------
 * D-11 — WARUM HIER NICHT UEBER `overtime_balance` NACHGEWIESEN WIRD (die Gegenprobe auf
 * den Fehlerpfad, ausdruecklich festgehalten statt nur befolgt):
 *
 * Der naechtliche Lauf um 03:00 Uhr ist seit dem 23.08.2026 angehalten — genau er hat BL-02
 * bisher verdeckt, indem er die Neuberechnung nachholte. Ein Nachweis, der sich darauf
 * verlassen koennte, dass „es sich von selbst richtet", ist wertlos.
 *
 * `overtime_balance` ist so eine Tabelle: Sie wird bei JEDER Berichtsabfrage neu geschrieben
 * (`updateMonthlyOvertime` -> `INSERT ... ON CONFLICT DO UPDATE`, `overtimeService.ts:144-156`;
 * `rebuildOvertimeTransactionsForMonth`, `overtimeTransactionRebuildService.ts:609-621`).
 * Ein Test, der nach der Loeschung `overtime_balance` prueft, wuerde deshalb auch mit
 * kaputtem Loeschpfad gruen, sobald irgendetwas dazwischen einmal rechnet. Er beweist nichts.
 *
 * Deshalb: In dieser Datei stehen die Treffer auf `overtime_balance` AUSSCHLIESSLICH in
 * Kommentaren und in den Aufraeumanweisungen — in keiner einzigen `expect`-Zusicherung.
 * Nachgewiesen wird gegen `overtime_transactions` (Test 1) und `work_time_accounts`
 * (Test 2). Beide werden nur von dem Pfad geschrieben, den BL-02 lahmgelegt hatte.
 *
 * Und: Zwischen dem Loeschvorgang und der Messung liegt in beiden Tests KEIN Aufruf einer
 * Berichtsfunktion, kein Rebuild von Hand und selbstverstaendlich kein Nachtlauf. Die
 * `expect`-Zeile folgt unmittelbar auf `deleteAbsenceRequest(...)`.
 * ------------------------------------------------------------------------------------
 *
 * AUFBAU (Muster aus `workPeriodChangeService.test.ts` und `overtimeFutureCapping.test.ts`):
 * geteilte Verbindung aus `connection.js`, kein `:memory:`; eigenes Nutzerpraefix
 * `test-141-02-`, weil alle Testdateien dieselbe `development.db` teilen
 * (`vitest.config.ts` -> `fileParallelism: false`); „heute" ausschliesslich ueber
 * `getTodayString()` (Berlin), nie ueber `new Date()`; Datumsfortschaltung ueber lokale
 * Kalenderfelder statt `toISOString()` (`.claude/CLAUDE.md`, „Timezone Bugs").
 *
 * ZEITRAUMWAHL: Der Antragszeitraum liegt im VORMONAT, nie in der Zukunft. Nach Plan 14.1-01
 * (BL-01) wird fuer Tage in der Zukunft nicht mehr gerechnet — ein Zukunftszeitraum wuerde
 * diesen Test still leerlaufen lassen.
 */

const USERNAME_PREFIX = 'test-141-02-';
const createdUserIds: number[] = [];

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE die abhaengigen Zeilen beim
  // Loeschen des Testnutzers nicht ab.
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  // Sicherheitsnetz: Was ein fehlgeschlagener Test im `finally` nicht abgeraeumt hat, faellt
  // hier weg — der Aufraeumnachweis am Dateiende laeuft danach und wuerde es sonst melden.
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

/**
 * Erster Werktag (Mo–Fr) des Monats, der kein Feiertag ist. Urlaub schliesst Feiertage aus
 * (`countWorkingDaysForUser` mit `db`); faellt der gewaehlte Tag auf einen Feiertag, waere
 * `days === 0` und `createAbsenceRequest` wuerfe „must span at least one business day".
 */
function firstNonHolidayWeekday(isoFirstOfMonth: string): string {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(d);
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) continue;
    return dateStr;
  }
  throw new Error(`Kein Werktag ohne Feiertag in ${isoFirstOfMonth} gefunden`);
}

function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14102', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

function createAdmin(): number {
  const username = `${USERNAME_PREFIX}admin-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14102', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/**
 * Raeumt jede Zeile ab, die ein Testnutzer erzeugt haben kann. Die fuenf nach D-08
 * geschuetzten Tabellen (`time_entries`, `absence_requests`, `overtime_corrections`,
 * `vacation_balance`, `vacation_transactions`) stehen bewusst mit drin: Der Test legt dort
 * eigene Zeilen an, und die D-08-Kennzahlen werden NACH dem Aufraeumen erhoben. Weicht eine
 * Zahl dann ab, ist dieser Aufraeumpfad unvollstaendig — nicht die Kennzahl.
 *
 * `overtime_balance` erscheint hier als AUFRAEUMANWEISUNG, nicht als Beleg (D-11, siehe
 * Kopfkommentar).
 */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM audit_log WHERE userId = ?').run(userId);
}

/** Zeilen in `overtime_transactions`, die auf genau diesen Antrag zeigen. */
function absenceTransactionCount(userId: number, requestId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM overtime_transactions
       WHERE userId = ? AND referenceType = 'absence' AND referenceId = ?`
    )
    .get(userId, requestId) as { c: number };
  return row.c;
}

/** Kontostand-Cache. `null`, wenn noch kein Konto existiert. */
function workTimeAccountBalance(userId: number): number | null {
  const row = db
    .prepare('SELECT currentBalance FROM work_time_accounts WHERE userId = ?')
    .get(userId) as { currentBalance: number } | undefined;
  return row ? row.currentBalance : null;
}

const TODAY = getTodayString();
/** Vormonat — garantiert vollstaendig in der Vergangenheit, an jedem Kalendertag. */
const PREV_MONTH_START = firstOfMonthOffset(TODAY, -1);
const PREV_MONTH_END = lastOfMonth(PREV_MONTH_START);

describe('BL-02: Der Loeschpfad rechnet neu (Phase 14.1, D-02)', () => {
  it('Test 1: Nach dem Loeschen eines genehmigten Urlaubs sind seine overtime_transactions unmittelbar weg', async () => {
    const adminId = createAdmin();
    const userId = createEmployee('urlaub', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);
      expect(day < TODAY).toBe(true);
      expect(PREV_MONTH_END < TODAY).toBe(true);

      const request = createAbsenceRequest({
        userId,
        type: 'vacation',
        startDate: day,
        endDate: day,
        reason: 'BL-02 Regressionstest',
      });
      await approveAbsenceRequest(request.id, adminId);

      // Nichttrivialitaet: Ohne Zeilen VOR der Loeschung wuerde die Erwartung „0 danach"
      // auch bei voellig kaputtem Rechenwerk bestehen.
      const vorher = absenceTransactionCount(userId, request.id);
      expect(vorher).toBeGreaterThan(0);

      deleteAbsenceRequest(request.id, adminId);
      // D-11: unmittelbar danach gemessen. Keine Berichtsabfrage, kein Rebuild von Hand,
      // kein Nachtlauf dazwischen — die naechste Anweisung ist die Messung.
      const nachher = absenceTransactionCount(userId, request.id);

      expect(nachher).toBe(0);
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });

  it('Test 2: Nach dem Loeschen einer genehmigten Krankmeldung ist work_time_accounts unmittelbar nachgezogen', () => {
    const adminId = createAdmin();
    const userId = createEmployee('krank', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);
      expect(day < TODAY).toBe(true);

      // Krankmeldungen werden bei der Anlage automatisch genehmigt
      // (`absenceService.ts` — Festlegung des Anwenders vom 25.08.2026, bleibt unveraendert).
      const request = createAbsenceRequest({
        userId,
        type: 'sick',
        startDate: day,
        endDate: day,
        reason: 'BL-02 Regressionstest',
      });
      expect(request.status).toBe('approved');

      // Die automatisch erzeugten Zeiteintraege der Krankmeldung — genau die Zeilen, die
      // `deleteSickLeaveTimeEntries()` beim Loeschen entfernt (Filter: activity='Krankheit'
      // und notes LIKE '%Krankmeldung #<id>%'). Sie werden hier als Fixture angelegt, weil
      // der Loeschpfad ohne sie nichts zu entfernen haette und der Test dann leerliefe.
      db.prepare(
        `INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location, activity, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, day, '08:00', '16:00', 0, 8, 'office', 'Krankheit', `Krankmeldung #${request.id}`);

      // Ausgangsstand herstellen: Das ist der Stand, den der (seit dem 23.08. ANGEHALTENE)
      // Nachtlauf hinterlassen haette. Er wird VOR der Loeschung hergestellt, damit es
      // ueberhaupt einen definierten Vorher-Wert gibt — nicht zwischen Loeschung und Messung.
      updateAllOvertimeLevels(userId, day);
      const vorher = workTimeAccountBalance(userId);
      expect(vorher).not.toBeNull();

      deleteAbsenceRequest(request.id, adminId);
      // D-11: unmittelbar danach gemessen, ohne Berichtsabfrage und ohne Nachtlauf.
      const nachher = workTimeAccountBalance(userId);

      expect(nachher).not.toBeNull();
      // Vor dem Fix warf der CommonJS-Aufruf in `deleteSickLeaveTimeEntries`, und das
      // umgebende catch logte den Fehler nur weg: Die Zeiteintraege waren weg, der
      // Kontostand-Cache stand unveraendert weiter — genau diese Gleichheit macht den Test rot.
      // Gemessen im Gegenversuch: "expected -168 not to be -168".
      expect(nachher).not.toBe(vorher);
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });
});

describe('Aufraeumnachweis', () => {
  it('Test 3: kein Nutzer mit dem Praefix test-141-02- bleibt in users stehen', () => {
    const rest = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(rest.c).toBe(0);
  });
});
