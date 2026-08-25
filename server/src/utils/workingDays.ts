import type BetterSqlite3 from 'better-sqlite3';
import { db } from '../database/connection.js';
import type { DayName, UserPublic, UserWorkPeriod } from '../types/index.js';
import { formatDate as formatDateBerlin } from './timezone.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';
import logger from './logger.js';

// Re-export DayName type for use in other modules
export type { DayName };

/**
 * Der Ausschnitt aus `UserPublic`, den die Sollstunden-Auflösung tatsächlich braucht.
 *
 * WR-13 (Code-Review Phase 12): `overtimeLiveCalculationService` baute sich für diese
 * Funktion ein Objekt aus vier Feldern zusammen und schob es mit `as UserPublic` durch —
 * ein Cast, der unterdrückte, dass das Objekt die meisten Pflichtfelder von `UserPublic`
 * (username, email, role, status, …) gar nicht trägt. Diese Funktion braucht sie auch nicht:
 * gelesen werden nur `id` und `hireDate` (die Sollstunden kommen seit Phase 11 aus der
 * Periode, nicht aus dem Stammdatensatz).
 *
 * Der Parametertyp ist damit ERWEITERT, nicht eingeengt: jedes vollständige `UserPublic`
 * erfüllt ihn weiterhin, kein Aufrufer muss geändert werden — aber ein Aufrufer, der nur den
 * Ausschnitt hat, braucht keinen Cast mehr.
 */
export type TargetHoursUser = Pick<
  UserPublic,
  'id' | 'hireDate' | 'weeklyHours' | 'workSchedule'
>;

/** Ausschließlich Zeichenketten im Format YYYY-MM-DD — Grundlage für den D4-Vergleich gegen
 *  `user.hireDate`. Läuft zur Laufzeit auch gegen Werte, die die Signatur schon ausschließt. */
const HIRE_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Eigene Fehlerklasse für D4: Für ein Datum ab `hireDate` konnte keine Arbeitszeitperiode
 * aufgelöst werden. Nach Migration 009 (Bestand) und Plan 11-03 (Neuanlage) hat jeder Nutzer
 * eine lückenlose Periodenkette ab `hireDate` — ein Fehlen ist deshalb ein Datendefekt, kein
 * Zustand, der einen stillen Rückfall auf `users.weeklyHours` rechtfertigt. Die Meldung nennt
 * ausschließlich `userId` und Datum (T-11-12) — für ein Log gebaut, nicht für eine UI.
 */
export class MissingWorkPeriodError extends Error {
  constructor(userId: number, date: string) {
    super(
      `Keine Arbeitszeitperiode für Nutzer ${userId} am ${date} gefunden. Nach Migration 009 ` +
        `hat jeder Nutzer eine lückenlose Periodenkette ab hireDate — ein Fehlen ist ein ` +
        `Datendefekt, kein Zustand, der einen Rückfall auf users.weeklyHours erlaubt (D4).`
    );
    this.name = 'MissingWorkPeriodError';
  }
}

/**
 * D4-Auflösung mit gemeinsamer Ausnahmebehandlung für `getDailyTargetHours` und
 * `calculateAbsenceHoursWithWorkSchedule`: löst die Periode über den übergebenen Kontext auf.
 * Kein Treffer und `dateStr` liegt vor `user.hireDate` → `null` (D4-Ausnahme, bestehendes
 * Verhalten: 0 Sollstunden vor Eintrittsdatum). Kein Treffer sonst → Log + `MissingWorkPeriodError`,
 * KEIN Rückfall auf `user.weeklyHours`/`user.workSchedule`.
 */
