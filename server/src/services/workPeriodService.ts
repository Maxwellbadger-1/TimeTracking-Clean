/**
 * Work Period Service — Arbeitszeit-Perioden lesen, schreiben, zum Datum auflösen
 *
 * WARUM: `users.weeklyHours`/`users.workSchedule` sind flache Felder ohne Historie
 * (D4, Phase 10 lässt sie unangetastet). `user_work_periods` (Migration 008) trägt
 * dieselben Werte versioniert mit einem halboffenen Gültigkeitsintervall
 * `[validFrom, validTo)` (D1): `validFrom` inklusiv, `validTo` exklusiv, `validTo = NULL`
 * heißt laufende Periode.
 *
 * DIE EINE AUFLÖSUNGSSTELLE: `resolveWorkPeriodAt()` ist im gesamten Projekt die einzige
 * Stelle, an der eine Periode zu einem Datum aufgelöst wird. Die Lehre aus Phase 9
 * (`09-INVENTAR-KREDITIERUNG.md`) war, dass dieselbe fachliche Regel in zwölf Kopien
 * existierte, vier davon aktiv und untereinander abweichend. Kein Skript, kein Test und
 * kein späterer Aufrufer (Phase 11) baut eine zweite Auflösung — jeder ruft diese Funktion.
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
 * KEIN AUFRUFER IN PHASE 10 (D4, REQ-21): Dieser Service wird von Phase 10 aus bewusst von
 * niemandem aufgerufen. `users.weeklyHours`/`users.workSchedule` bleiben bis Phase 11 die
 * gelesene Quelle für die Berechnung; die Perioden laufen daneben her.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul
 * (Muster aus `vacationTransactionService.ts:1-29`).
 *
 * Kontext: .planning/phases/10-perioden-fundament/10-CONTEXT.md (D1–D7),
 * .planning/phases/10-perioden-fundament/10-04-PLAN.md
 */

import { db } from '../database/connection.js';
import type { UserWorkPeriod, UserWorkPeriodRow, WorkSchedule, DayName } from '../types/index.js';

/** Ausschließlich Zeichenketten im Format YYYY-MM-DD — kein Date-Objekt, keine Zeitzone. */
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

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
  id, userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy
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
 * Prüft, dass ein übergebener Wert eine Zeichenkette im Format YYYY-MM-DD ist. Läuft zur
 * Laufzeit auch gegen Werte, die die TypeScript-Signatur eigentlich schon ausschließt (ein
 * `Date`-Objekt oder ein anders formatierter String), weil ein Aufrufer diese Prüfung nicht
 * per Typsystem umgehen können soll.
 */
function assertDateFormat(value: unknown, paramName: string): asserts value is string {
  if (typeof value !== 'string' || !DATE_FORMAT.test(value)) {
    throw new Error(
      `${paramName} muss eine Zeichenkette im Format YYYY-MM-DD sein, erhalten: ` +
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
      ? 'Die Periode überlappt mit einer bestehenden Periode desselben Nutzers.'
      : err.message.includes('Lücke')
      ? 'Die Periode würde eine Lücke zur bestehenden Periodenkette hinterlassen.'
      : `Die Datenbank hat die Änderung abgelehnt: ${err.message}`;
    throw new WorkPeriodConflictError(`${context}: ${detail}`, { cause: err });
  }
  throw err;
}

/** Alle Perioden eines Nutzers, aufsteigend nach validFrom. */
export function getWorkPeriods(userId: number): UserWorkPeriod[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE userId = ? ORDER BY validFrom ASC`)
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
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM user_work_periods WHERE userId = ? AND validTo IS NULL`)
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
 * DIE EINE Auflösungsstelle: löst die zu `date` gültige Periode eines Nutzers auf.
 *
 * Nimmt ausschließlich eine Zeichenkette im Format YYYY-MM-DD entgegen — kein Date-Objekt.
 * Die Abfrage bildet exakt das halboffene Intervall aus D1:
 * `validFrom <= date AND (validTo IS NULL OR validTo > date)`. Kein `new Date`, kein
 * `date()`/`strftime()`-SQL-Aufruf: ISO-Datum (`YYYY-MM-DD`) sortiert als Zeichenkette
 * lexikografisch identisch zur chronologischen Ordnung, ein reiner TEXT-Vergleich ist daher
 * exakt und zeitzonenfrei. Jeder Aufrufer muss sein Datum bereits als `YYYY-MM-DD` bilden,
 * wie es `formatDateBerlin(date, 'yyyy-MM-dd')` im Projekt tut.
 */
export function resolveWorkPeriodAt(userId: number, date: string): UserWorkPeriod | null {
  assertDateFormat(date, 'date');

  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM user_work_periods
       WHERE userId = ? AND validFrom <= ? AND (validTo IS NULL OR validTo > ?)`
    )
    .get(userId, date, date) as UserWorkPeriodRow | undefined;

  return row ? rowToWorkPeriod(row) : null;
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
      .prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ?`)
      .run(validTo, periodId);

    if (result.changes === 0) {
      throw new Error(`closeWorkPeriod: Periode ${periodId} existiert nicht.`);
    }
  } catch (err) {
    translateWorkPeriodError(err, `Periode ${periodId} konnte nicht geschlossen werden`);
  }

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
