/**
 * Work Period Service — Arbeitszeit-Perioden lesen, schreiben, zum Datum auflösen
 *
 * WARUM: `users.weeklyHours`/`users.workSchedule` sind flache Felder ohne Historie
 * (D4, Phase 10 lässt sie unangetastet). `user_work_periods` (Migration 008) trägt
 * dieselben Werte versioniert mit einem halboffenen Gültigkeitsintervall
 * `[validFrom, validTo)` (D1): `validFrom` inklusiv, `validTo` exklusiv, `validTo = NULL`
 * heißt laufende Periode.
 *
 * DIE EINE AUFLÖSUNGSSTELLE: `resolveWorkPeriodIn()` ist im gesamten Projekt die einzige
 * Stelle, an der eine Periode zu einem Datum aufgelöst wird — eine reine, datenbankfreie
 * Funktion auf einer bereits geladenen Periodenliste. `resolveWorkPeriodAt()` ist ihr
 * Datenbank-Vorspann: lädt die Perioden eines Nutzers und delegiert sofort an
 * `resolveWorkPeriodIn()`. Seit Plan 11-02 gibt es damit auch keine SQL-Kopie der
 * Intervallbedingung mehr — vorher stand `validFrom <= ? AND (validTo IS NULL OR validTo > ?)`
 * sowohl hier als auch (nach D1, Phase 11) im vorladenden Kontext-Cache. Die Lehre aus
 * Phase 9 (`09-INVENTAR-KREDITIERUNG.md`) war, dass dieselbe fachliche Regel in zwölf Kopien
 * existierte, vier davon aktiv und untereinander abweichend. Kein Skript, kein Test und
 * kein späterer Aufrufer (Phase 11) baut eine zweite Auflösung — jeder ruft `resolveWorkPeriodIn`
 * (direkt oder über `resolveWorkPeriodAt`/`workPeriodContext.ts`, Plan 11-02).
 *
 * ZEITZONENFREIHEIT IST STRUKTURELL, NICHT DISZIPLIN: Das Konstruieren eines Date-Objekts
 * aus der Zeichenkette '2026-08-01' liest als UTC-Mitternacht, also 02:00 Berliner
 * Sommerzeit, und verschluckte dadurch systematisch den letzten Kalendertag jedes Monats
 * (Phase 9). Dieser Service betreibt deshalb gar keine Datumsarithmetik. `YYYY-MM-DD` ist als ISO-Zeichenkette lexikografisch exakt so
 * sortiert wie chronologisch — ein reiner Zeichenkettenvergleich (auch in SQL auf TEXT-
 * Spalten) ist deshalb korrekt und zeitzonenfrei, solange jeder Aufrufer sein Datum bereits
 * als `YYYY-MM-DD` bildet, wie es `formatDateBerlin(date, 'yyyy-MM-dd')`
 * (`server/src/utils/timezone.ts`) im Projekt tut. Kein Date-Konstruktor, keine
 * ISO-String-Konvertierung über die Date-Klasse, kein SQL `date()`/`strftime()` in diesem
 * Modul (grep-Kriterium des Plans).
 *
 * GRENZE ZUM DATENBANKRIEGEL (D3): `checkPeriodChain()` liest die Perioden und meldet
 * Überlappungen/Lücken im Klartext. Das ist ausdrücklich KEIN Ersatz für die Trigger aus
 * Migration 008 — die bessere Fehlermeldung liefert der Service, der Riegel bleibt die
 * Datenbank.
 *
 * GRENZE DIESES PLANS: `closeWorkPeriod()` + `createWorkPeriod()` sind der Zweischritt für
 * einen Stichtagswechsel. Die Aneinanderreihung beider Schritte zu einem einzigen, ggf.
 * transaktional geklammerten Vorgang gehört NICHT in Phase 10 — das ist Phase 12.
 *
 * SEIT PHASE 11 IST DIESER SERVICE DIE RECHENGRUNDLAGE (D4, REQ-23; WR-15).
 *
 * Bis einschließlich Phase 10 stand hier: "KEIN AUFRUFER IN PHASE 10 …
 * `users.weeklyHours`/`users.workSchedule` bleiben bis Phase 11 die gelesene Quelle für
 * die Berechnung." Genau diese Regel hat Phase 11 abgelöst — die Aussage war seit Plan
 * 11-04 falsch und damit die erste irreführende Quelle für jede spätere Untersuchung.
 *
 * Stand heute: `getDailyTargetHours()` und `calculateAbsenceHoursWithWorkSchedule()`
 * (`workingDays.ts`) lösen die Sollstunden AUSSCHLIESSLICH über die hier verwaltete
 * Periode auf, erreichbar über `workPeriodContext.ts` (vorladender Cache bzw.
 * `directWorkPeriodLookup`). `users.weeklyHours`/`users.workSchedule` bleiben als flache
 * Felder bestehen (Phase 11 entfernt sie ausdrücklich nicht) und werden von
 * `userService.updateUser()` in die offene Periode gespiegelt — sie sind aber nicht mehr
 * die gelesene Quelle der Berechnung. Die vollständige Aufruferliste steht in
 * `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md`.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul
 * (Muster aus `vacationTransactionService.ts:1-29`).
 *
 * Kontext: .planning/phases/10-perioden-fundament/10-CONTEXT.md (D1–D7),
 * .planning/phases/10-perioden-fundament/10-04-PLAN.md
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { isRealCalendarDate } from '../utils/validation.js';
import { getTodayString } from '../utils/timezone.js';
import type {
  UserWorkPeriod,
  UserWorkPeriodRow,
  UserWorkPeriodListItem,
  WorkSchedule,
  DayName,
} from '../types/index.js';

const WEEKDAY_KEYS: readonly DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const SELECT_COLUMNS = `
  id, userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy, deletedAt, deletedBy
`;

/**
 * Eigene Fehlerklasse für Datenbankriegel-Verstöße (Überlappung, Lücke, doppelte offene
 * Periode). `createWorkPeriod`/`closeWorkPeriod` fangen den `SqliteError` der Trigger und
 * CHECK-Constraints aus Migration 008 ab und werfen ihn hierüber mit einer verständlichen
 * deutschen Meldung weiter; die ursprüngliche Meldung bleibt als `cause` erhalten.
 */
