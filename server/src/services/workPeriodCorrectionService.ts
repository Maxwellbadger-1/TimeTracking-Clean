/**
 * Work Period Correction Service — der Schreibweg für „Stammdaten korrigieren"
 *
 * D1 (13-CONTEXT.md): „Stundenwechsel ab Datum" (Phase 12, `workPeriodChangeService.ts`) legt
 * eine NEUE Periode an — die Vergangenheit bleibt stehen. „Stammdaten korrigieren" (hier)
 * ändert eine BESTEHENDE Periode rückwirkend, weil die Werte von jeher falsch waren. Das ist
 * KEIN gemeinsamer Dienst mit einem `mode`-Parameter: eigene Datei, eigene Fehlerklasse
 * (`WorkPeriodCorrectionValidationError`, wortgleiches Muster zu
 * `WorkTimeChangeValidationError`), eigener Endpunkt (Plan 13-05). Eine Trennung, die nur in
 * der Oberfläche existiert, wäre in einem halben Jahr wieder verschwunden.
 *
 * STRUKTURELLE VORLAGE: `applyWorkTimeChange()` (`workPeriodChangeService.ts:334-637`) ist die
 * fertige Blaupause für „eine Rechenbahn für Vorschau und Speichern, alles in einer
 * Transaktionsklammer" — Trockenlauf/Speichern-Weiche über `dryRun`, Rebuild-Schleife vor UND
 * nach dem Schreiben, eine einzige Journalzeile. Dieser Dienst kopiert diese Struktur NICHT,
 * sondern verwendet dieselben freigegebenen Rechenbausteine (`PreviewRollback<T>`,
 * `runWithPreviewRollback()`, `sumTargetHoursInRange()`, `monthsInRange()`, `toGermanDate()`,
 * `formatWeeklyHoursDe()`, `workScheduleEquals()` — allesamt seit Plan 13-02 exportiert), damit
 * kein „Dual Calculation System" (`.claude/CLAUDE.md`) entsteht.
 *
 * DER UNTERSCHIED ZUR STRUKTURELLEN VORLAGE: `applyWorkTimeChange()` schließt die bisherige
 * Periode und legt eine neue an (Split). Diese Korrektur ändert die BESTEHENDE Zeile über
 * `updateWorkPeriodValues()`/`setWorkPeriodValidFrom()`/`extendWorkPeriodTo()` — kein
 * `createWorkPeriod`, kein `closeWorkPeriod`.
 *
 * D4/DD-10 — DER NEU ZU RECHNENDE ZEITRAUM: `rangeStart = min(altes validFrom, neues validFrom)`
 * — wird der Beginn nach vorn verschoben, ist der neu hinzugekommene Vorlauf betroffen; wird er
 * nach hinten verschoben, gehört das freigewordene Stück der Vorperiode ebenfalls neu gerechnet.
 * `rangeEnd = rangeStart > heute ? rangeStart : heute`.
 *
 * DD-11 — REIHENFOLGE DER SCHREIBSCHRITTE BEIM VERSCHIEBEN VON `validFrom`: Ändert sich
 * `validFrom` nicht, genügt `updateWorkPeriodValues()` — der Kettenriegel wird NICHT ausgesetzt.
 * Ändert sich `validFrom`, verletzt jeder Zwischenzustand zwangsläufig entweder die
 * Überlappungs- oder die Lückenbedingung (Begründung: 13-01-PLAN.md DD-2) — deshalb
 * `withSuspendedChainGuard()` um beide UPDATEs, und unmittelbar danach — innerhalb derselben
 * Transaktionsklammer — `checkPeriodChain(userId)`. Ist das Ergebnis nicht `ok`, wird geworfen;
 * die gesamte Klammer rollt zurück (13-02-PLAN.md hat diese Zusage für Plan 13-03 offengelassen,
 * DD-2 dort). `checkPeriodChain()` läuft in diesem Dienst UNBEDINGT nach dem Schreiben — auch
 * im Zweig ohne Riegel-Aussetzung — als zusätzliches Sicherheitsnetz gegen bereits bestehende
 * Kettenschäden, die die Trigger aus Migration 008/013 für sich allein nicht sähen (T-13-14).
 *
 * DD-12 — DIE JOURNALBUCHUNG: Beim Speichern, UNBEDINGT — auch bei `balanceDelta === 0`
 * (CR-01, Code-Review Phase 13: der Bestätigungsdialog sagt dem Admin unbedingt zu, dass die
 * Korrektur „als eigener Eintrag festgehalten" wird und „im Kontoauszug dauerhaft sichtbar"
 * bleibt; ohne Zeile überlebte die Pflichtbegründung nur in `audit_log.changes`, das keine
 * Oberfläche darstellt). Eine Zeile mit `hours: 0` ist rechenneutral. Wortgleiches
 * Muster zu Schritt 16 aus `applyWorkTimeChange()`: `type: 'model_change'`, `hours: balanceDelta`,
 * `balanceBefore`/`balanceAfter` beide auf den Laufsaldo der Kette vor dem neuen `validFrom`
 * (die Zeile verschiebt den Laufsaldo um 0 — ihre Wirkung steckt bereits in den neu gerechneten
 * Tageszeilen, CR-02-Muster aus Phase 12). KEIN neuer `type`-Wert — 13-UI-SPEC führt für die
 * Korrekturzeile dasselbe Typ-Badge „Modellwechsel" wie für die Umstellungszeile.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul.
 *
 * Kontext: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-CONTEXT.md (D1, D4, D7),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-UI-SPEC.md (Fehlertexte, Journaltext),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-03-PLAN.md (DD-9 bis DD-13).
 */