function resolvePeriodForDate(
  user: TargetHoursUser,
  dateStr: string,
  periods: WorkPeriodContext
): UserWorkPeriod | null {
  const period = periods.resolve(user.id, dateStr);
  if (period) {
    return period;
  }

  if (
    typeof user.hireDate === 'string' &&
    HIRE_DATE_FORMAT.test(user.hireDate) &&
    dateStr < user.hireDate
  ) {
    return null;
  }

  logger.error(
    { userId: user.id, date: dateStr },
    'Keine Arbeitszeitperiode gefunden — D4: kein Rückfall auf users.weeklyHours/workSchedule'
  );
  throw new MissingWorkPeriodError(user.id, dateStr);
}

/**
 * Working Days Utility Functions
 * Accurate calculation of working days and target hours
 * Supports flexible work schedules (individueller Wochenplan)
 */

/**
 * Day name mapping (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
const DAY_NAMES: Record<number, DayName> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * WR-01: EINE Quelle für den Wochentag innerhalb von `getDailyTargetHours()`.
 *
 * Vorher gab es in dieser einen Funktion drei Datumsauffassungen nebeneinander:
 * `dateStr` über `formatDateBerlin()` (Europe/Berlin — Grundlage für Feiertagsabfrage und
 * Periodenauflösung), der Wochenplan-Zweig über `getDayName(date)` (für Zeichenketten
 * `getUTCDay()`, für Date-Objekte `getDay()` in der PROZESS-Zeitzone) und die
 * Wochenendprüfung des Fallback-Zweigs über `new Date(date).getDay()`. Unter
 * `TZ=Europe/Berlin` fallen alle drei zusammen, deshalb fiel es nicht auf. Weicht die
 * Prozess-Zeitzone ab — lokale Entwicklung, ein CI-Runner ohne `TZ`, ein PM2-Neustart ohne
 * Environment — divergieren sie: Ein Nutzer MIT Wochenplan würde nach UTC eingeordnet, ein
 * Nutzer OHNE Wochenplan nach lokaler Zeit, die Feiertagsabfrage nach Berlin. Derselbe
 * Kalendertag könnte für zwei Nutzer auf zwei verschiedene Wochentage fallen.
 *
 * Diese Funktion leitet den Wochentag ausschließlich aus der bereits gebildeten
 * `YYYY-MM-DD`-Zeichenkette ab: `Date.UTC()` + `getUTCDay()` ist frei von Zeitzone und
 * Sommerzeit, weil beide Seiten UTC sind. Kein `toISOString()`, keine Prozess-Zeitzone.
 */