export class WorkPeriodConflictError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkPeriodConflictError';
  }
}

/**
 * Eigene Fehlerklasse für den Verstoß gegen die Nutzungsbedingung des aussetzbaren
 * Kettenriegels (B-2, Sicherheitsprüfung Phase 13; T-13-02).
 *
 * Ein benannter Fehler statt eines nackten `Error`, damit ein Test die Regel gezielt belegen
 * kann und ein Aufrufer sie nicht versehentlich mit einer fachlichen Ablehnung verwechselt:
 * Dies ist kein Eingabefehler eines Nutzers, sondern ein Programmierfehler im Aufrufpfad.
 * Er gehört deshalb ausdrücklich NICHT in `translateWorkPeriodError()` und wird nicht in eine
 * freundliche 409-Meldung übersetzt.
 */
export class ChainGuardOutsideTransactionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ChainGuardOutsideTransactionError';
  }
}

/**
 * Trägerobjekt für die Startmeldung, wenn beim Hochfahren ein aus einem früheren Lauf
 * hängengebliebener ausgesetzter Kettenriegel gefunden und zurückgesetzt wurde (B-2).
 *
 * Warum ein `Error` und keine reine Textzeile: `logger.warn({ err }, …)` läuft dadurch durch
 * den pino-Fehler-Serializer und bekommt einen Stacktrace, der die Startsequenz benennt —
 * ohne den steht im Log nur, DASS etwas war, nicht wo. Geworfen wird das Objekt nie; der
 * Server startet nach der Rücksetzung normal weiter.
 */
export class StaleChainGuardSuspensionError extends Error {
  constructor() {
    super(
      'work_period_chain_guard.suspended stand beim Serverstart auf 1. Der Kettenriegel aus ' +
        'Migration 013 war damit ausgesetzt: die vier aussetzbaren Trigger-Klauseln auf ' +
        'user_work_periods haben nichts geprüft. Ursache ist ein früherer Lauf, der die ' +
        'Aussetzung außerhalb einer Transaktionsklammer vorgenommen hat oder zwischen ' +
        'Aussetzung und Rücksetzung abgebrochen ist. Der Wert wurde auf 0 zurückgesetzt; die ' +
        'in diesem Fenster geschriebenen Perioden sollten über checkPeriodChain() geprüft werden.'
    );
    this.name = 'StaleChainGuardSuspensionError';
  }
}

/**
 * Prüft, dass ein übergebener Wert eine Zeichenkette im Format YYYY-MM-DD **und ein echtes
 * Kalenderdatum** ist. Läuft zur Laufzeit auch gegen Werte, die die TypeScript-Signatur
 * eigentlich schon ausschließt (ein `Date`-Objekt oder ein anders formatierter String), weil
 * ein Aufrufer diese Prüfung nicht per Typsystem umgehen können soll.
 *
 * CR-03 (Code-Review Phase 12): Vorher genügte `/^\d{4}-\d{2}-\d{2}$/`. `2026-02-31`,
 * `2026-13-45` und `0000-00-00` bestanden diese Prüfung und wurden unverändert in
 * `user_work_periods` geschrieben. Danach ist jede lexikografische Datumsvergleichslogik
 * (`resolveWorkPeriodIn`, `checkPeriodChain`, die Trigger aus Migration 008) für diesen
 * Nutzer dauerhaft verzerrt — `'2026-13-45'` sortiert hinter jedes echte Datum des Jahres.
 * `isRealCalendarDate()` prüft die Monatslänge inklusive Schaltjahr, weiterhin ohne
 * Zeitzonenbezug.
 */
function assertDateFormat(value: unknown, paramName: string): asserts value is string {
  if (!isRealCalendarDate(value)) {
    throw new Error(
      `${paramName} muss ein gültiges Kalenderdatum im Format YYYY-MM-DD sein, erhalten: ` +
      `${describeUnknown(value)}`
    );
  }
}