import { db } from '../database/connection.js';
import { getUserById } from './userService.js';
import {
  getWorkPeriodById,
  getWorkPeriods,
  extendWorkPeriodTo,
  setWorkPeriodValidFrom,
  updateWorkPeriodValues,
  withSuspendedChainGuard,
  checkPeriodChain,
  WorkPeriodConflictError,
} from './workPeriodService.js';
import * as workPeriodContextModule from './workPeriodContext.js';
import type { WorkPeriodContext } from './workPeriodContext.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
import {
  createTransaction,
  // CR-02-Muster (Phase 12): derselbe Laufsaldo-Lesepfad, den der Rebuild verwendet — keine
  // zweite, eigene Abfrage in diesem Service.
  getBalanceBeforeDate as getJournalBalanceBeforeDate,
} from './overtimeTransactionManager.js';
import {
  toGermanDate,
  formatWeeklyHoursDe,
  workScheduleEquals,
  sumTargetHoursInRange,
  monthsInRange,
  runWithPreviewRollback,
  PreviewRollback,
} from './workPeriodChangeService.js';
import { getTodayString } from '../utils/timezone.js';
import { isRealCalendarDate } from '../utils/validation.js';
import {
  MAX_DAILY_HOURS,
  MAX_WEEKLY_HOURS,
  isWorkSchedule,
  sumWorkScheduleHours,
} from '../utils/workSchedule.js';
import logger from '../utils/logger.js';
import type {
  UserPublic,
  UserWorkPeriod,
  WorkPeriodCorrectionInput,
  WorkPeriodCorrectionOutcome,
  WorkPeriodCorrectionPreview,
} from '../types/index.js';

/** WR-04-Muster (Phase 12): Obergrenze für die Pflichtbegründung — sie landet unverändert im
 *  Kontoauszug. Lokal übernommen (nicht aus `workPeriodChangeService.ts` importiert), weil D1
 *  die Trennung der beiden Aktionen auch in ihren jeweiligen Validierungsbausteinen verlangt —
 *  nur die reinen RECHENBAUSTEINE (sumTargetHoursInRange, monthsInRange, PreviewRollback) sind
 *  laut Plan 13-03 gemeinsames Gut, die Validierungstexte gehören zu jedem Dienst einzeln. */
const MAX_REASON_LENGTH = 500;

/**
 * WR-04-Muster (Phase 12): C0-/C1-Steuerzeichen ohne die drei, die in einem mehrzeiligen
 * Freitextfeld legitim sind: Tabulator, Zeilenvorschub, Wagenrücklauf. Wortgleiche Kopie aus
 * `workPeriodChangeService.ts` (dort nicht exportiert) — siehe Kommentar bei
 * `MAX_REASON_LENGTH`.
 */