function dayIndexFromDateString(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Get day name from date
 * @param date - Date object or YYYY-MM-DD string
 * @returns Day name (monday, tuesday, ...)
 */
export function getDayName(date: Date | string): DayName {
  // FIX (Bug #4): Use getUTCDay() for string inputs (YYYY-MM-DD parsed as UTC midnight).
  // This prevents DST boundary shifts from returning the wrong weekday.
  if (typeof date === 'string') {
    const d = new Date(date);
    return DAY_NAMES[d.getUTCDay()];
  }
  return DAY_NAMES[date.getDay()];
}

/**
 * Get daily target hours for a specific user and date
 * Uses workSchedule if available, otherwise falls back to weeklyHours/5 —
 * beides aus der Periode, die am übergebenen `date` galt (REQ-23), NICHT aus dem heutigen
 * Stammdatensatz.
 *
 * CRITICAL: Holidays always return 0h target! (Feiertag = Arbeitsfrei) — VOR der
 * Periodenauflösung geprüft, unverändert seit vor diesem Umbau.
 *
 * @param user - User object (liefert nur noch `id` und `hireDate` für diese Funktion —
 *   `weeklyHours`/`workSchedule` werden NICHT mehr gelesen, s. D3/D4)
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @param periods - Perioden-Kontext (D3, PFLICHTPARAMETER OHNE VORGABEWERT): löst die am
 *   `date` gültige Arbeitszeitperiode auf. Explizit übergeben statt intern geholt, damit ein
 *   versteckter Datenbankzugriff in dieser Utility-Funktion — die in Tagesschleifen über ein
 *   ganzes Jahr läuft — nicht unbemerkt bleibt. In Tagesschleifen `createWorkPeriodContext()`
 *   (vorladend, D1/D2) übergeben, bei Einzelabfragen `directWorkPeriodLookup`
 *   (`workPeriodContext.ts`).
 * @returns Target hours for this specific day (0-24)
 * @throws {MissingWorkPeriodError} Wenn für `date` keine Periode aufgelöst werden kann und
 *   `date` NICHT vor `user.hireDate` liegt (D4) — kein stiller Rückfall auf
 *   `user.weeklyHours`/`user.workSchedule`. Daten vor `hireDate` liefern weiterhin 0 (D4-
 *   Ausnahme, bestehendes Verhalten).
 *
 * @example
 * // Holiday check (FIRST!)
 * getDailyTargetHours(user, "2026-01-01", periods) // Neujahr → 0h
 *
 * // User mit periodenspezifischem workSchedule: Mo=8h, Fr=2h
 * getDailyTargetHours(hans, "2025-02-07", periods) // Friday → 2h
 * getDailyTargetHours(hans, "2025-02-03", periods) // Monday → 8h
 *
 * // User WITHOUT workSchedule (40h week in dieser Periode)
 * getDailyTargetHours(user, "2025-02-03", periods) // → 8h (40/5)
 */
export function getDailyTargetHours(
  user: TargetHoursUser,
  date: Date | string,
  periods: WorkPeriodContext
): number {
  // CRITICAL: Check for holidays FIRST! (Feiertag = 0h Soll-Arbeitszeit)
  // FIX: Use formatDateBerlin() instead of toISOString() to respect Europe/Berlin timezone
  const dateStr = typeof date === 'string' ? date : formatDateBerlin(date, 'yyyy-MM-dd');
  // WR-01: Der Wochentag kommt ab hier ausschließlich aus `dateStr` — derselben
  // Zeichenkette, die auch Feiertagsabfrage und Periodenauflösung benutzen.
  const dayIndex = dayIndexFromDateString(dateStr);
  const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);

  if (holiday) {
    return 0;
  }

  const period = resolvePeriodForDate(user, dateStr, periods);

  // D4-Ausnahme: kein Periodentreffer, aber dateStr liegt vor hireDate → 0, kein Fehler
  if (!period) {
    return 0;
  }

  // If period has individual work schedule, use it
  if (period.workSchedule) {
    // WR-01: dayIndex statt getDayName(date) — getDayName() liest für Date-Objekte die
    // Prozess-Zeitzone und wich damit von `dateStr` ab, sobald TZ nicht Europe/Berlin ist.
    const dayName = DAY_NAMES[dayIndex];
    return period.workSchedule[dayName] || 0;
  }

  // Fallback: Standard 5-day week (weeklyHours / 5)
  // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0h per day
  if (period.weeklyHours === 0) {
    return 0;
  }

  // CRITICAL: Check for weekends! (Sa/So = 0h for standard 5-day week)
  // WR-01: derselbe dayIndex wie im Wochenplan-Zweig oben — vorher stand hier ein
  // eigenes `new Date(date).getDay()` in der Prozess-Zeitzone.
  if (dayIndex === 0 || dayIndex === 6) {
    // Sunday or Saturday = no target hours for standard workers
    return 0;
  }

  return Math.round((period.weeklyHours / 5) * 100) / 100;
}