function describeUnknown(value: unknown): string {
  if (value instanceof Date) {
    return `Date-Objekt (${value.toString()})`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Typwächter: prüft, dass alle sieben Wochentagsschlüssel vorhanden und Zahlen sind. Ein
 *  kaputter workSchedule-Text darf nicht als stille 0-Stunden-Woche durchrutschen (T-10-15). */
function isWorkSchedule(value: unknown): value is WorkSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return WEEKDAY_KEYS.every(
    (key) => typeof record[key] === 'number' && Number.isFinite(record[key])
  );
}

function parseWorkSchedule(raw: string | null, periodId: number): WorkSchedule | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Periode ${periodId}: workSchedule ist kein gültiges JSON (${String(err)}).`
    );
  }

  if (!isWorkSchedule(parsed)) {
    throw new Error(
      `Periode ${periodId}: workSchedule ist kein gültiger Wochenplan — erwartet werden ` +
      `sieben numerische Wochentagsschlüssel (${WEEKDAY_KEYS.join(', ')}).`
    );
  }

  return parsed;
}

function rowToWorkPeriod(row: UserWorkPeriodRow): UserWorkPeriod {
  return {
    id: row.id,
    userId: row.userId,
    validFrom: row.validFrom,
    validTo: row.validTo,
    weeklyHours: row.weeklyHours,
    workSchedule: parseWorkSchedule(row.workSchedule, row.id),
    note: row.note,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    deletedAt: row.deletedAt,
    deletedBy: row.deletedBy,
  };
}

/**
 * Übersetzt einen von den Triggern/CHECK-Constraints aus Migration 008 geworfenen
 * `SqliteError` in einen `WorkPeriodConflictError` mit verständlicher deutscher Meldung.
 * Die Erkennung läuft über den Textbestandteil `user_work_periods:`, den jede
 * `RAISE(ABORT, ...)`-Meldung der Trigger trägt. Unbekannte Datenbankfehler werden
 * unverändert durchgereicht statt verschluckt.
 */
function translateWorkPeriodError(err: unknown, context: string): never {
  if (err instanceof Error && err.message.includes('user_work_periods:')) {
    const detail = err.message.includes('Überlappung')
      ? 'Überlappung mit einer bestehenden Periode desselben Nutzers.'
      : err.message.includes('Lücke')
      ? 'Die Periode würde eine Lücke zur bestehenden Periodenkette hinterlassen.'
      : `Die Datenbank hat die Änderung abgelehnt: ${err.message}`;
    throw new WorkPeriodConflictError(`${context}: ${detail}`, { cause: err });
  }
  throw err;
}

/**
 * Alle Perioden eines Nutzers, aufsteigend nach validFrom.
 *
 * PHASE 13 (13-CONTEXT.md D2/D3): `deletedAt IS NULL` nimmt weggenommene Perioden aus dem
 * Sammelpfad heraus. Der `BEFORE DELETE`-Trigger aus Migration 008/013 schützt nur gegen ein
 * echtes `DELETE`-Statement auf dieser Tabelle — er feuert NICHT beim Soft-Delete-Schreibweg
 * dieser Phase (`softDeleteWorkPeriod()`, ein `UPDATE`) und ist deshalb KEIN Ersatz für diesen Filter.
 * `createWorkPeriodContext()` (`workPeriodContext.ts`), `resolveWorkPeriodAt()` und
 * `checkPeriodChain()` laden ausschließlich über diese Funktion — der Filter erreicht damit
 * die gesamte Sollstunden-Berechnung.
 */
export function getWorkPeriods(userId: number): UserWorkPeriod[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE userId = ? AND deletedAt IS NULL ORDER BY validFrom ASC`)
    .all(userId) as UserWorkPeriodRow[];

  return rows.map(rowToWorkPeriod);
}

/**
 * Die offene Periode eines Nutzers (validTo IS NULL). Wegen des partiellen UNIQUE-Index
 * `idx_user_work_periods_one_open` (Migration 008) kann es höchstens eine geben. Liefert die
 * Abfrage dennoch mehrere, ist das ein Datenfehler und keine Auswahlfrage — dann wird
 * geworfen statt eine der beiden Zeilen stillschweigend zu bevorzugen.
 */
export function getCurrentWorkPeriod(userId: number): UserWorkPeriod | null {
  // PHASE 13 (13-CONTEXT.md D2/D3): deletedAt IS NULL — der BEFORE-DELETE-Trigger schützt nur
  // gegen ein echtes DELETE, nicht gegen softDeleteWorkPeriod() (ein UPDATE). Ohne diesen
  // Filter würde eine weggenommene offene Periode weiterhin als "aktuell" gelten.
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE userId = ? AND validTo IS NULL AND deletedAt IS NULL`)
    .all(userId) as UserWorkPeriodRow[];

  if (rows.length === 0) return null;

  if (rows.length > 1) {
    throw new Error(
      `Datenfehler: Nutzer ${userId} hat ${rows.length} offene Arbeitszeitperioden ` +
      `(validTo IS NULL) — der partielle UNIQUE-Index idx_user_work_periods_one_open ` +
      `sollte das verhindern.`
    );
  }

  return rowToWorkPeriod(rows[0]);
}

/**
 * DIE EINE Auflösungsstelle: löst die zu `date` gültige Periode innerhalb einer bereits
 * geladenen Periodenliste auf. Reine Funktion — kein Datenbankzugriff, keine Reihenfolge-
 * Annahme über `periods` hinaus (die Trigger aus Migration 008 garantieren höchstens eine
 * treffende Periode je Datum).
 *
 * Nimmt ausschließlich eine Zeichenkette im Format YYYY-MM-DD entgegen — kein Date-Objekt.
 * Bildet exakt das halboffene Intervall aus D1: `validFrom <= date AND (validTo IS NULL OR
 * validTo > date)`. Kein `new Date`, kein `date()`/`strftime()`-Aufruf: ISO-Datum
 * (`YYYY-MM-DD`) sortiert als Zeichenkette lexikografisch identisch zur chronologischen
 * Ordnung, ein reiner Zeichenkettenvergleich ist daher exakt und zeitzonenfrei. Jeder
 * Aufrufer muss sein Datum bereits als `YYYY-MM-DD` bilden, wie es
 * `formatDateBerlin(date, 'yyyy-MM-dd')` im Projekt tut.
 *
 * Wird von `resolveWorkPeriodAt()` (Datenbank-Vorspann) und ab Plan 11-02 von
 * `workPeriodContext.ts` (vorladender Cache, D1/D2) aufgerufen — beide Aufrufer bauen die
 * Intervall-Bedingung nicht selbst nach.
 */
export function resolveWorkPeriodIn(periods: UserWorkPeriod[], date: string): UserWorkPeriod | null {
  assertDateFormat(date, 'date');

  for (const period of periods) {
    if (period.validFrom <= date && (period.validTo === null || period.validTo > date)) {
      return period;
    }
  }

  return null;
}

/**
 * Datenbank-Vorspann zu `resolveWorkPeriodIn()`: lädt die Perioden eines Nutzers und löst
 * sofort im Speicher auf. Enthält selbst keine Intervall-Logik mehr (Plan 11-02) — die
 * Auswahl passiert ausschließlich in `resolveWorkPeriodIn`.
 */
export function resolveWorkPeriodAt(userId: number, date: string): UserWorkPeriod | null {
  assertDateFormat(date, 'date');

  return resolveWorkPeriodIn(getWorkPeriods(userId), date);
}

export interface CreateWorkPeriodInput {
  userId: number;
  /** Inklusiv, YYYY-MM-DD (D1). */
  validFrom: string;
  /** Exklusiv, YYYY-MM-DD, oder weggelassen/`null` für eine laufende Periode (D1). */
  validTo?: string | null;
  weeklyHours: number;
  /** Pflichtfeld — ausdrückliches `null` statt weglassbar. Verankert D2/REQ-20 in der
   *  Signatur: Es gibt keinen Aufruf, der nur die Wochenstunden ändert und den Tagesplan
   *  stehen lässt. */
  workSchedule: WorkSchedule | null;
  note?: string | null;
  createdBy?: number | null;
}

/**
 * Legt eine neue Periode an. `weeklyHours` und `workSchedule` sind in der Signatur
 * untrennbar (D2/REQ-20). Überlappungen, Lücken und eine zweite offene Periode weist die
 * Datenbank über die Trigger/den partiellen Index aus Migration 008 ab (D3); dieser Service
 * übersetzt den Fehler in einen `WorkPeriodConflictError`.
 */
export function createWorkPeriod(input: CreateWorkPeriodInput): UserWorkPeriod {
  assertDateFormat(input.validFrom, 'validFrom');
  if (input.validTo !== undefined && input.validTo !== null) {
    assertDateFormat(input.validTo, 'validTo');
  }

  const workScheduleJson = input.workSchedule === null ? null : JSON.stringify(input.workSchedule);

  try {
    const result = db
      .prepare(
        `INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule, note, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.validFrom,
        input.validTo ?? null,
        input.weeklyHours,
        workScheduleJson,
        input.note ?? null,
        input.createdBy ?? null
      );

    // Kein deletedAt-Filter nötig: liest die soeben eingefügte, noch nicht gelöschte Zeile zurück.
    const row = db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
      .get(result.lastInsertRowid) as UserWorkPeriodRow;

    return rowToWorkPeriod(row);
  } catch (err) {
    translateWorkPeriodError(err, `Periode für Nutzer ${input.userId} ab ${input.validFrom} konnte nicht angelegt werden`);
  }
}