function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

/**
 * Fehlerklasse für alle serverseitigen Validierungsfehler dieses Vorgangs (DD-9, D1) — eigene
 * Klasse statt Wiederverwendung von `WorkTimeChangeValidationError`, damit die serverseitige
 * Trennung der beiden Aktionen auch im Fehlertyp sichtbar bleibt.
 */
export class WorkPeriodCorrectionValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkPeriodCorrectionValidationError';
  }
}

/**
 * Prüft die Korrektur-Eingabe serverseitig — nicht nur in der Route (D7). Meldungstexte
 * wörtlich aus `13-UI-SPEC.md`, Abschnitt „Fehlermeldungen (Validierung)". Die Begründung wird
 * ausschließlich im Speicherpfad geprüft (`dryRun === false`, DD-13); im Trockenlauf ist sie
 * erlaubt, damit die Vorschau schon vor dem Eintippen der Begründung berechnet werden kann.
 */
function validateCorrectionInput(
  input: WorkPeriodCorrectionInput,
  user: UserPublic,
  period: UserWorkPeriod,
  previous: UserWorkPeriod | null,
  next: UserWorkPeriod | null,
  isFirst: boolean,
  isNoOp: boolean,
  dryRun: boolean
): void {
  if (!isRealCalendarDate(input.validFrom)) {
    throw new WorkPeriodCorrectionValidationError('Gültig ab ist erforderlich');
  }

  if (!Number.isFinite(input.weeklyHours)) {
    throw new WorkPeriodCorrectionValidationError('Wochenstunden sind erforderlich');
  }
  if (input.weeklyHours < 0 || input.weeklyHours > 60) {
    throw new WorkPeriodCorrectionValidationError('Wochenstunden müssen zwischen 0 und 60 liegen');
  }

  // CR-04-Muster (Phase 12): Der Tagesplan gewinnt gegen weeklyHours. Ohne Wertebereichsprüfung
  // ist die 0-bis-60-Grenze oben umgehbar — negative Tagessollstunden erzeugen einen frei
  // wählbaren, beliebig großen balanceDelta als schreibende Gutschrift.
  if (input.workSchedule !== null && !isWorkSchedule(input.workSchedule)) {
    throw new WorkPeriodCorrectionValidationError(
      `Der Tagesplan muss entweder leer sein oder für alle sieben Wochentage eine Zahl ` +
      `zwischen 0 und ${MAX_DAILY_HOURS} enthalten.`
    );
  }
  if (input.workSchedule !== null) {
    const scheduleSum = sumWorkScheduleHours(input.workSchedule);
    if (scheduleSum > MAX_WEEKLY_HOURS) {
      throw new WorkPeriodCorrectionValidationError(
        `Die Summe des Tagesplans (${formatWeeklyHoursDe(scheduleSum)} h) darf ` +
        `${MAX_WEEKLY_HOURS} Stunden pro Woche nicht überschreiten.`
      );
    }
  }

  if (input.validFrom < user.hireDate) {
    throw new WorkPeriodCorrectionValidationError(
      `Der Beginn darf nicht vor dem Eintrittsdatum (${toGermanDate(user.hireDate)}) liegen.`
    );
  }

  if (previous && input.validFrom <= previous.validFrom) {
    throw new WorkPeriodCorrectionValidationError(
      `Der Beginn muss nach dem ${toGermanDate(previous.validFrom)} liegen — dem Beginn der vorherigen Periode.`
    );
  }

  if (next && input.validFrom >= next.validFrom) {
    throw new WorkPeriodCorrectionValidationError(
      `Der Beginn muss vor dem ${toGermanDate(next.validFrom)} liegen — dem Beginn der nächsten Periode.`
    );
  }

  if (user.endDate && input.validFrom > user.endDate) {
    throw new WorkPeriodCorrectionValidationError(
      `Der Beginn liegt nach dem Austrittsdatum (${toGermanDate(user.endDate)}).`
    );
  }

  // DD-11: Die erste Periode eines Nutzers beginnt immer am Eintrittsdatum — sie hat keine
  // Vorperiode, die beim Verschieben mitwachsen könnte. 13-UI-SPEC sperrt das Feld dort bereits
  // clientseitig; der Server verlässt sich nicht darauf.
  if (isFirst && input.validFrom !== period.validFrom) {
    throw new WorkPeriodCorrectionValidationError(
      'Die erste Periode beginnt immer am Eintrittsdatum und kann nicht verschoben werden.'
    );
  }

  if (isNoOp && !dryRun) {
    throw new WorkPeriodCorrectionValidationError(
      'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.'
    );
  }

  if (!dryRun) {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new WorkPeriodCorrectionValidationError('Begründung ist erforderlich');
    }
    const trimmedReason = input.reason.trim();
    if (trimmedReason.length < 10) {
      throw new WorkPeriodCorrectionValidationError('Begründung muss mindestens 10 Zeichen lang sein');
    }
    if (trimmedReason.length > MAX_REASON_LENGTH) {
      throw new WorkPeriodCorrectionValidationError(
        `Begründung darf höchstens ${MAX_REASON_LENGTH} Zeichen lang sein.`
      );
    }
    if (containsControlCharacters(trimmedReason)) {
      throw new WorkPeriodCorrectionValidationError('Begründung darf keine Steuerzeichen enthalten.');
    }
  }
}