/**
 * Calculate total hours for an absence period (vacation, sick, overtime_comp)
 * Respects workSchedule, holidays, and weekends
 *
 * CRITICAL: Used for overtime_comp validation and transaction recording!
 *
 * ZWEITE, EIGENSTÄNDIGE KOPIE DER SOLLSTUNDEN-REGEL (bewusst, s. Grenze unten): Diese Funktion
 * überspringt Samstag/Sonntag IMMER, unabhängig vom Wochenplan. `getDailyTargetHours` liefert
 * für einen Nutzer mit Wochenendstunden im Wochenplan an Samstag/Sonntag hingegen Stunden. Eine
 * Zusammenführung beider Funktionen würde für solche Nutzer Zahlen bewegen und damit die
 * Nullwirkung (D5, Plan 11-04) verletzen. Auf der Arbeitskopie aus `11-AUSGANGSZUSTAND.md`
 * Punkt (e) haben 0 von 20 Nutzern `workSchedule.saturday > 0` oder `workSchedule.sunday > 0` —
 * die Zusammenführung bewegt heute keine Zahl, bleibt aber ausdrücklich Phase 14
 * (Testabdeckung) vorbehalten und wird HIER NICHT vorgezogen.
 *
 * @param user - Nutzer (liefert `id` und `hireDate` für die Periodenauflösung je Tag, D3/D4)
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param periods - Perioden-Kontext (D3, PFLICHTPARAMETER OHNE VORGABEWERT) — löst für jeden Tag
 *   der Schleife die an diesem Tag gültige Periode auf, statt `workSchedule`/`weeklyHours` als
 *   feste Parameter für den gesamten Zeitraum zu benutzen.
 * @returns Total hours for the absence period
 * @throws {MissingWorkPeriodError} Wie `getDailyTargetHours` (D4) — außer für Tage vor
 *   `user.hireDate`, die 0 beitragen statt zu werfen.
 *
 * @example
 * // User with workSchedule: Fr=2h
 * calculateAbsenceHoursWithWorkSchedule(user, '2026-01-02', '2026-01-02', periods)
 * // → 2h (Friday only)
 *
 * // User without workSchedule: 40h/week
 * calculateAbsenceHoursWithWorkSchedule(user, '2026-01-06', '2026-01-10', periods)
 * // → 40h (5 days × 8h)
 */