/**
 * Setzt `validTo` einer bestehenden Periode. Zusammen mit `createWorkPeriod` ist das der
 * Zweischritt, den ein Stichtagswechsel (Phase 12) braucht. Die Aneinanderreihung beider
 * Schritte zu einem Vorgang gehört NICHT in Phase 10.
 */
export function closeWorkPeriod(periodId: number, validTo: string): UserWorkPeriod {
  assertDateFormat(validTo, 'validTo');

  try {
    const result = db
      // WR-12 (Code-Review Phase 13): `AND deletedAt IS NULL`. Ohne diesen Riegel aendert
      // ein Aufruf mit der Id einer WEGGENOMMENEN Periode deren Werte — und umgeht dabei
      // jede Ueberlappungs-/Lueckenpruefung: Migration 013 gibt dem UPDATE-Trigger
      // `NEW.deletedAt IS NULL` als Bedingung mit, er ueberspringt die Zeile also, und
      // `checkPeriodChain()` liest sie ohnehin nicht (`getWorkPeriods()` filtert sie
      // heraus). Die Soft-Delete-Zusage dieses Services stand bisher nur auf den
      // Lesepfaden; der Schreibpfad hat jetzt sein Gegenstueck (Muster:
      // `softDeleteWorkPeriod()`, das den Filter seit jeher traegt).
      .prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ? AND deletedAt IS NULL`)
      .run(validTo, periodId);

    if (result.changes === 0) {
      throw new Error(
        `closeWorkPeriod: Periode ${periodId} existiert nicht oder wurde bereits gelöscht.`
      );
    }
  } catch (err) {
    translateWorkPeriodError(err, `Periode ${periodId} konnte nicht geschlossen werden`);
  }

  // Kein deletedAt-Filter nötig: liest die gerade geschriebene Zeile zurück.
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
    .get(periodId) as UserWorkPeriodRow;

  return rowToWorkPeriod(row);
}

/**
 * Ändert `weeklyHours` und `workSchedule` einer bestehenden Periode — untrennbar in der
 * Signatur, genau wie bei `createWorkPeriod` (D2/REQ-20): Es gibt keinen Aufruf, der nur
 * die Wochenstunden ändert und den Tagesplan stehen lässt.
 *
 * DER EINE SCHREIBWEG (CR-02, Phase 11): Vorher stand dieses UPDATE als rohes SQL in
 * `userService.updateUser()`, und das Seed-Skript hatte gar keinen — es verließ sich auf die
 * idempotente Anlagefunktion und ließ die Periode dadurch auf Altwerten stehen. Beide
 * Aufrufer gehen jetzt hier durch.
 *
 * Verschiebt KEIN Datum: `validFrom`/`validTo` bleiben unangetastet. Ein Stichtagswechsel
 * ist `closeWorkPeriod` + `createWorkPeriod` (Phase 12), nicht diese Funktion.
 */
export function updateWorkPeriodValues(
  periodId: number,
  weeklyHours: number,
  workSchedule: WorkSchedule | null
): UserWorkPeriod {
  try {
    const result = db
      // WR-12 (Code-Review Phase 13): `AND deletedAt IS NULL`. Ohne diesen Riegel aendert
      // ein Aufruf mit der Id einer WEGGENOMMENEN Periode deren Werte — und umgeht dabei
      // jede Ueberlappungs-/Lueckenpruefung: Migration 013 gibt dem UPDATE-Trigger
      // `NEW.deletedAt IS NULL` als Bedingung mit, er ueberspringt die Zeile also, und
      // `checkPeriodChain()` liest sie ohnehin nicht (`getWorkPeriods()` filtert sie
      // heraus). Die Soft-Delete-Zusage dieses Services stand bisher nur auf den
      // Lesepfaden; der Schreibpfad hat jetzt sein Gegenstueck (Muster:
      // `softDeleteWorkPeriod()`, das den Filter seit jeher traegt).
      .prepare(
        `UPDATE user_work_periods SET weeklyHours = ?, workSchedule = ? WHERE id = ? AND deletedAt IS NULL`
      )
      .run(weeklyHours, workSchedule === null ? null : JSON.stringify(workSchedule), periodId);

    if (result.changes === 0) {
      throw new Error(
        `updateWorkPeriodValues: Periode ${periodId} existiert nicht oder wurde bereits gelöscht.`
      );
    }
  } catch (err) {
    translateWorkPeriodError(err, `Werte der Periode ${periodId} konnten nicht geändert werden`);
  }

  // Kein deletedAt-Filter nötig: liest die gerade geschriebene Zeile zurück.
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
    .get(periodId) as UserWorkPeriodRow;

  return rowToWorkPeriod(row);
}

/**
 * Setzt `validFrom` einer bestehenden Periode. Einziger Anwendungsfall (CR-01, Phase 11):
 * Das Eintrittsdatum eines Nutzers wird VORVERLEGT — dann muss die Startperiode nach vorn
 * mitwachsen, sonst entsteht ein Datum zwischen neuem `hireDate` und `validFrom`, für das
 * `resolveWorkPeriodIn()` `null` liefert und `getDailyTargetHours()` per D4 hart wirft.
 *
 * Bewusst KEIN allgemeines "Periode verschieben": Der Aufrufer muss sicherstellen, dass die
 * Kette danach lückenlos bleibt. Die Trigger aus Migration 008
 * (`trg_user_work_periods_update_guard`) weisen Überlappung und Lücke ohnehin ab; dieser
 * Service übersetzt den Fehler wie überall in einen `WorkPeriodConflictError`.
 */
export function setWorkPeriodValidFrom(periodId: number, validFrom: string): UserWorkPeriod {
  assertDateFormat(validFrom, 'validFrom');

  try {
    const result = db
      // WR-12 (Code-Review Phase 13): `AND deletedAt IS NULL`. Ohne diesen Riegel aendert
      // ein Aufruf mit der Id einer WEGGENOMMENEN Periode deren Werte — und umgeht dabei
      // jede Ueberlappungs-/Lueckenpruefung: Migration 013 gibt dem UPDATE-Trigger
      // `NEW.deletedAt IS NULL` als Bedingung mit, er ueberspringt die Zeile also, und
      // `checkPeriodChain()` liest sie ohnehin nicht (`getWorkPeriods()` filtert sie
      // heraus). Die Soft-Delete-Zusage dieses Services stand bisher nur auf den
      // Lesepfaden; der Schreibpfad hat jetzt sein Gegenstueck (Muster:
      // `softDeleteWorkPeriod()`, das den Filter seit jeher traegt).
      .prepare(`UPDATE user_work_periods SET validFrom = ? WHERE id = ? AND deletedAt IS NULL`)
      .run(validFrom, periodId);

    if (result.changes === 0) {
      throw new Error(
        `setWorkPeriodValidFrom: Periode ${periodId} existiert nicht oder wurde bereits gelöscht.`
      );
    }
  } catch (err) {
    translateWorkPeriodError(
      err,
      `Beginn der Periode ${periodId} konnte nicht auf ${validFrom} gesetzt werden`
    );
  }

  // Kein deletedAt-Filter nötig: liest die gerade geschriebene Zeile zurück.
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
    .get(periodId) as UserWorkPeriodRow;

  return rowToWorkPeriod(row);
}

export interface PeriodChainCheckResult {
  ok: boolean;
  findings: string[];
}

/**
 * Zusätzlicher Service-Check aus D3 — meldet Überlappungen, Lücken und mehr als eine offene
 * Periode im Klartext. Das ist AUSDRÜCKLICH KEIN Ersatz für die Trigger aus Migration 008:
 * Er liefert die bessere Fehlermeldung, der Riegel bleibt die Datenbank.
 */
export function checkPeriodChain(userId: number): PeriodChainCheckResult {
  const periods = getWorkPeriods(userId);
  const findings: string[] = [];

  const openPeriods = periods.filter((p) => p.validTo === null);
  if (openPeriods.length > 1) {
    findings.push(
      `${openPeriods.length} offene Perioden (validTo IS NULL) für Nutzer ${userId} — ` +
      `es darf höchstens eine geben.`
    );
  }

  for (let i = 0; i < periods.length - 1; i++) {
    const current = periods[i];
    const next = periods[i + 1];

    if (current.validTo === null) {
      // Eine laufende Periode mitten in der Kette ist bereits über openPeriods gemeldet;
      // ohne definiertes validTo lässt sich keine Lücke/Überlappung zur nächsten Periode
      // bestimmen.
      continue;
    }

    if (current.validTo < next.validFrom) {
      findings.push(
        `Lücke zwischen ${current.validFrom}–${current.validTo} und ${next.validFrom} ` +
        `(userId ${userId}).`
      );
    } else if (current.validTo > next.validFrom) {
      findings.push(
        `Überlappung: Periode bis ${current.validTo} überschneidet sich mit der ` +
        `nächsten ab ${next.validFrom} (userId ${userId}).`
      );
    }
  }

  return { ok: findings.length === 0, findings };
}

export interface PeriodChainIssue {
  userId: number;
  findings: string[];
}

/**
 * WR-03: Sammel-Check über ALLE nicht gelöschten Nutzer.
 *
 * `checkPeriodChain()` arbeitet je Nutzer und hatte bis hierhin keinen Aufrufer über den
 * gesamten Bestand. D4 sagt zu: "eine fehlende Periode muss auffallen" — ohne einen
 * Sammel-Check war das nur die halbe Zusage. Sie fiel auf, aber erst als Ausfall, nämlich
 * wenn ein Admin-Report, eine Aggregat-Statistik oder der DATEV-Export über den defekten
 * Nutzer stolperte. Diese Funktion findet denselben Defekt VORHER.
 *
 * Drei Befundarten, die `checkPeriodChain()` allein nicht liefert:
 * 1. Nutzer GANZ OHNE Periode — `checkPeriodChain()` meldet für eine leere Liste
 *    strukturell `ok: true` (keine Überlappung, keine Lücke zwischen null Perioden),
 *    obwohl genau dieser Nutzer bei jeder Berechnung wirft.
 * 2. Kette beginnt NACH `hireDate` — die Tage dazwischen haben keine Periode; die
 *    D4-Ausnahme greift dort nicht, weil sie nur für Daten VOR `hireDate` gilt.
 * 3. Alles, was `checkPeriodChain()` ohnehin findet (Lücke, Überlappung, zwei offene
 *    Perioden) — unverändert über dieselbe Funktion, keine zweite Kopie der Regel.
 *
 * Liefert nur die auffälligen Nutzer; ein leeres Ergebnis heißt "Bestand in Ordnung".
 *
 * AUFRUFER (WR-02, Durchlauf 2 — bis dahin hatte diese Funktion außerhalb der Tests
 * keinen einzigen, die Zusage oben galt also faktisch nicht):
 *   - `src/scripts/checkPeriodChains.ts` / `npm run check:period-chains` — Exitcode 1 bei
 *     Befunden, für Cron und Pipelines. Nicht gegen die Produktion (Produktionsschutz).
 *   - `GET /api/admin/period-chains` (`src/routes/admin.ts`) — derselbe Check zur Laufzeit
 *     auf der laufenden Verbindung; der Weg, der auch die Produktion abdeckt.
 *   - `src/services/workPeriodService.test.ts` — Regressionsnetz.
 * Ein Aufruf beim Serverstart wurde bewusst NICHT ergänzt; Begründung im Kopf von
 * `checkPeriodChains.ts`.
 */
export function checkAllPeriodChains(): PeriodChainIssue[] {
  const users = db
    .prepare(`SELECT id, hireDate FROM users WHERE deletedAt IS NULL ORDER BY id`)
    .all() as Array<{ id: number; hireDate: string | null }>;

  const issues: PeriodChainIssue[] = [];

  for (const user of users) {
    const findings = [...checkPeriodChain(user.id).findings];
    const periods = getWorkPeriods(user.id);

    if (periods.length === 0) {
      findings.push(
        `Nutzer ${user.id} hat keine einzige Arbeitszeitperiode — jede Sollstunden-` +
        `Berechnung für ihn wirft MissingWorkPeriodError (D4).`
      );
    } else if (
      isRealCalendarDate(user.hireDate) &&
      periods[0].validFrom > user.hireDate
    ) {
      findings.push(
        `Kette beginnt erst am ${periods[0].validFrom}, das Eintrittsdatum ist aber ` +
        `${user.hireDate} (userId ${user.id}) — die Tage dazwischen haben keine Periode.`
      );
    }

    if (findings.length > 0) {
      issues.push({ userId: user.id, findings });
    }
  }

  return issues;
}

/*
 * ============================================================================
 * PHASE 13 — KORRIGIEREN UND RÜCKGÄNGIG MACHEN (13-CONTEXT.md D2/D3, REQ-31)
 * ============================================================================
 * Ab hier: der eine Soft-Delete-Schreibweg, der eine Lückenschluss-Schreibweg (der auch
 * "offen" setzen kann), der aussetzbare Kettenriegel und die um isFirst/isCurrent erweiterte
 * Periodenliste. Alle vier Lesepfade oben (getWorkPeriods, getCurrentWorkPeriod) filtern
 * bereits `deletedAt IS NULL` — eine weggenommene Periode erreicht damit keinen
 * Berechnungspfad mehr, bevor sie hier überhaupt weggenommen werden kann.
 *
 * WR-12 (Code-Review Phase 13): Die Soft-Delete-Zusage stand ausschliesslich auf den
 * Lesepfaden. Die vier UPDATE-Schreibwege oben (`closeWorkPeriod`, `updateWorkPeriodValues`,
 * `setWorkPeriodValidFrom`, `extendWorkPeriodTo`) schrieben mit blossem `WHERE id = ?` — ein
 * Aufruf mit der Id einer weggenommenen Periode aenderte deren Werte UND umging dabei jede
 * Ueberlappungs-/Lueckenpruefung (Migration 013 gibt dem UPDATE-Riegel `NEW.deletedAt IS NULL`
 * mit, er ueberspringt die Zeile also; `checkPeriodChain()` liest sie ohnehin nicht). Alle
 * vier tragen den Filter jetzt ebenfalls, und ihre `changes === 0`-Meldung deckt den Fall
 * „bereits geloescht" ausdruecklich mit ab — wortgleich zu `softDeleteWorkPeriod()`.
 */

/**
 * Liefert eine einzelne Periode über ihre Id, oder `null`, wenn sie nicht existiert ODER
 * bereits weggenommen wurde (`deletedAt IS NOT NULL`) — Phase 13 (13-CONTEXT.md D2). Anders
 * als die reinen Rücklese-Abfragen nach einem Schreibvorgang liefert diese Funktion bewusst
 * `null` statt zu werfen: Ein Aufrufer (z. B. eine Lösch-Vorschau, die auf eine bereits
 * gelöschte Periode trifft) muss das als regulären Fall behandeln können, nicht als
 * Programmierfehler.
 */
export function getWorkPeriodById(periodId: number): UserWorkPeriod | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ? AND deletedAt IS NULL`)
    .get(periodId) as UserWorkPeriodRow | undefined;

  return row ? rowToWorkPeriod(row) : null;
}

