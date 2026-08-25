import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { createAbsenceRequest, approveAbsenceRequest } from './absenceService.js';
import { updateMonthlyOvertime } from './overtimeService.js';
import {
  getOvertimeBalance,
  getAvailableOvertimeBalance,
  getCommittedFutureCompensationHours,
} from './overtimeTransactionService.js';

/**
 * CR-01 — EIN GENEHMIGTER AUSGLEICH MIT ZUKUNFTSDATUM BINDET DAS GUTHABEN
 * (Phase 14.1, Befund CR-01 aus `14.1-REVIEW.md`. Messwerte: `14.1-NACHWEIS-CR01.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: Bis zu diesem Fix fussten BEIDE Pruefungen des
 * Ueberstundenausgleichs — die Anlegepruefung in `createAbsenceRequest()` und der
 * Genehmigungsvorbehalt in `approveAbsenceRequest()` — allein auf `getOvertimeBalance()`.
 * Diese Funktion summiert `overtime_balance` mit `month <= laufender Monat`.
 *
 * Ein Ausgleichstag erzeugt dort aber KEINE eigene Abbuchung: Er wirkt dadurch, dass der Tag
 * sein Tagessoll behaelt und keine Gutschrift bekommt (`handleAbsenceDay()` legt fuer
 * `overtime_comp` bewusst keine neutralisierende Zeile an, REQ-19). Der Fehlbetrag entsteht
 * also erst, wenn der Tag ins Rechenfenster faellt — und das Rechenfenster endet bei HEUTE
 * (`rebuildOvertimeTransactionsForMonth()` deckelt den laufenden Monat auf
 * `min(Monatsende, heute)`, `getOvertimeBalance()` blendet spaetere Monate ganz aus).
 *
 * Folge vor dem Fix, gemessen an Nutzer 2 der Arbeitsdatenbank (Wochenplan: nur Donnerstag
 * 5 h, Guthaben 10,00 h, Minusgrenze -20 h, also 30,00 h zulaessig): In sechs Runden wurden
 * 55,00 h Ausgleich genehmigt, der Saldo blieb in jeder Runde unveraendert bei 10,00 h.
 * Dasselbe Guthaben war beliebig oft vergebbar.
 *
 * WAS DER FIX AENDERT — UND WAS NICHT: Gemindert wird ausschliesslich die Groesse, gegen die
 * GEPRUEFT wird (`getAvailableOvertimeBalance()`). Der ANGEZEIGTE Saldo
 * (`getOvertimeBalance()`) bleibt unveraendert — der Mitarbeiter hat die Stunden ja noch, sie
 * sind nur verplant. Test 3 sichert genau das ab.
 *
 * ----------------------------------------------------------------------------------
 * ZEITRAUMWAHL — HIER LIEGT DER AUSGLEICHSTAG BEWUSST IN DER ZUKUNFT.
 *
 * Das ist der Unterschied zu allen fuenf Testdateien aus Plan 14.1: `overtimeCompSingleTrace`,
 * `absenceDeletionRecalc`, `historicalExportFiltering`, `sickLeaveRecalc` und
 * `workPeriodChangeService` erzwingen jeweils `Tag < HEUTE`. Genau deshalb ist CR-01 durch
 * die Suite gefallen. Der Regelfall des Freizeitausgleichs ist die VORAB-Beantragung.
 *
 * Der Ausgleichstag liegt im NAECHSTEN Monat, nicht spaeter im laufenden: Ein Tag im
 * laufenden Monat wuerde `updateMonthlyOvertime()` fuer den laufenden Monat ausloesen und
 * damit eine `overtime_balance`-Zeile ueber alle bisher unbearbeiteten Tage des Monats
 * anlegen. Der Testnutzer hat im laufenden Monat keine Zeiteintraege — die Zeile wuerde den
 * aufgebauten Ueberschuss ueberdecken und den Test verrauschen.
 *
 * MINUSGRENZE -4: `work_time_accounts.maxMinusHours` wird ausdruecklich gesetzt, statt sich
 * auf den Vorgabewert -20 zu verlassen — sonst braeuchte der Test einen kuenstlich grossen
 * Ueberschuss, um den Vorbehalt ueberhaupt zum Greifen zu bringen. Mit Guthaben 8,00 h und
 * Grenze -4,00 h betraegt der Verfuegungsrahmen 12,00 h: genau ein Ausgleichstag (8,00 h)
 * passt hinein, ein zweiter (dann -8,00 h) nicht.
 *
 * WARUM NICHT 0 ALS GRENZE — das waere die glatteste Rechnung: `absenceService.ts:959` liest
 * die Grenze als `account?.maxMinusHours || -20`. Bei einer gesetzten Grenze von 0 greift der
 * ODER-Zweig (0 ist in JavaScript falsy), und es gilt wieder -20. Eine Nullgrenze ist damit
 * heute nicht ausdrueckbar. Das ist ein EIGENSTAENDIGER Befund („falsy valid value"), NICHT
 * Teil von CR-01 und hier bewusst nicht behoben — der Test weicht ihm mit -4 aus.
 *
 * TESTAUFBAU (Muster aus `overtimeCompSingleTrace.test.ts`): geteilte Verbindung aus
 * `connection.js`, kein `:memory:`; eigenes Nutzerpraefix, weil alle Testdateien dieselbe
 * `development.db` teilen (`vitest.config.ts` -> `fileParallelism: false`); „heute"
 * ausschliesslich ueber `getTodayString()` (Berlin); Datumsfortschaltung ueber lokale
 * Kalenderfelder statt `toISOString()` (`.claude/CLAUDE.md`, „Timezone Bugs").
 *
 * D-08 — Der Test legt eigene Zeilen in `time_entries` und `absence_requests` an und raeumt
 * sie im `afterAll` wieder ab.
 * ----------------------------------------------------------------------------------
 */