// CR-01 (Code-Review Phase 14.1): Der Parametertyp war `UserPublic`, obwohl die Funktion vom
// Nutzerobjekt ausschliesslich `id` und `hireDate` liest — beides ueber `resolvePeriodForDate()`,
// dessen eigene Signatur bereits `TargetHoursUser` lautet. Wochenplan und Wochenstunden kommen
// aus der aufgeloesten PERIODE, nicht aus dem Nutzerobjekt (D4).
//
// Die Weitung ist eine ERWEITERUNG, keine Einengung — dieselbe Begruendung, aus der
// `getDailyTargetHours()` weiter oben in dieser Datei schon `TargetHoursUser` nimmt: jedes
// vollstaendige `UserPublic` erfuellt `TargetHoursUser` weiterhin, kein bestehender Aufrufer
// muss geaendert werden. Gebraucht wird sie von
// `overtimeTransactionService.getCommittedFutureCompensationHours()`, das den Nutzer mit einer
// eigenen Abfrage laedt: Ein Import von `userService` waere dort ein Modulzyklus
// (userService importiert `getOvertimeBalance` aus overtimeTransactionService), und ein
// zusammengesetztes Schein-`UserPublic` waere ein Cast auf Felder, die nie gelesen werden.
export function calculateAbsenceHoursWithWorkSchedule(
  user: TargetHoursUser,
  startDate: string,
  endDate: string,
  periods: WorkPeriodContext
): number {
  let totalHours = 0;
  // WR-01: Der Schleifenzeiger stand vorher als `new Date(startDate + 'T12:00:00')` in der
  // PROZESS-Zeitzone, während der Tagesschlüssel eine Zeile weiter unten über
  // `formatDateBerlin()` gebildet wurde. Damit lief die Schleife über andere Tage, als sie
  // auswertete, sobald Prozess- und Berliner Zeit auf verschiedene Kalendertage fielen —
  // gemessen unter `TZ=Pacific/Kiritimati` (UTC+14): Der Zeitraum verschob sich um einen
  // ganzen Tag, und ein Nutzer bekam 40 statt 36 Stunden gutgeschrieben.
  //
  // Jetzt ist der Zeiger UTC-Mittag und der Schlüssel wird mit UTC-Gettern gebildet: eine
  // Zeitauffassung für Zeiger, Datumsschlüssel und Wochentag. Mittag statt Mitternacht
  // bleibt als Sicherheitsabstand gegen Sommerzeitsprünge erhalten (bestehendes Muster).
  // Für `TZ=Europe/Berlin` und `TZ=UTC` — die beiden Zeitzonen, in denen dieses System
  // tatsächlich läuft — liefert die Umstellung Zeichen für Zeichen dieselben Tage; unten
  // in `11-REVIEW-FIX.md` gegen die Arbeitskopie nachgemessen.
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0));

  // Iterate through each day in the range
  for (
    let d = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0));
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dateStr = formatDateUtc(d);
    // WR-01 (Code-Review Phase 11, Durchlauf 2): Hier stand `const dayOfWeek = d.getDay()`
    // — der Wochentag kam damit aus der PROZESS-Zeitzone, während `dateStr` eine Zeile
    // darüber aus Europe/Berlin gebildet wird. Datum (Feiertagsabfrage, Periodenauflösung)
    // und Wochentag (Wochenendfilter, `period.workSchedule[dayName]`) stammten aus zwei
    // verschiedenen Zeitauffassungen. Das ist exakt dieselbe Fehlerklasse, die WR-01 aus
    // Durchlauf 1 in `getDailyTargetHours()` beseitigt hat (Begründung dort ausführlich,
    // Auslöserlage: PM2-Neustart ohne `TZ=Europe/Berlin`), und die Funktion ist kein
    // Randweg — sie bestimmt die Stundenzahl jeder genehmigten Abwesenheit und jeder
    // overtime_comp-Abbuchung (`absenceService.ts:846`, `:920`).
    //
    // Gleiche Lösung, gleiche Hilfsfunktion: Der Wochentag wird ausschließlich aus
    // `dateStr` abgeleitet — eine Quelle für Datum und Wochentag.
    const dayOfWeek = dayIndexFromDateString(dateStr);
    const dayName = DAY_NAMES[dayOfWeek];

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    // Check for holiday (Feiertag = 0h)
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) {
      continue;
    }

    const period = resolvePeriodForDate(user, dateStr, periods);
    if (!period) {
      // D4-Ausnahme: dateStr vor user.hireDate → 0 Stunden für diesen Tag, kein Fehler
      continue;
    }

    // Calculate hours for this day
    if (period.workSchedule) {
      totalHours += period.workSchedule[dayName] || 0;
    } else {
      // Fallback: weeklyHours / 5
      totalHours += Math.round((period.weeklyHours / 5) * 100) / 100;
    }
  }

  return Math.round(totalHours * 100) / 100;
}

/**
 * Calculate number of working days (Monday-Friday) in a month
 * Excludes weekends (Saturday, Sunday)
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Number of working days
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const date = new Date(year, month - 1, 1); // month is 1-indexed
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate daily target hours from weekly hours
 * Standard: weeklyHours / 5 (5-day work week)
 *
 * @param weeklyHours - Target weekly hours
 * @returns Daily target hours
 */
export function calculateDailyTargetHours(weeklyHours: number): number {
  return Math.round((weeklyHours / 5) * 100) / 100;
}

/**
 * Calculate monthly target hours based on actual working days
 * More accurate than using averages (weeklyHours * 4.33)
 *
 * Formula: (weeklyHours / 5) * workingDaysInMonth
 *
 * Example:
 * - 40h week = 8h/day
 * - Januar 2025 has 23 working days
 * - Target = 8h * 23 = 184h
 *
 * @param weeklyHours - Target weekly hours
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Monthly target hours
 */