/**
 * DER EINE LÜCKENSCHLUSS-SCHREIBWEG, der auch "offen" setzen kann (DD-7, 13-CONTEXT.md D3).
 *
 * ABGRENZUNG ZU `closeWorkPeriod()`: `closeWorkPeriod()` (Phase 10) bleibt UNVERÄNDERT (NO
 * REGRESSION) und akzeptiert weiterhin ausschließlich ein konkretes Datum — sie kann
 * strukturell kein `null` setzen. Wird die offene letzte Periode eines Nutzers gelöscht, muss
 * die Vorperiode wieder offen werden, damit die Kette D3 (Lückenlosigkeit) einhält. Dafür
 * existiert diese zweite, eigenständige Funktion, statt `closeWorkPeriod()` nachträglich um
 * ein optionales Argument zu erweitern und dadurch jeden ihrer bestehenden Aufrufer erneut auf
 * Nichtregression prüfen zu müssen.
 */
export function extendWorkPeriodTo(periodId: number, validTo: string | null): UserWorkPeriod {
  if (validTo !== null) {
    assertDateFormat(validTo, 'validTo');
  }

  try {
    const result = db
      // WR-12 (Code-Review Phase 13): `AND deletedAt IS NULL`. Ohne diesen Riegel aendert
      // ein Aufruf mit der Id einer WEGGENOMMENEN Periode deren Werte — und umgeht dabei
      // jede Ueberlappungs-/Lueckenpruefung: Migration 013 gibt dem UPDATE-Trigger
      // `NEW.deletedAt IS NULL` als Bedingung mit, er ueberspringt die Zeile also, und
      // `checkPeriodChain()` liest sie ohnehin nicht (`getWorkPeriods()` filtert sie
      // heraus). Die Soft-Delete-Zusage dieses Services stand bisher nur auf den
      // Lesepfaden; der Schreibpfad hat jetzt sein Gegenstueck (Muster:
      // `softDeleteWorkPeriod()`, das den Filter seit jeher traegt).
      .prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ? AND deletedAt IS NULL`)
      .run(validTo, periodId);

    if (result.changes === 0) {
      throw new Error(
        `extendWorkPeriodTo: Periode ${periodId} existiert nicht oder wurde bereits gelöscht.`
      );
    }
  } catch (err) {
    translateWorkPeriodError(
      err,
      `Periode ${periodId} konnte nicht auf ${validTo ?? 'offen'} gesetzt werden`
    );
  }

  // Kein deletedAt-Filter nötig: liest die gerade geschriebene Zeile zurück.
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
    .get(periodId) as UserWorkPeriodRow;

  return rowToWorkPeriod(row);
}

/**
 * DER EINE SOFT-DELETE-SCHREIBWEG (13-CONTEXT.md D2). Kein anderer Codepfad im Projekt darf
 * ein echtes `DELETE`-Statement auf dieser Tabelle ausführen — der Trigger
 * `trg_user_work_periods_delete_guard` (Migration 008/013) bleibt als Sicherheitsnetz gegen
 * ein solches echtes `DELETE` bestehen, ist aber KEIN Ersatz für diesen Schreibweg, weil er nur
 * gegen echtes `DELETE` schützt, nicht gegen ein `UPDATE ... SET deletedAt = ...`.
 *
 * Setzt `deletedAt` über den SQLite-Ausdruck `datetime('now')`, nicht über
 * `new Date().toISOString()` — `.claude/CLAUDE.md` verbietet zeitzonenunsichere
 * Date-Konvertierungen im Code; hier wird ohnehin ein voller Zeitstempel gebraucht (kein
 * reines `YYYY-MM-DD`-Kalenderdatum), SQLite bildet ihn selbst. `deletedBy` wird über die
 * Signatur zwingend mitgeschrieben (T-13-08) — es gibt keinen Aufruf, der nur `deletedAt`
 * setzt und den Urheber offen lässt.
 *
 * Liest die Zeile danach OHNE den `deletedAt IS NULL`-Filter zurück: Sie ist jetzt
 * weggenommen, `getWorkPeriodById()` würde für dieselbe Id `null` liefern.
 */
export function softDeleteWorkPeriod(periodId: number, deletedBy: number | null): UserWorkPeriod {
  try {
    const result = db
      .prepare(
        `UPDATE user_work_periods SET deletedAt = datetime('now'), deletedBy = ? WHERE id = ? AND deletedAt IS NULL`
      )
      .run(deletedBy, periodId);

    if (result.changes === 0) {
      throw new Error(
        `softDeleteWorkPeriod: Periode ${periodId} existiert nicht oder wurde bereits gelöscht.`
      );
    }
  } catch (err) {
    translateWorkPeriodError(err, `Periode ${periodId} konnte nicht gelöscht werden`);
  }

  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE id = ?`)
    .get(periodId) as UserWorkPeriodRow;

  return rowToWorkPeriod(row);
}