const USERNAME_PREFIX = 'test-141-cr01-';
const createdUserIds: number[] = [];

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
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

/** Alle Werktage (Mo–Fr) eines Monats, die kein Feiertag sind. */
function nonHolidayWeekdays(isoFirstOfMonth: string): string[] {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const days: string[] = [];
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(d);
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) continue;
    days.push(dateStr);
  }
  return days;
}

function createEmployee(suffix: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T141CR01', suffix, 'hash', 'employee', 40, '2020-01-01');
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
    .run(username, `${username}@test.local`, 'T141CR01', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/**
 * REIHENFOLGE IST WESENTLICH — erst `users`, dann die abhaengigen Zeilen. Auf
 * `user_work_periods` liegt ein Trigger, der das Loeschen der LETZTEN Periode eines noch
 * bestehenden Nutzers verhindert. Uebernommen aus `overtimeCompSingleTrace.test.ts`.
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

function insertTimeEntry(userId: number, date: string, hours: number): void {
  const endHour = 8 + hours;
  db.prepare(
    `INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location, activity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    date,
    '08:00',
    `${String(endHour).padStart(2, '0')}:00`,
    0,
    hours,
    'office',
    'Arbeit',
    'CR-01 Regressionstest'
  );
}

/** Minusgrenze ausdruecklich festlegen, statt sich auf den Vorgabewert -20 zu verlassen. */
function setMinusLimit(userId: number, maxMinusHours: number): void {
  db.prepare(
    `INSERT INTO work_time_accounts (userId, currentBalance, maxPlusHours, maxMinusHours)
     VALUES (?, 0, 200, ?)
     ON CONFLICT(userId) DO UPDATE SET maxMinusHours = ?`
  ).run(userId, maxMinusHours, maxMinusHours);
}

/**
 * Legt einen Antrag DIREKT als 'pending' an und umgeht damit bewusst die Anlegepruefung.
 *
 * Das ist kein Kunstgriff, sondern der Regelfall: Zwei Antraege werden gestellt, BEVOR einer
 * von beiden genehmigt ist. Beide passieren die Anlegepruefung zu Recht — zu diesem Zeitpunkt
 * ist noch nichts verplant. Erst der Genehmigungsvorbehalt muss den zweiten abfangen. Nur so
 * ist dieser Vorbehalt isoliert messbar.
 */
function insertPendingCompRequest(userId: number, date: string): number {
  const result = db.prepare(
    `INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
     VALUES (?, 'overtime_comp', ?, ?, 1, 'pending', 'CR-01 Regressionstest')`
  ).run(userId, date, date);
  return result.lastInsertRowid as number;
}

const TODAY = getTodayString();
/** Monat -1: hier wird der Ueberschuss ueber Zeiteintraege aufgebaut. */
const SURPLUS_MONTH_START = firstOfMonthOffset(TODAY, -1);
const SURPLUS_MONTH = SURPLUS_MONTH_START.slice(0, 7);
/** Monat +1: hier liegen die Ausgleichstage — in der ZUKUNFT. */
const FUTURE_MONTH_START = firstOfMonthOffset(TODAY, 1);

const DAILY_TARGET = 8; // 40 h/Woche ohne Wochenplan -> 40/5
/** Minusgrenze des Testkontos. Siehe Dateikopf, Abschnitt "MINUSGRENZE -4". */
const MINUS_LIMIT = -4;

/**
 * Baut einen Nutzer mit genau `surplusHours` Ueberstunden auf.
 *
 * Der Ueberschuss entsteht ueber ZEITEINTRAEGE, nicht ueber ein direktes `UPDATE` auf
 * `overtime_balance` — sonst maesse der Test eine Lage, die der naechste Rebuild sofort
 * wieder aufloest.
 */
function buildEmployeeWithSurplus(suffix: string, surplusHours: number): number {
  const userId = createEmployee(suffix);
  insertTestWorkPeriod(userId, {
    validFrom: '2020-01-01',
    weeklyHours: 40,
    workSchedule: null,
    note: 'CR-01 Regressionstest',
  });
  setMinusLimit(userId, MINUS_LIMIT);

  const workdays = nonHolidayWeekdays(SURPLUS_MONTH_START);
  workdays.forEach((day, index) => {
    insertTimeEntry(userId, day, index === 0 ? DAILY_TARGET + surplusHours : DAILY_TARGET);
  });
  updateMonthlyOvertime(userId, SURPLUS_MONTH);

  return userId;
}

/** Die ersten `count` Werktage des naechsten Monats — alle in der Zukunft. */
function futureWorkdays(count: number): string[] {
  const days = nonHolidayWeekdays(FUTURE_MONTH_START).slice(0, count);
  // Nichttrivialitaetsbedingung dieser Datei: Ohne Zukunftstage misst sie nichts.
  for (const day of days) {
    expect(day > TODAY).toBe(true);
  }
  return days;
}

describe('CR-01: Genehmigter Ausgleich mit Zukunftsdatum bindet das Guthaben', () => {
  it('Test 1 — der Genehmigungsvorbehalt lehnt den zweiten Antrag ueber dasselbe Guthaben ab', async () => {
    const userId = buildEmployeeWithSurplus('vorbehalt', DAILY_TARGET);
    const adminId = createAdmin();

    const guthaben = getOvertimeBalance(userId);
    expect(guthaben).toBe(DAILY_TARGET); // 8,00 h — genau ein Ausgleichstag

    const [tag1, tag2] = futureWorkdays(2);

    // Beide Antraege stehen als 'pending', bevor einer genehmigt ist.
    const antrag1 = insertPendingCompRequest(userId, tag1);
    const antrag2 = insertPendingCompRequest(userId, tag2);

    // Erste Genehmigung: verfuegbar 8,00 h, Bedarf 8,00 h -> geht durch.
    await approveAbsenceRequest(antrag1, adminId, 'CR-01 Regressionstest');

    expect(getCommittedFutureCompensationHours(userId)).toBe(DAILY_TARGET);
    expect(getAvailableOvertimeBalance(userId)).toBe(0);

    // Zweite Genehmigung ueber dasselbe Guthaben: verfuegbar 0,00 h, Bedarf 8,00 h,
    // Minusgrenze -4,00 h -> 0 - 8 = -8 unterschreitet die Grenze, muss abgelehnt werden.
    //
    // OHNE DEN FIX geht sie durch: `hasSufficientOvertimeBalance()` saehe wieder die vollen
    // 8,00 h, weil der erste Ausgleichstag in einem kuenftigen Monat liegt und
    // `getOvertimeBalance()` diesen Monat ausblendet.
    await expect(
      approveAbsenceRequest(antrag2, adminId, 'CR-01 Regressionstest')
    ).rejects.toThrow(/Unzureichendes Überstunden-Guthaben/);

    // Der zweite Antrag ist nicht genehmigt worden.
    const status = db
      .prepare('SELECT status FROM absence_requests WHERE id = ?')
      .get(antrag2) as { status: string };
    expect(status.status).toBe('pending');

    // Insgesamt vergeben: genau ein Tagessoll, nicht zwei.
    expect(getCommittedFutureCompensationHours(userId)).toBe(DAILY_TARGET);
  });

  it('Test 2 — die Anlegepruefung lehnt einen zweiten Antrag ueber dasselbe Guthaben ab', async () => {
    const userId = buildEmployeeWithSurplus('anlage', DAILY_TARGET);
    const adminId = createAdmin();

    expect(getOvertimeBalance(userId)).toBe(DAILY_TARGET);

    const [tag1, tag2] = futureWorkdays(2);

    const antrag1 = createAbsenceRequest({
      userId,
      type: 'overtime_comp',
      startDate: tag1,
      endDate: tag1,
      reason: 'CR-01 Regressionstest',
    });
    await approveAbsenceRequest(antrag1.id, adminId, 'CR-01 Regressionstest');

    // OHNE DEN FIX legt dieser Aufruf einen zweiten Antrag an: Die Anlegepruefung vergleicht
    // `getOvertimeBalance()` (unveraendert 8,00 h) gegen den Bedarf (8,00 h) und laesst durch.
    expect(() =>
      createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: tag2,
        endDate: tag2,
        reason: 'CR-01 Regressionstest',
      })
    ).toThrow(/Insufficient overtime hours/);
  });

  it('Test 3 — der ANGEZEIGTE Saldo bleibt unveraendert; nur die Pruefgroesse sinkt', async () => {
    const userId = buildEmployeeWithSurplus('anzeige', DAILY_TARGET);
    const adminId = createAdmin();

    const saldoVorher = getOvertimeBalance(userId);
    expect(saldoVorher).toBe(DAILY_TARGET);
    expect(getCommittedFutureCompensationHours(userId)).toBe(0);
    expect(getAvailableOvertimeBalance(userId)).toBe(DAILY_TARGET);

    const [tag1] = futureWorkdays(1);
    const antrag = insertPendingCompRequest(userId, tag1);
    await approveAbsenceRequest(antrag, adminId, 'CR-01 Regressionstest');

    // Der Mitarbeiter HAT die Stunden noch — sie sind nur verplant.
    expect(getOvertimeBalance(userId)).toBe(saldoVorher);
    // Vergeben werden darf davon nichts mehr.
    expect(getCommittedFutureCompensationHours(userId)).toBe(DAILY_TARGET);
    expect(getAvailableOvertimeBalance(userId)).toBe(0);
  });

  it('Test 4 — ein Ausgleich in der VERGANGENHEIT wird nicht doppelt gezaehlt', async () => {
    // Ueberschuss von drei Tagessollen statt einem: Der unten entfernte Zeiteintrag kostet
    // bereits ein Tagessoll, und der Ausgleich muss danach noch genehmigungsfaehig sein —
    // sonst misst der Test die Ablehnung statt der Vormerkung.
    const userId = buildEmployeeWithSurplus('vergangenheit', DAILY_TARGET * 3);
    const adminId = createAdmin();

    // Ein Werktag des Ueberschussmonats, an dem noch kein Zeiteintrag steht, gibt es nicht —
    // deshalb wird der Eintrag des letzten Werktags entfernt und der Monat neu gerechnet.
    // Danach ist dieser Tag ein unbearbeiteter Tag: Sein Fehlbetrag steht bereits in
    // `overtime_balance`. Genau das ist die Lage, die ein Ausgleichstag in der Vergangenheit
    // erzeugt — er sieht rechnerisch aus wie ein nicht gearbeiteter Tag.
    const workdays = nonHolidayWeekdays(SURPLUS_MONTH_START);
    const vergangenerTag = workdays[workdays.length - 1];
    expect(vergangenerTag < TODAY).toBe(true);
    db.prepare('DELETE FROM time_entries WHERE userId = ? AND date = ?').run(userId, vergangenerTag);
    updateMonthlyOvertime(userId, SURPLUS_MONTH);

    const saldoVorher = getOvertimeBalance(userId);
    expect(saldoVorher).toBe(DAILY_TARGET * 2); // 24 h Ueberschuss - 8 h unbearbeiteter Tag
    expect(getAvailableOvertimeBalance(userId)).toBe(saldoVorher);

    const antrag = insertPendingCompRequest(userId, vergangenerTag);
    await approveAbsenceRequest(antrag, adminId, 'CR-01 Regressionstest');

    // KERNZUSICHERUNG: Der Fehlbetrag dieses Tages steckt bereits im Saldo. Eine zusaetzliche
    // Vormerkung waere eine DOPPELZAEHLUNG — der Mitarbeiter wuerde den Tag zweimal bezahlen.
    expect(getCommittedFutureCompensationHours(userId)).toBe(0);
    expect(getOvertimeBalance(userId)).toBe(saldoVorher);
    expect(getAvailableOvertimeBalance(userId)).toBe(saldoVorher);
  });

  it('Test 5 — ein Zeitraum, der HEUTE ueberspannt, wird tagegenau aufgeteilt', async () => {
    const userId = buildEmployeeWithSurplus('ueberspannend', DAILY_TARGET * 10);
    const adminId = createAdmin();

    // Zeitraum von gestern bis in den naechsten Monat: Nur die Tage NACH heute duerfen
    // vorgemerkt werden — die Tage bis einschliesslich heute stehen bereits im Saldo.
    const [y, m, d] = TODAY.split('-').map(Number);
    const gestern = isoDate(new Date(y, m - 1, d - 1));
    const [ersterZukunftstag] = futureWorkdays(1);

    const antrag = insertPendingCompRequest(userId, gestern);
    db.prepare('UPDATE absence_requests SET endDate = ? WHERE id = ?').run(ersterZukunftstag, antrag);
    await approveAbsenceRequest(antrag, adminId, 'CR-01 Regressionstest');

    const vorgemerkt = getCommittedFutureCompensationHours(userId);

    // Erwartet: die Werktage streng NACH heute bis einschliesslich `ersterZukunftstag`.
    const erwartet = alleWerktageZwischen(TODAY, ersterZukunftstag).length * DAILY_TARGET;
    expect(vorgemerkt).toBe(erwartet);

    // Gegenprobe: Der Gesamtzeitraum ist echt groesser als der vorgemerkte Teil — sonst
    // wuerde der Test die Aufteilung gar nicht pruefen.
    const gesamt = alleWerktageZwischen(gestern, ersterZukunftstag).length * DAILY_TARGET;
    expect(gesamt).toBeGreaterThan(vorgemerkt);
  });
});

/** Werktage (kein Wochenende, kein Feiertag) STRENG NACH `nachDatum` bis `bisDatum`. */
function alleWerktageZwischen(nachDatum: string, bisDatum: string): string[] {
  const [ny, nm, nd] = nachDatum.split('-').map(Number);
  const [by, bm, bd] = bisDatum.split('-').map(Number);
  const ende = new Date(by, bm - 1, bd);
  const tage: string[] = [];
  for (
    let cursor = new Date(ny, nm - 1, nd + 1);
    cursor <= ende;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(cursor);
    if (db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr)) continue;
    tage.push(dateStr);
  }
  return tage;
}
