/**
 * Work Period Change Service — der zentrale Schreibweg für einen Stundenwechsel
 *
 * DER EINE VORGANG (D2, REQ-27): `applyWorkTimeChange()` ist die einzige Rechenbahn für
 * Vorschau UND Speichern. Es gibt keine im Frontend nachgebaute Vorschau-Rechnung und keine
 * zweite Server-Funktion, die dieselbe Zahl auf einem anderen Weg ermittelt — genau das
 * "Dual Calculation System", das `.claude/CLAUDE.md` als Fehlerquelle beschreibt. Der einzige
 * Unterschied zwischen Vorschau und Speichern ist das `dryRun`-Flag: Beide Pfade schreiben
 * tatsächlich (Periode schließen/anlegen, Monate neu rechnen, ggf. eine Buchung erzeugen),
 * messen den entstandenen Saldo, und der Trockenlauf wirft am Ende gezielt, damit
 * better-sqlite3 die gesamte Transaktion zurückrollt. Rechnen, schreiben, messen,
 * zurückrollen — nicht rechnen ohne zu schreiben.
 *
 * D3 — BEGRENZTER REBUILD: Neu gerechnet wird ausschließlich von `validFrom` der neuen
 * Periode bis heute, nicht die gesamte Historie. Ein Stichtag in der Zukunft hat einen
 * leeren bzw. eintägigen Bereich und damit keine Wirkung auf die Vergangenheit.
 *
 * D4 — KEINE UMRECHNUNG DES SALDOS: Der bereits angesparte Überstundensaldo wird nicht in
 * "Tage nach neuem Modell" umgerechnet. Die Differenz, die durch die neue Sollstunden-Basis
 * im rückwirkenden Zeitraum entsteht, wird gemessen (Saldo vorher/nachher) und als GENAU EINE
 * Journalbuchung abgelegt — nie als stille Neuberechnung, nie als viele Tagesbuchungen. Bei
 * einer Differenz von 0 entsteht keine Buchung.
 *
 * D7 — EINE TRANSAKTIONSKLAMMER: Periode schließen/anlegen, der begrenzte Rebuild und die
 * Journalbuchung liegen vollständig innerhalb derselben Transaktionsklammer. Ein halb
 * eingetragener Wechsel ist damit unmöglich — entweder alles oder nichts.
 *
 * PERIODENKONTEXT: Für jeden der beiden Messläufe (vor und nach dem Schreiben) wird der
 * Perioden-Cache aus `workPeriodContext.ts` genau einmal gebaut und durch die komplette
 * Tagesschleife durchgereicht (D1 aus Phase 11). Die Einzelabfrage-Variante dieses Moduls
 * kommt in diesem Service an keiner Stelle vor — sie wäre in einer Tagesschleife über einen
 * mehrjährigen, rückwirkenden Zeitraum genau die Verschwendung, die Phase 11 beheben sollte.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul
 * (Muster aus `vacationTransactionService.ts:1-29`, `workPeriodService.ts:58-60`).
 *
 * Kontext: .planning/phases/12-stundenwechsel-bedienen/12-CONTEXT.md (D2-D5, D7),
 * .planning/phases/12-stundenwechsel-bedienen/12-UI-SPEC.md (Fehlertexte, Journaltexte),
 * .planning/phases/12-stundenwechsel-bedienen/12-03-PLAN.md (Task 2).
 */

import { db } from '../database/connection.js';
import { getUserById } from './userService.js';
import {
  getWorkPeriods,
  resolveWorkPeriodIn,
  createWorkPeriod,
  closeWorkPeriod,
  checkPeriodChain,
  WorkPeriodConflictError,
} from './workPeriodService.js';
import * as workPeriodContextModule from './workPeriodContext.js';
import type { WorkPeriodContext } from './workPeriodContext.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
import {
  createTransaction,
  // CR-02: derselbe Laufsaldo-Lesepfad, den der Rebuild verwendet — keine zweite,
  // eigene Abfrage in diesem Service.
  getBalanceBeforeDate as getJournalBalanceBeforeDate,
} from './overtimeTransactionManager.js';
import { getTodayString, formatDate } from '../utils/timezone.js';
import { isRealCalendarDate } from '../utils/validation.js';
import {
  WEEKDAY_KEYS,
  MAX_DAILY_HOURS,
  MAX_WEEKLY_HOURS,
  isWorkSchedule,
  sumWorkScheduleHours,
} from '../utils/workSchedule.js';
import logger from '../utils/logger.js';
import type {
  UserPublic,
  UserWorkPeriod,
  WorkSchedule,
  WorkTimeChangeInput,
  WorkTimeChangeOutcome,
  WorkTimeChangePreview,
} from '../types/index.js';