/**
 * Setzt `work_period_chain_guard.suspended` für die Dauer von `fn()` auf 1 und garantiert über
 * ein `finally` die Rücksetzung auf 0 — auch dann, wenn `fn()` wirft (T-13-07, DD-8,
 * 13-CONTEXT.md).
 *
 * NUTZUNGSBEDINGUNG (verbindlich für jeden Aufrufer, kein Vorschlag): Diese Funktion darf
 * AUSSCHLIESSLICH innerhalb einer bereits laufenden `db.transaction()`-Klammer aufgerufen
 * werden — schlägt die umgebende Transaktion fehl, rollt SQLite auch den
 * `UPDATE work_period_chain_guard`-Aufruf zurück, ohne dass diese Funktion selbst etwas dafür
 * tun müsste. Der Aufrufer MUSS unmittelbar danach, noch innerhalb derselben
 * Transaktionsklammer, `checkPeriodChain(userId)` aufrufen und bei einem nicht-leeren
 * `findings`-Array abbrechen (die Transaktion wirft und rollt damit zurück) — der Riegel prüft
 * während der Aussetzung nichts, die Kettenintegrität muss deshalb manuell nachgeholt werden.
 * (Aufrufer: Plan 13-03.)
 *
 * B-2 (Sicherheitsprüfung Phase 13): Diese Bedingung stand bis hierher NUR in diesem
 * Kommentar. `db.inTransaction` erzwingt sie jetzt zur Laufzeit. Der Unterschied ist nicht
 * kosmetisch: Innerhalb der Klammer ist ein Absturz zwischen Aussetzung und `finally`
 * folgenlos, weil SQLite die ganze Klammer beim nächsten Öffnen zurückrollt. AUSSERHALB der
 * Klammer läuft das `UPDATE ... suspended = 1` im Autocommit — ein Absturz danach ließe den
 * Riegel für diese Datenbankdatei dauerhaft und lautlos ausgesetzt. Die vier aussetzbaren
 * Trigger-Klauseln aus Migration 013 prüften dann schlicht nichts mehr, ohne Fehlermeldung
 * und ohne dass ein Test es bemerkte. Ein lauter Fehler beim Aufruf ist die einzige Antwort,
 * die diesen Zustand gar nicht erst entstehen lässt.
 */