export function calculateMonthlyTargetHours(weeklyHours: number, year: number, month: number): number {
  const workingDays = getWorkingDaysInMonth(year, month);
  const dailyHours = weeklyHours / 5; // 5-day work week
  return Math.round((dailyHours * workingDays) * 100) / 100;
}

/**
 * Get all public holidays for a given year from database
 * Returns array of holiday dates in 'YYYY-MM-DD' format
 *
 * @param year - Year to fetch holidays for
 * @param dbInstance - Optional database instance (defaults to shared connection).
 *   WR-09: vorher `any` — damit war JEDE Übergabe typkorrekt, auch eine falsche
 *   Verbindung. Genau diese Fehlerklasse steckte hinter CR-03 (zwei Datenbanken in einem
 *   Prüflauf). `BetterSqlite3.Database` lässt den Compiler das ausschließen.
 */
function getPublicHolidays(year: number, dbInstance?: BetterSqlite3.Database): string[] {
  try {
    const database = dbInstance || db;

    const holidays = database
      .prepare('SELECT date FROM holidays WHERE date LIKE ? ORDER BY date')
      .all(`${year}-%`) as Array<{ date: string }>;

    return holidays.map(h => h.date);
  } catch (error) {
    // WR-05 (Code-Review Phase 11, Durchlauf 2): Hier stand
    // `console.error(...); return [];` — zwei Mängel in vier Zeilen.
    //
    // 1. STILLER RÜCKFALL: Ein leeres Array ist von "dieses Jahr hat keine Feiertage"
    //    nicht zu unterscheiden. `countWorkingDaysBetween()` und
    //    `countWorkingDaysForUser()` zählten danach jeden Feiertag als vollen Arbeitstag
    //    und hoben die Sollstunden für den gesamten betroffenen Zeitraum an — ohne dass
    //    irgendwo eine Zahl auffällig geworden wäre. Eine ausbleibende Antwort ist hier
    //    besser als eine falsche: Der Fehler wird jetzt weitergeworfen.
    // 2. `console.error` in einem aktiven Servicepfad umgeht Loglevel, Redaktion und
    //    strukturierte Felder und ist in `.claude/CLAUDE.md` unter "VERBOTE → Code
    //    Quality" untersagt. Dies war die letzte solche Stelle in dieser Datei.
    logger.error({ err: error, year }, '❌ Feiertagsabfrage fehlgeschlagen');
    throw error;
  }
}

/**
 * Check if a date is a public holiday
 *
 * WR-01 (Code-Review Phase 11, Durchlauf 2): Der Datumsschlüssel wird jetzt über die
 * UTC-Getter gebildet, passend zur UTC-Konstruktion der beiden einzigen Aufrufer.
 *
 * WARUM: `countWorkingDaysBetween()` (Zeile 438) und `countWorkingDaysForUser()`
 * (Zeile 619) bauen ihre Tagesobjekte ausdrücklich als UTC-Mitternacht
 * (`new Date(Date.UTC(...))`, Kommentar dort: "Use UTC dates to avoid DST issues") und
 * lesen den Wochentag konsequent mit `getUTCDay()`. Der Feiertagsschlüssel dagegen kam
 * über das lokale `formatDate()` — also aus der PROZESS-Zeitzone. Unter einer Zeitzone
 * mit negativem Versatz (z. B. `TZ=America/New_York`, oder schlicht kein `TZ` auf einem
 * Server außerhalb Europas) liefert `new Date(Date.UTC(2026, 0, 1)).getFullYear()/
 * getMonth()/getDate()` den 31.12.2025: Der Feiertagsvergleich liegt einen Tag daneben,
 * Neujahr wird als Arbeitstag gezählt und die Sollstunden steigen.
 *
 * Dieselbe Fehlerklasse wie die Wochentagsquelle in `getDailyTargetHours()` und
 * `calculateAbsenceHoursWithWorkSchedule()`: eine Zeitauffassung pro Rechnung, nicht zwei.
 */
function isPublicHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateUtc(date);
  return holidays.includes(dateStr);
}

/**
 * Format a UTC-constructed date to its 'YYYY-MM-DD' key.
 *
 * WR-01: Vorher hieß diese Funktion `formatDate()` und benutzte die LOKALEN Getter
 * (`getFullYear`/`getMonth`/`getDate`). Der neue Name macht die Zeitauffassung an jeder
 * Aufrufstelle sichtbar — und verhindert eine Verwechslung mit `formatDate()` aus
 * `utils/timezone.ts`, das absichtlich Europe/Berlin abbildet.
 *
 * Nur für `Date`-Objekte gedacht, die als UTC-Mitternacht konstruiert wurden. Für alles
 * andere ist `formatDateBerlin()` (Import oben) die richtige Wahl.
 */
function formatDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Count working days between two dates (inclusive)
 * Excludes weekends (Sat/Sun) and public holidays
 *
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @param dbInstance - Optional database instance (defaults to shared connection)
 * @returns Number of working days
 */
// WR-09: `dbInstance?: any` -> konkreter Verbindungstyp, s. getPublicHolidays().
export function countWorkingDaysBetween(
  fromDate: string | Date,
  toDate: string | Date,
  dbInstance?: BetterSqlite3.Database
): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  // Get all holidays for the relevant years
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getPublicHolidays(year, dbInstance));
  }

  let workingDays = 0;

  // CRITICAL: Use UTC dates to avoid DST issues (timezone changes can skip days!)
  // Create UTC dates at midnight
  // NOTE: Use LOCAL get*() methods when input dates are Berlin time (from parseDate())
  // Use UTC getUTC*() methods only when input dates are ISO strings parsed as UTC
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let time = startUTC; time <= endUTC; time += MS_PER_DAY) {
    const current = new Date(time);
    const dayOfWeek = current.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const isHoliday = isPublicHoliday(current, holidays);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate target hours for a date range using individual work schedule
 * Iterates through each day and sums getDailyTargetHours()
 *
 * @param user - User object (liefert `id`/`hireDate` für die Periodenauflösung, D3/D4)
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @param periods - Perioden-Kontext (D3, PFLICHTPARAMETER OHNE VORGABEWERT) — wird unverändert
 *   an `getDailyTargetHours` durchgereicht.
 * @returns Total target hours for the period
 *
 * @example
 * // Hans: Mo=8h, Fr=2h, Woche vom 03.02.-07.02.2025 (Mo-Fr)
 * calculateTargetHoursForPeriod(hans, "2025-02-03", "2025-02-07", periods)
 * // → Mo 8h + Di 0h + Mi 0h + Do 0h + Fr 2h = 10h
 */
export function calculateTargetHoursForPeriod(
  user: UserPublic,
  fromDate: string | Date,
  toDate: string | Date,
  periods: WorkPeriodContext
): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  let totalHours = 0;

  // Iterate through each day
  // REQ-17: Kein eigener Wochenend-/Feiertagsfilter mehr — getDailyTargetHours entscheidet
  // selbst über Wochenende, Feiertag und Wochenplan und liefert für diese Tage 0.
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalHours += getDailyTargetHours(user, d, periods);
  }

  return Math.round(totalHours * 100) / 100;
}

/**
 * Calculate target hours from a start date up to today (inclusive)
 * Counts only working days (Mo-Fr, excluding public holidays)
 *
 * @param weeklyHours - Target weekly hours (e.g., 40)
 * @param fromDate - Start date (e.g., hire date) in 'YYYY-MM-DD' format
 * @returns Target hours from start date to today
 */
export function calculateTargetHoursUntilToday(weeklyHours: number, fromDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  // If start date is in the future, return 0
  if (start > today) {
    return 0;
  }

  const workingDays = countWorkingDaysBetween(start, today);
  const dailyHours = weeklyHours / 5; // 5-day work week

  return Math.round((dailyHours * workingDays) * 100) / 100;
}