/** WR-04: Obergrenze für die Pflichtbegründung — sie landet unverändert im Kontoauszug. */
const MAX_REASON_LENGTH = 500;

/**
 * WR-04: C0-/C1-Steuerzeichen ohne die drei, die in einem mehrzeiligen Freitextfeld
 * (`textarea` im Wechsel-Dialog) legitim sind: Tabulator, Zeilenvorschub, Wagenrücklauf.
 */
function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    // Tabulator (9), Zeilenvorschub (10) und Wagenrücklauf (13) sind in einem
    // mehrzeiligen Freitextfeld legitim.
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

/**
 * Fehlerklasse für alle serverseitigen Validierungsfehler dieses Vorgangs — Muster aus
 * `WorkPeriodConflictError` (`workPeriodService.ts`). Trägt fertige, deutsche Meldungen aus
 * dem Textbuch der UI-SPEC; die Route reicht `message` unverändert weiter.
 */
export class WorkTimeChangeValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkTimeChangeValidationError';
  }
}

/**
 * Internes Signal für den Trockenlauf: wird ausschließlich innerhalb der Transaktionsklammer
 * geworfen, damit der Datenbanktreiber die gesamte Klammer zurückrollt. Außerhalb der Klammer
 * wird genau diese Fehlerklasse gefangen und ihr `outcome` als Ergebnis zurückgegeben — jeder
 * andere Fehler (Validierung, Konflikt) läuft ungefangen weiter zum Aufrufer.
 */
class PreviewRollback extends Error {
  constructor(readonly outcome: WorkTimeChangeOutcome) {
    super('Trockenlauf abgeschlossen — die Transaktion wird absichtlich zurückgerollt.');
    this.name = 'PreviewRollback';
  }
}

/** TT.MM.JJJJ aus einer YYYY-MM-DD-Zeichenkette — reine Zeichenkettenumformung, kein Date. */
function toGermanDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

/** "30,0" statt "30.0" — Komma als Dezimaltrennzeichen für die Journal-Beschreibung. */
function formatWeeklyHoursDe(hours: number): string {
  return hours.toFixed(1).replace('.', ',');
}

/** Wertvergleich zweier Tagespläne — keine Objektidentität. */
function workScheduleEquals(a: WorkSchedule | null, b: WorkSchedule | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return WEEKDAY_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Summiert die Sollstunden über `from`..`to` (beide inklusiv) und zählt jeden Tag mit einem
 * Sollwert größer 0 als Arbeitstag. Reine Tagesschleife über `getDailyTargetHours()` — der
 * übergebene Kontext wird ausschließlich als Parameter durchgereicht, niemals selbst gebaut.
 * Datumsfortschaltung rein lokal über Kalenderfelder, keine ISO-String-Konvertierung über die
 * Date-Klasse (Muster aus `overtimeTransactionRebuildService.ts:285-286`).
 */
function sumTargetHoursInRange(
  user: UserPublic,
  from: string,
  to: string,
  periods: WorkPeriodContext
): { targetHours: number; workingDays: number } {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const cursor = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);

  let targetHours = 0;
  let workingDays = 0;

  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateStr = formatDate(cursor, 'yyyy-MM-dd');
    const daily = getDailyTargetHours(user, dateStr, periods);
    targetHours += daily;
    if (daily > 0) {
      workingDays += 1;
    }
  }

  return {
    targetHours: Math.round(targetHours * 100) / 100,
    workingDays,
  };
}

/** Die betroffenen Kalendermonate (YYYY-MM) von `from` bis `to`, beide inklusiv. */
function monthsInRange(from: string, to: string): string[] {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);

  const months: string[] = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