export function withSuspendedChainGuard<T>(fn: () => T): T {
  if (!db.inTransaction) {
    throw new ChainGuardOutsideTransactionError(
      'withSuspendedChainGuard() wurde außerhalb einer aktiven Transaktion aufgerufen. ' +
        'Die Aussetzung des Kettenriegels ist ausschließlich innerhalb einer laufenden ' +
        'db.transaction()-Klammer erlaubt (T-13-02), weil nur dort ein Rollback die ' +
        'Aussetzung sicher zurücknimmt. Es wurde nichts verändert.'
    );
  }

  db.prepare(`UPDATE work_period_chain_guard SET suspended = 1 WHERE id = 1`).run();
  try {
    return fn();
  } finally {
    db.prepare(`UPDATE work_period_chain_guard SET suspended = 0 WHERE id = 1`).run();
  }
}

/**
 * Defensive Rücksetzung des Kettenriegels beim Serverstart (B-2, Sicherheitsprüfung Phase 13).
 *
 * WARUM ÜBERHAUPT, wenn `withSuspendedChainGuard()` die Transaktionsklammer jetzt erzwingt:
 * Die Erzwingung wirkt ab dem nächsten Start dieses Codes — sie räumt keine Datenbankdatei
 * auf, die ein früherer Lauf (oder ein Wartungsskript, das `work_period_chain_guard` von Hand
 * anfasst) mit `suspended = 1` hinterlassen hat. Genau dieser Zustand ist der gefährliche:
 * die vier aussetzbaren Trigger-Klauseln aus Migration 013 prüfen dann nichts, und nichts im
 * System sagt es. Deshalb wird der Wert beim Hochfahren bedingungslos auf 0 gezogen.
 *
 * Der `UPDATE` trägt `AND suspended <> 0`, damit `result.changes` genau dann 1 ist, wenn
 * tatsächlich ein hängengebliebener Riegel gefunden wurde — im Normalfall wird keine Zeile
 * angefasst und es entsteht keine Logzeile.
 *
 * Der Vorfall wird über `logger.warn({ err }, …)` gemeldet, nicht über `{ error }`: pino
 * wendet seinen Fehler-Serializer auf `err` an; `message`/`stack` sind auf `Error` nicht
 * aufzählbar und lägen sonst als `{}` im Log (WR-06, Code-Review Phase 11). Der Server startet
 * trotzdem durch — der Riegel steht nach dieser Zeile wieder scharf, ein Abbruch würde nur
 * den bereits behobenen Zustand zementieren.
 *
 * Gibt zurück, ob tatsächlich ein ausgesetzter Riegel zurückgesetzt wurde.
 */