/**
 * Calculate how many working days per week a user has based on their work schedule
 *
 * Best Practice (Personio, DATEV, SAP):
 * - Days with 0 hours do NOT count as working days
 * - Only days with hours > 0 count as working days
 *
 * @param workSchedule - User's individual work schedule (or null)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @returns Number of working days per week (0-7)
 *
 * @example
 * // User with Mo=8h, Di=0h, Mi=6h, Do=8h, Fr=8h
 * calculateWorkingDaysPerWeek(workSchedule, 30)
 * // → 4 working days (Di is NOT counted)
 *
 * @example
 * // User WITHOUT workSchedule, 40h week
 * calculateWorkingDaysPerWeek(null, 40)
 * // → 5 working days (standard Mo-Fr)
 */
export function calculateWorkingDaysPerWeek(
  workSchedule: Record<DayName, number> | null | undefined,
  weeklyHours: number
): number {
  // If user has individual work schedule, count days with hours > 0
  if (workSchedule) {
    let workingDays = 0;

    // Check each day of the week
    const allDays: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of allDays) {
      if ((workSchedule[day] || 0) > 0) {
        workingDays++;
      }
    }

    return workingDays;
  }

  // Fallback: Standard 5-day work week (Mo-Fr)
  // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0 working days
  if (weeklyHours === 0) {
    return 0;
  }

  return 5; // Standard Mo-Fr
}

/**
 * Count working days for a specific user in a date range
 * Takes into account the user's individual work schedule
 *
 * Best Practice (Personio, DATEV, SAP):
 * - Days with 0 hours in work schedule do NOT count as working days
 * - Weekends only count if user has hours scheduled
 * - Public holidays are excluded
 *
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @param workSchedule - User's individual work schedule (or null)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @param dbInstance - Optional database instance (for holiday lookup)
 * @returns Number of working days for this specific user
 *
 * @example
 * // User with Mo=8h, Di=0h, Mi=6h, Do=8h, Fr=8h
 * // Date range: Mo 13.01. - Fr 17.01.2025 (5 calendar days)
 * countWorkingDaysForUser("2025-01-13", "2025-01-17", workSchedule, 30)
 * // → 4 working days (Di is NOT counted because 0h)
 *
 * @example
 * // User WITHOUT workSchedule, 40h week
 * // Date range: Mo 13.01. - Fr 17.01.2025 (no holidays)
 * countWorkingDaysForUser("2025-01-13", "2025-01-17", null, 40)
 * // → 5 working days (standard Mo-Fr counting)
 */
export function countWorkingDaysForUser(
  fromDate: string | Date,
  toDate: string | Date,
  workSchedule: Record<DayName, number> | null | undefined,
  weeklyHours: number,
  // WR-09: `any` -> konkreter Verbindungstyp, s. getPublicHolidays().
  dbInstance?: BetterSqlite3.Database
): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  // Get all holidays for the relevant years
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getPublicHolidays(year, dbInstance));
  }

  let workingDays = 0;

  // CRITICAL: Use UTC dates to avoid DST issues
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let time = startUTC; time <= endUTC; time += MS_PER_DAY) {
    const current = new Date(time);
    const dayOfWeek = current.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const isHoliday = isPublicHoliday(current, holidays);

    // Skip public holidays
    if (isHoliday) {
      continue;
    }

    // If user has individual work schedule, check if this day has hours > 0
    if (workSchedule) {
      const hoursForDay = workSchedule[dayName] || 0;
      if (hoursForDay > 0) {
        workingDays++;
      }
      // Days with 0 hours do NOT count as working days!
    } else {
      // Fallback: Standard Mo-Fr counting (exclude weekends)
      // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0 working days
      if (weeklyHours === 0) {
        continue;
      }

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!isWeekend) {
        workingDays++;
      }
    }
  }

  return workingDays;
}