/**
 * Prüft die Eingabe serverseitig — nicht nur in der Route (Muster aus Phase 6). Meldungstexte
 * wörtlich aus `12-UI-SPEC.md`, Abschnitt "Fehlermeldungen (Validierung)". Die Begründung wird
 * ausschließlich im Speicherpfad geprüft (`dryRun === false`); im Trockenlauf ist sie erlaubt,
 * damit die Vorschau schon vor dem Eintippen der Begründung berechnet werden kann.
 */
function validateInput(input: WorkTimeChangeInput, user: UserPublic, dryRun: boolean): void {
  // CR-03: echte Kalenderprüfung statt reiner Formatprüfung. `2026-02-31`, `2026-13-45` und
  // `0000-00-00` bestanden die alte Regex und landeten unverändert in
  // `user_work_periods.validFrom` — danach liefert `monthsInRange()` eine leere Liste (kein
  // Rebuild, balanceDelta 0, keine Buchung), `sumTargetHoursInRange()` misst über den
  // Überlauf von `new Date(2026, 12, 45)` einen völlig anderen Tag, und jeder
  // lexikografische Datumsvergleich dieses Nutzers ist dauerhaft verzerrt.
  if (!isRealCalendarDate(input.validFrom)) {
    throw new WorkTimeChangeValidationError('Stichtag ist erforderlich');
  }

  if (!Number.isFinite(input.weeklyHours)) {
    throw new WorkTimeChangeValidationError('Wochenstunden sind erforderlich');
  }
  if (input.weeklyHours < 0 || input.weeklyHours > 60) {
    throw new WorkTimeChangeValidationError('Wochenstunden müssen zwischen 0 und 60 liegen');
  }

  // CR-04: Der Tagesplan gewinnt gegen weeklyHours (`.claude/CLAUDE.md`: "workSchedule
  // existiert → weeklyHours wird IGNORIERT!"). Ohne Wertebereichsprüfung ist die
  // 0-bis-60-Grenze oben deshalb umgehbar — negative Tagessollstunden erzeugen einen frei
  // wählbaren, beliebig großen balanceDelta als schreibende Gutschrift.
  if (input.workSchedule !== null && !isWorkSchedule(input.workSchedule)) {
    throw new WorkTimeChangeValidationError(
      `Der Tagesplan muss entweder leer sein oder für alle sieben Wochentage eine Zahl ` +
      `zwischen 0 und ${MAX_DAILY_HOURS} enthalten.`
    );
  }

  if (input.workSchedule !== null) {
    const scheduleSum = sumWorkScheduleHours(input.workSchedule);
    if (scheduleSum > MAX_WEEKLY_HOURS) {
      throw new WorkTimeChangeValidationError(
        `Die Summe des Tagesplans (${formatWeeklyHoursDe(scheduleSum)} h) darf ` +
        `${MAX_WEEKLY_HOURS} Stunden pro Woche nicht überschreiten.`
      );
    }
  }

  if (input.validFrom < user.hireDate) {
    throw new WorkTimeChangeValidationError(
      `Der Stichtag darf nicht vor dem Eintrittsdatum (${toGermanDate(user.hireDate)}) liegen.`
    );
  }

  // WR-03: Obergrenze für die Rückwirkung. `validFrom` war nach unten nur durch `hireDate`
  // begrenzt — bei einem Eintrittsdatum von 2015 umfasst `affectedMonths` über 130 Monate,
  // von denen jeder ZWEIMAL vollständig neu aufgebaut wird (Schritt 6 und Schritt 12), und
  // zwar innerhalb einer einzigen Schreibtransaktion, die better-sqlite3 als exklusive
  // Sperre hält. Für die Dauer blockiert jeder andere Schreibvorgang des Servers — und die
  // Vorschau verwirft die Arbeit anschließend vollständig.
  //
  // Grenze: Beginn des Vorjahres. Damit sind höchstens 24 Monate betroffen. Ein Wechsel
  // weiter zurück ist ein Sonderfall, der nicht über die Adminoberfläche laufen soll.
  const currentYear = Number(getTodayString().slice(0, 4));
  const earliestValidFrom = `${currentYear - 1}-01-01`;
  if (input.validFrom < earliestValidFrom) {
    throw new WorkTimeChangeValidationError(
      `Der Stichtag darf nicht weiter zurückliegen als der ${toGermanDate(earliestValidFrom)} ` +
      `(Beginn des Vorjahres).`
    );
  }

  if (user.endDate && input.validFrom > user.endDate) {
    throw new WorkTimeChangeValidationError(
      `Der Stichtag liegt nach dem Austrittsdatum (${toGermanDate(user.endDate)}).`
    );
  }

  if (!dryRun) {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new WorkTimeChangeValidationError('Begründung ist erforderlich');
    }
    const trimmedReason = input.reason.trim();
    if (trimmedReason.length < 10) {
      throw new WorkTimeChangeValidationError('Begründung muss mindestens 10 Zeichen lang sein');
    }
    // WR-04: Der Text wird unverändert in `user_work_periods.note` UND wörtlich in
    // `overtime_transactions.description` gespeichert und von dort in den Kontoauszug jedes
    // Mitarbeiters übernommen. Ohne Obergrenze ist ein Megabyte-Text ebenso möglich wie
    // Steuerzeichen; ob aus Markup ein gespeichertes XSS wird, hinge allein am
    // Desktop-Renderer — darauf darf sich der Server nicht verlassen.
    if (trimmedReason.length > MAX_REASON_LENGTH) {
      throw new WorkTimeChangeValidationError(
        `Begründung darf höchstens ${MAX_REASON_LENGTH} Zeichen lang sein.`
      );
    }
    if (containsControlCharacters(trimmedReason)) {
      throw new WorkTimeChangeValidationError(
        'Begründung darf keine Steuerzeichen enthalten.'
      );
    }
  }
}