export function resetStaleChainGuardSuspension(): boolean {
  const result = db
    .prepare(`UPDATE work_period_chain_guard SET suspended = 0 WHERE id = 1 AND suspended <> 0`)
    .run();

  if (result.changes === 0) {
    return false;
  }

  logger.warn(
    { err: new StaleChainGuardSuspensionError() },
    '⚠️ work_period_chain_guard.suspended stand beim Start auf 1 — Kettenriegel war ausgesetzt und wurde zurückgesetzt'
  );

  return true;
}

/**
 * Periodenliste inklusive serverseitig berechneter Flags (DD-6, 13-CONTEXT.md): `isFirst` ist
 * die erste Zeile der aufsteigend nach `validFrom` sortierten, nicht weggenommenen Kette
 * (Index 0) — bewusst KEIN Vergleich gegen `users.hireDate`, weil die Kette nach Phase 11
 * immer am Eintrittsdatum beginnt und ein zweiter Vergleich eine zweite Wahrheit erzeugen
 * würde. `isCurrent` kommt aus `resolveWorkPeriodIn(periods, getTodayString())` — derselben
 * Auflösungsfunktion, die auch die Sollstunden-Berechnung nutzt, kein zweiter
 * Intervallvergleich. Das Desktop übernimmt beide Flags unverändert, statt sie clientseitig
 * nachzurechnen.
 */
export function getWorkPeriodsWithFlags(userId: number): UserWorkPeriodListItem[] {
  const periods = getWorkPeriods(userId);
  const current = resolveWorkPeriodIn(periods, getTodayString());

  return periods.map((period, index) => ({
    ...period,
    isFirst: index === 0,
    isCurrent: current !== null && current.id === period.id,
  }));
}