/**
 * Berechnet eine rückwirkende Stammdaten-Korrektur und wendet sie wahlweise an
 * (`dryRun: false`) oder verwirft sie nach der Messung (`dryRun: true`) — dieselbe
 * Trockenlauf-/Speicher-Mechanik wie `applyWorkTimeChange()` (`runWithPreviewRollback`), kein
 * zweiter Rechenweg. Wirft `WorkPeriodCorrectionValidationError` bei jedem Validierungs- oder
 * Kettenproblem; in diesem Fall wird nichts geschrieben.
 */
export function correctWorkPeriod(
  input: WorkPeriodCorrectionInput,
  options: { dryRun: boolean; createdBy: number | null }
): WorkPeriodCorrectionOutcome {
  const run = db.transaction((): WorkPeriodCorrectionOutcome => {
    // 1. Periode und Nutzer laden.
    const period = getWorkPeriodById(input.periodId);
    if (!period) {
      throw new WorkPeriodCorrectionValidationError(`Periode ${input.periodId} existiert nicht.`);
    }
    const user = getUserById(period.userId);
    if (!user) {
      throw new WorkPeriodCorrectionValidationError(`Nutzer ${period.userId} existiert nicht.`);
    }

    // Nachbarschaft in der Kette (DD-6-Muster): index 0 der aufsteigend sortierten,
    // nicht weggenommenen Kette ist die erste Periode — kein Vergleich gegen user.hireDate.
    const existingPeriods = getWorkPeriods(period.userId);
    const periodIndex = existingPeriods.findIndex((p) => p.id === period.id);
    const previous = periodIndex > 0 ? existingPeriods[periodIndex - 1] : null;
    const next =
      periodIndex >= 0 && periodIndex < existingPeriods.length - 1
        ? existingPeriods[periodIndex + 1]
        : null;
    const isFirst = periodIndex === 0;

    const validFromChanged = input.validFrom !== period.validFrom;
    const isNoOp =
      !validFromChanged &&
      period.weeklyHours === input.weeklyHours &&
      workScheduleEquals(period.workSchedule, input.workSchedule);

    // 2. Validierung (D7, Meldungstexte wörtlich aus 13-UI-SPEC).
    validateCorrectionInput(input, user, period, previous, next, isFirst, isNoOp, options.dryRun);

    // 2b. WR-04-Muster: Ab hier wird ausschließlich die GETRIMMTE Begründung geschrieben.
    const reason = input.reason.trim();

    // 3. Zeitraum und Monatsliste nach DD-10.
    const today = getTodayString();
    const rangeStart = input.validFrom < period.validFrom ? input.validFrom : period.validFrom;
    const isRetroactive = rangeStart < today;
    const rangeEnd = rangeStart > today ? rangeStart : today;
    const affectedMonths = monthsInRange(rangeStart, rangeEnd);

    // WR-02-Muster (Phase 12): bereits materialisierte Zukunftsmonate desselben Nutzers
    // ebenfalls mit neu rechnen, damit sie nicht mit dem alten Sollmodell stehen bleiben.
    const rangeEndMonth = rangeEnd.slice(0, 7);
    const staleFutureMonths = (
      db
        .prepare(
          `SELECT month FROM overtime_balance
           WHERE userId = ? AND month > ?
           ORDER BY month ASC`
        )
        .all(period.userId, rangeEndMonth) as Array<{ month: string }>
    ).map((row) => row.month);

    // WR-08 (Code-Review Phase 13): Die Rebuild-Liste darf keine ZUKUNFTSMONATE NEU
    // ANLEGEN. `affectedMonths` ist der Anzeige-Zeitraum der Vorschau und enthaelt fuer
    // eine Periode, die vollstaendig in der Zukunft liegt, genau diesen Zukunftsmonat
    // (rangeStart > heute ergibt rangeEnd = rangeStart).
    // `rebuildOvertimeTransactionsForMonth()` legte dafuer eine
    // `overtime_balance`-Zeile mit vollem Monatssoll und ohne Ist an — genau das, was
    // die WR-02-Entscheidung aus Phase 12 ausdruecklich ausschliesst ("Neue Zukunftsmonate
    // anzulegen waere falsch"). Auf `balanceDelta` wirkte sich das nicht aus
    // (`getOvertimeBalance()` filtert `month <= currentMonth`), aber die Zeile blieb
    // stehen, tauchte bei jedem spaeteren Aufruf wieder als `staleFutureMonths` auf und
    // verfaelschte jede Auswertung, die `overtime_balance` ohne Monatsfilter liest.
    //
    // Ein Zukunftsmonat wird deshalb nur noch dann mitgerechnet, wenn fuer ihn BEREITS eine
    // Zeile existiert — dieselbe Regel, die `staleFutureMonths` fuer die Monate jenseits
    // des Bereichsendes anwendet.
    const currentMonth = today.slice(0, 7);
    const materializedMonths = new Set(
      (
        db
          .prepare(`SELECT month FROM overtime_balance WHERE userId = ?`)
          .all(period.userId) as Array<{ month: string }>
      ).map((row) => row.month)
    );

    const rebuildMonths = [
      ...affectedMonths.filter((m) => m <= currentMonth || materializedMonths.has(m)),
      ...staleFutureMonths,
    ];

    // 4. Ist-Basis herstellen — sonst enthielte die gemessene Differenz den Nachhall einer
    //    ausstehenden Selbstheilung.
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(period.userId, month);
    }

    // 5. Messen vorher: frischer Perioden-Cache für genau diesen Messlauf.
    const periodsBefore: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();
    const { targetHours: targetHoursBefore, workingDays } = sumTargetHoursInRange(
      user,
      rangeStart,
      rangeEnd,
      periodsBefore
    );
    const balanceBefore = getOvertimeBalance(period.userId);

    // 6. Schreiben nach DD-11.
    let previousPeriodResult: WorkPeriodCorrectionPreview['previousPeriod'] = null;
    try {
      if (!validFromChanged) {
        updateWorkPeriodValues(period.id, input.weeklyHours, input.workSchedule);
      } else {
        // WR-03 (Code-Review Phase 13): kein Cast. Die Invariante „isFirst && validFromChanged
        // wurde in Schritt 2 abgewiesen" deckt periodIndex === -1 NICHT ab — `findIndex`
        // liefert -1, wenn die Periode nicht in der Kette steht, und -1 ergibt
        // isFirst === false UND previous === null. Ein Cast hätte den Nullwert still
        // unterdrückt und die nächste Zeile hätte ihn dereferenziert (TypeError → 500).
        if (previous === null) {
          throw new WorkPeriodCorrectionValidationError(
            `Periode ${period.id}: keine Vorperiode in der Kette gefunden (Position ${periodIndex}). ` +
            `Es wurde nichts verändert.`
          );
        }
        const previousBeforeShift = previous;
        previousPeriodResult = {
          validFrom: previousBeforeShift.validFrom,
          weeklyHours: previousBeforeShift.weeklyHours,
          newValidTo: input.validFrom,
        };
        withSuspendedChainGuard(() => {
          extendWorkPeriodTo(previousBeforeShift.id, input.validFrom);
          setWorkPeriodValidFrom(period.id, input.validFrom);
          updateWorkPeriodValues(period.id, input.weeklyHours, input.workSchedule);
        });
      }
    } catch (err) {
      if (err instanceof WorkPeriodConflictError) {
        throw new WorkPeriodCorrectionValidationError(err.message, { cause: err });
      }
      throw err;
    }

    // 7. Kettenprüfung — UNBEDINGT, auch ohne Riegel-Aussetzung (T-13-14): ein Sicherheitsnetz
    //    gegen bereits bestehende Kettenschäden, die dieser einzelne Schreibvorgang für sich
    //    allein nicht verursacht hätte. Bei Befund rollt die gesamte Klammer zurück.
    const chainResult = checkPeriodChain(period.userId);
    if (!chainResult.ok) {
      throw new WorkPeriodCorrectionValidationError(
        `Die Periodenkette wäre nach dieser Korrektur ungültig: ${chainResult.findings.join(' ')}`
      );
    }

    // 8. Nachrechnen: derselbe begrenzte Bereich, jetzt mit der korrigierten Periode.
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(period.userId, month);
    }

    // 9. Messen nachher: zweiter, frischer Perioden-Cache — der erste hat die alten
    //    Perioden gecacht.
    const periodsAfter: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();
    const { targetHours: targetHoursAfter } = sumTargetHoursInRange(
      user,
      rangeStart,
      rangeEnd,
      periodsAfter
    );
    const balanceAfter = getOvertimeBalance(period.userId);
    const balanceDelta = Math.round((balanceAfter - balanceBefore) * 100) / 100;

    // 10. Vorschau zusammensetzen — period trägt die Werte VOR der Korrektur (Periodenkennung
    //     im Dialog).
    const preview: WorkPeriodCorrectionPreview = {
      periodId: period.id,
      userId: period.userId,
      isRetroactive,
      rangeFrom: rangeStart,
      rangeTo: rangeEnd,
      workingDays,
      targetHoursBefore,
      targetHoursAfter,
      targetHoursDelta: Math.round((targetHoursAfter - targetHoursBefore) * 100) / 100,
      balanceBefore,
      balanceAfter,
      balanceDelta,
      isNoOp,
      period: {
        validFrom: period.validFrom,
        validTo: period.validTo,
        weeklyHours: period.weeklyHours,
        workSchedule: period.workSchedule,
      },
      previousPeriod: previousPeriodResult,
      affectedMonths,
    };

    // 11. Die eine Journalbuchung (DD-12) — beim tatsächlichen Speichern, UNBEDINGT.
    //
    //     CR-01 (Code-Review Phase 13): Die Zeile wurde früher nur bei `balanceDelta !== 0`
    //     geschrieben. Der Bestätigungsdialog sagt dem Admin aber genau im Gegenteil zu
    //     („Die Korrektur wird trotzdem als eigener Eintrag festgehalten." /
    //     „Korrektur und Begründung bleiben im Kontoauszug dauerhaft sichtbar."), und der
    //     Fall ist alles andere als exotisch: eine Tagesplanänderung mit gleicher
    //     Wochensumme, eine Verschiebung von validFrom über Tage ohne Sollstunden und jede
    //     Korrektur einer reinen Zukunftsperiode liefern `balanceDelta === 0`. Ohne Zeile
    //     überlebte die Pflichtbegründung ausschließlich in `audit_log.changes`, das keine
    //     Oberfläche darstellt — eine rückwirkende Stammdatenänderung ohne sichtbare Spur,
    //     also genau der Zustand, den REQ-30/D7 verhindern sollen.
    //
    //     Rechenneutral bleibt die Zeile dabei per Konstruktion: `model_change` fliegt aus
    //     jedem Summenpfad (EXCLUDE_JOURNAL_ONLY_TYPES), die Anzeige liefert `hours: 0` und
    //     einen NICHT summierten `documentedDelta`. Eine Zeile mit `hours = 0` verschiebt
    //     ohnehin nichts.
    let transactionId: number | null = null;
    if (!options.dryRun) {
      const description =
        `Periode ab ${toGermanDate(input.validFrom)} korrigiert: ` +
        `${formatWeeklyHoursDe(period.weeklyHours)} → ${formatWeeklyHoursDe(input.weeklyHours)} h/Woche ` +
        `(Grund: ${reason})`;

      // CR-02-Muster (Phase 12): balanceBefore/balanceAfter der Journalzeile stehen auf der
      // JOURNAL-Skala (kumulativer Laufsaldo der Kette), nicht auf der Aggregatskala von
      // overtime_balance. Beide Felder tragen denselben Wert — die Zeile verschiebt den
      // Laufsaldo der Kette um 0, ihre Wirkung steckt bereits in den neu gerechneten
      // Tageszeilen (kritischer Fallstrick: model_change ist eine Journalzeile ohne eigene
      // Rechenwirkung, hours dient nur der Dokumentation der Differenz).
      const journalBalance = getJournalBalanceBeforeDate(period.userId, input.validFrom);

      transactionId = createTransaction({
        userId: period.userId,
        date: input.validFrom,
        type: 'model_change',
        hours: balanceDelta,
        description,
        referenceType: 'work_period',
        referenceId: period.id,
        createdBy: options.createdBy,
        balanceBefore: journalBalance,
        balanceAfter: journalBalance,
        // CR-02 (Phase 13): Eine Korrektur darf dieselbe Periode mehrfach hin- und
        // zurückkorrigieren. Die zweite Korrektur zurück auf einen früher schon einmal
        // verwendeten Wert erzeugt zwangsläufig eine wertgleiche Buchung am selben Tag an
        // derselben Periode — fachlich ein eigener, dokumentationspflichtiger Vorgang, kein
        // Duplikat. Die Eindeutigkeit dieses Pfades sichert der `isNoOp`-Riegel in Schritt 2:
        // eine Korrektur, die nichts ändert, kommt hier gar nicht an.
        allowDuplicate: true,
      });

      // Sicherheitsnetz: createTransaction() kann mit allowDuplicate: true nur noch bei einem
      // echten Schreibfehler null liefern. Im Speicherpfad ist das ein Fehlerzustand — die
      // gesamte Klammer rollt zurück. WorkPeriodCorrectionValidationError statt nacktem Error,
      // damit die Route 400 mit lesbarem Text liefert statt eines generischen 500 (CR-02).
      if (transactionId === null) {
        throw new WorkPeriodCorrectionValidationError(
          'Die Korrektur konnte nicht im Kontoauszug festgehalten werden und wurde deshalb ' +
          'nicht gespeichert. Es wurde nichts verändert — weder die Periode noch der ' +
          'Kontoauszug. Bitte laden Sie die Ansicht neu und versuchen Sie es erneut.'
        );
      }
    }

    // 12. Revisionssichere Protokollierung (WR-05-Muster) — nur beim Speichern, innerhalb
    //     derselben Transaktionsklammer: ein zurückgerollter Vorgang hinterlässt keinen Eintrag.
    if (!options.dryRun) {
      db.prepare(
        `INSERT INTO audit_log (userId, action, entity, entityId, changes)
         VALUES (?, 'update', 'work_period_correction', ?, ?)`
      ).run(
        options.createdBy,
        period.id,
        JSON.stringify({
          affectedUserId: period.userId,
          before: {
            validFrom: period.validFrom,
            weeklyHours: period.weeklyHours,
            workSchedule: period.workSchedule,
          },
          after: {
            validFrom: input.validFrom,
            weeklyHours: input.weeklyHours,
            workSchedule: input.workSchedule,
          },
          rangeStart,
          rangeEnd,
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

    // 13. Protokoll — ausschließlich Zahlen und Datumsangaben, keine Namen, keine Begründung.
    logger.info(
      {
        periodId: period.id,
        userId: period.userId,
        validFrom: input.validFrom,
        balanceDelta,
        dryRun: options.dryRun,
      },
      'Stammdaten-Korrektur berechnet'
    );

    // 14. Trockenlauf: gezielt werfen, damit die gesamte Klammer zurückrollt.
    if (options.dryRun) {
      throw new PreviewRollback<WorkPeriodCorrectionOutcome>({ preview, period: null, transactionId: null });
    }

    const correctedPeriod = getWorkPeriodById(period.id);
    return { preview, period: correctedPeriod, transactionId };
  });

  return runWithPreviewRollback(run);
}