/**
 * Berechnet einen Stundenwechsel und wendet ihn wahlweise an (`dryRun: false`) oder verwirft
 * ihn nach der Messung (`dryRun: true`) — D2, keine zweite Rechenbahn. Wirft
 * `WorkTimeChangeValidationError` bei jedem Validierungs- oder Kettenproblem; in diesem Fall
 * wird nichts geschrieben.
 */
export function applyWorkTimeChange(
  input: WorkTimeChangeInput,
  options: { dryRun: boolean; createdBy: number | null }
): WorkTimeChangeOutcome {
  const run = db.transaction((): WorkTimeChangeOutcome => {
    // 1. Nutzer laden.
    const user = getUserById(input.userId);
    if (!user) {
      throw new WorkTimeChangeValidationError(`Nutzer ${input.userId} existiert nicht.`);
    }

    // 2. Eingabe serverseitig validieren.
    validateInput(input, user, options.dryRun);

    // 2b. WR-04: Ab hier wird ausschließlich die GETRIMMTE Begründung geschrieben — sowohl
    //     in `user_work_periods.note` als auch in `overtime_transactions.description`.
    //     Bisher landete die Rohfassung in der Datenbank, obwohl die Validierung oben
    //     ausschließlich `trim()`-Längen prüfte (10 Leerzeichen plus ein Zeichen genügten
    //     nicht der Prüfung, wurden aber gespeichert, sobald ein anderer Fall sie passieren
    //     ließ). Die UI-SPEC-Regel "die Begründung wird unverändert durchgereicht" betrifft
    //     den ANZEIGE-Pfad (`formatDescription()` im Desktop) — kein Umformatieren beim
    //     Rendern —, nicht das Abschneiden umgebender Leerzeichen beim Schreiben.
    const reason = input.reason.trim();

    // 3. Perioden laden — ein exakt auf validFrom fallender Periodenbeginn ist ein Konflikt.
    const existingPeriods = getWorkPeriods(input.userId);
    const exactMatch = existingPeriods.find((p) => p.validFrom === input.validFrom);
    if (exactMatch) {
      throw new WorkTimeChangeValidationError(
        `Zum ${toGermanDate(input.validFrom)} existiert bereits eine Periode. Wählen Sie ein anderes Datum.`
      );
    }

    // 4. Zeitraum bestimmen (D3): rückwirkend bis heute, sonst nur der Stichtag selbst.
    const today = getTodayString();
    const isRetroactive = input.validFrom < today;
    const rangeStart = input.validFrom;
    const rangeEnd = input.validFrom > today ? rangeStart : today;

    // 5. Betroffene Monate. `affectedMonths` ist der ANZEIGE-Zeitraum der Vorschau
    //    ("neu gerechnet wird vom … bis heute") und bleibt deshalb der zusammenhängende
    //    Bereich rangeStart..rangeEnd.
    const affectedMonths = monthsInRange(rangeStart, rangeEnd);

    // 5b. WR-02 — BEREITS MATERIALISIERTE ZUKUNFTSMONATE.
    //     Die alte Periode wird bei validFrom geschlossen, die neue erbt deren validTo: das
    //     neue Modell gilt damit für den GESAMTEN Rest der alten Periode, also auch für die
    //     Zukunft. Neu gerechnet wird per D3 aber nur bis heute. `overtime_balance`-Zeilen
    //     für Zukunftsmonate, die bereits existieren (z. B. durch genehmigten
    //     Zukunftsurlaub — siehe den Kommentar in `getOvertimeBalance()`), blieben sonst mit
    //     dem ALTEN Sollmodell stehen und würden erst irgendwann zufällig überschrieben.
    //
    //     ENTSCHEIDUNG (bewusst, wie vom Review verlangt): Solche Monate werden mit neu
    //     gerechnet — aber ausschließlich Monate, für die schon eine `overtime_balance`-Zeile
    //     existiert. Neue Zukunftsmonate anzulegen wäre falsch (sie würden ein volles
    //     Monatssoll ohne Ist erzeugen); vorhandene stehenzulassen ebenso.
    //     Die `model_change`-Buchung bleibt davon unberührt: `getOvertimeBalance()` blendet
    //     Zukunftsmonate aus, `balanceDelta` ändert sich also nicht.
    const rangeEndMonth = rangeEnd.slice(0, 7);
    const staleFutureMonths = (
      db
        .prepare(
          `SELECT month FROM overtime_balance
           WHERE userId = ? AND month > ?
           ORDER BY month ASC`
        )
        .all(input.userId, rangeEndMonth) as Array<{ month: string }>
    ).map((row) => row.month);

    const rebuildMonths = [...affectedMonths, ...staleFutureMonths];

    // 6. Ist-Basis herstellen: overtime_balance darf beim Messen nicht veraltet sein, sonst
    //    enthielte die Differenz zusätzlich den Nachhall einer ausstehenden Selbstheilung.
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(input.userId, month);
    }

    // 7. Sollstunden vor der Änderung — ein frischer Perioden-Cache für genau diesen Messlauf.
    const periodsBefore: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();
    const { targetHours: targetHoursBefore, workingDays: workingDaysInRange } =
      sumTargetHoursInRange(user, rangeStart, rangeEnd, periodsBefore);

    // 8. Saldo vor der Änderung.
    const balanceBefore = getOvertimeBalance(input.userId);

    // 9. Aktuell gültige Periode am Stichtag und "nichts zu tun"-Erkennung.
    const currentPeriod = resolveWorkPeriodIn(existingPeriods, input.validFrom);
    const isNoOp =
      currentPeriod !== null &&
      currentPeriod.weeklyHours === input.weeklyHours &&
      workScheduleEquals(currentPeriod.workSchedule, input.workSchedule);

    if (isNoOp && !options.dryRun) {
      throw new WorkTimeChangeValidationError(
        'Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab diesem Stichtag — es gibt nichts zu speichern.'
      );
    }

    // 10. Schreiben: bestehende Periode aufteilen oder Lücke füllen. Läuft unabhängig von
    //     dryRun — der Trockenlauf schreibt tatsächlich und rollt am Ende zurück (D2).
    let newPeriod: UserWorkPeriod;
    try {
      if (currentPeriod) {
        const splitValidTo = currentPeriod.validTo;
        closeWorkPeriod(currentPeriod.id, input.validFrom);
        newPeriod = createWorkPeriod({
          userId: input.userId,
          validFrom: input.validFrom,
          validTo: splitValidTo,
          weeklyHours: input.weeklyHours,
          workSchedule: input.workSchedule,
          note: reason,
          createdBy: options.createdBy,
        });
      } else {
        const nextPeriod = existingPeriods
          .filter((p) => p.validFrom > input.validFrom)
          .sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0))[0];
        newPeriod = createWorkPeriod({
          userId: input.userId,
          validFrom: input.validFrom,
          validTo: nextPeriod ? nextPeriod.validFrom : null,
          weeklyHours: input.weeklyHours,
          workSchedule: input.workSchedule,
          note: reason,
          createdBy: options.createdBy,
        });
      }
    } catch (err) {
      if (err instanceof WorkPeriodConflictError) {
        throw new WorkTimeChangeValidationError(err.message, { cause: err });
      }
      throw err;
    }

    // 11. Kettenprüfung — bei Befund rollt die Transaktion zurück (D7). Keine eigene
    //     Überlappungs-/Lückenlogik nachbauen.
    const chainResult = checkPeriodChain(input.userId);
    if (!chainResult.ok) {
      throw new WorkTimeChangeValidationError(
        `Die Periodenkette wäre nach diesem Wechsel ungültig: ${chainResult.findings.join(' ')}`
      );
    }

    // 12. Nachrechnen: derselbe begrenzte Bereich (inklusive der bereits materialisierten
    //     Zukunftsmonate aus Schritt 5b), jetzt mit der neuen Periode in der Kette.
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(input.userId, month);
    }

    // 13. Sollstunden nach der Änderung — ein zweiter, frischer Perioden-Cache, weil der
    //     erste Lauf die alten Perioden gecacht hat.
    const periodsAfter: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();
    const { targetHours: targetHoursAfter } = sumTargetHoursInRange(
      user,
      rangeStart,
      rangeEnd,
      periodsAfter
    );

    // 14. Saldo nach der Änderung und die Differenz, die daraus entsteht.
    const balanceAfter = getOvertimeBalance(input.userId);
    const balanceDelta = Math.round((balanceAfter - balanceBefore) * 100) / 100;

    // 15. Vorschau zusammensetzen — derselbe Rückgabetyp für Vorschau und Speichern (D2).
    const preview: WorkTimeChangePreview = {
      userId: input.userId,
      validFrom: input.validFrom,
      isRetroactive,
      rangeStart,
      rangeEnd,
      workingDaysInRange,
      targetHoursBefore,
      targetHoursAfter,
      targetHoursDelta: Math.round((targetHoursAfter - targetHoursBefore) * 100) / 100,
      balanceBefore,
      balanceAfter,
      balanceDelta,
      currentPeriod: currentPeriod
        ? {
            validFrom: currentPeriod.validFrom,
            weeklyHours: currentPeriod.weeklyHours,
            workSchedule: currentPeriod.workSchedule,
          }
        : null,
      isNoOp,
      midMonthEffective: !input.validFrom.endsWith('-01'),
      affectedMonths,
    };

    // 16. Die eine Journalbuchung (D4/D5) — nur beim tatsächlichen Speichern und nur, wenn
    //     überhaupt eine Differenz entstanden ist. Ein Stichtag in der Zukunft erzeugt keine.
    let transactionId: number | null = null;
    if (!options.dryRun && balanceDelta !== 0) {
      const previousWeeklyHours = currentPeriod ? currentPeriod.weeklyHours : user.weeklyHours;
      const description =
        `Stundenwechsel ab ${toGermanDate(input.validFrom)}: ` +
        `${formatWeeklyHoursDe(previousWeeklyHours)} → ${formatWeeklyHoursDe(input.weeklyHours)} h/Woche ` +
        `(Grund: ${reason})`;

      // CR-02: balanceBefore/balanceAfter der Journalzeile stehen auf der JOURNAL-Skala
      // (kumulativer Laufsaldo der Kette in overtime_transactions), nicht auf der
      // Aggregatskala von overtime_balance, aus der `balanceBefore`/`balanceAfter` oben
      // stammen. Beide Felder tragen denselben Wert: die Zeile dokumentiert einen Betrag,
      // dessen Wirkung bereits in den neu gerechneten Tageszeilen steckt — sie verschiebt
      // den Laufsaldo der Kette also um 0. Vorher war die Zeile zusätzlich in sich
      // unstimmig, weil `balanceAfter` den Saldo VOR dem Einfügen der eigenen Zeile trug.
      const journalBalance = getJournalBalanceBeforeDate(input.userId, input.validFrom);

      transactionId = createTransaction({
        userId: input.userId,
        date: input.validFrom,
        type: 'model_change',
        hours: balanceDelta,
        description,
        referenceType: 'work_period',
        referenceId: newPeriod.id,
        createdBy: options.createdBy,
        balanceBefore: journalBalance,
        balanceAfter: journalBalance,
      });

      // CR-06: `createTransaction()` ist idempotent und liefert `null`, wenn eine Zeile mit
      // gleichem userId/date/type/hours (±0,01) und gleicher Referenz bereits existiert.
      // Der Typvertrag von `WorkTimeChangeOutcome.transactionId` sagt aber etwas anderes:
      // "null, wenn balanceDelta 0 ist". Ein `null` aus dem Duplikatpfad wäre davon nicht
      // unterscheidbar — die Route meldete "Wechsel gespeichert", obwohl die von D4/D5
      // geforderte Journalzeile fehlt, und die einzige Spur wäre ein `logger.debug` im
      // Manager (in Produktion regelmäßig abgeschaltet). Im Speicherpfad ist das ein
      // Fehlerzustand: die gesamte Transaktionsklammer rollt zurück (D7).
      if (transactionId === null) {
        throw new Error(
          `Stundenwechsel für Nutzer ${input.userId} ab ${input.validFrom}: die ` +
          `model_change-Buchung wurde als Duplikat verworfen (balanceDelta ${balanceDelta}) — ` +
          `D4 verlangt genau eine Buchung.`
        );
      }
    }

    // 16b. WR-05 — REVISIONSSICHERE PROTOKOLLIERUNG.
    //      Ein Stundenwechsel ändert rückwirkend das Arbeitszeitkonto eines fremden
    //      Mitarbeiters und erzeugt eine Saldobuchung. Protokolliert wurde das ausschließlich
    //      über `logger.info` — also in eine rotierende Datei ohne Aufbewahrungsgarantie. Wer
    //      wann welchen Wechsel für wen vorgenommen hat, war nach der Logrotation nicht mehr
    //      rekonstruierbar; die `createdBy`-Spalte der Periode allein trägt weder den
    //      Zeitpunkt der Aktion noch die Vorwerte.
    //
    //      Der Eintrag liegt INNERHALB derselben Transaktionsklammer (D7): ein zurückgerollter
    //      Wechsel hinterlässt auch keinen Protokolleintrag, und der Trockenlauf schreibt
    //      keinen. `audit_log.userId` trägt den handelnden Admin (Muster aus
    //      `overtimeCorrectionsService.deleteOvertimeCorrection()`), der betroffene
    //      Mitarbeiter steht in `changes`.
    if (!options.dryRun) {
      db.prepare(
        `INSERT INTO audit_log (userId, action, entity, entityId, changes)
         VALUES (?, 'create', 'work_period_change', ?, ?)`
      ).run(
        options.createdBy,
        newPeriod.id,
        JSON.stringify({
          affectedUserId: input.userId,
          validFrom: input.validFrom,
          rangeStart,
          rangeEnd,
          before: currentPeriod
            ? {
                validFrom: currentPeriod.validFrom,
                weeklyHours: currentPeriod.weeklyHours,
                workSchedule: currentPeriod.workSchedule,
              }
            : null,
          after: {
            weeklyHours: input.weeklyHours,
            workSchedule: input.workSchedule,
          },
          targetHoursBefore,
          targetHoursAfter,
          balanceBefore,
          balanceAfter,
          balanceDelta,
          reason,
          transactionId,
        })
      );
    }

    // 17. Protokoll — ausschließlich Zahlen und Datumsangaben, keine Namen, keine Begründung.
    logger.info(
      { userId: input.userId, validFrom: input.validFrom, balanceDelta, dryRun: options.dryRun },
      'Stundenwechsel berechnet'
    );

    // 18. Trockenlauf: gezielt werfen, damit die gesamte Klammer zurückrollt. Außerhalb wird
    //     dieses Signal gefangen und sein outcome zurückgegeben — Periode und Buchung
    //     existieren danach nicht.
    if (options.dryRun) {
      throw new PreviewRollback({ preview, period: null, transactionId: null });
    }

    return { preview, period: newPeriod, transactionId };
  });

  try {
    return run();
  } catch (err) {
    if (err instanceof PreviewRollback) {
      return err.outcome;
    }
    throw err;
  }
}
