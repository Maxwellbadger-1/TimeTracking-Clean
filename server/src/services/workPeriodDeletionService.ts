/**
 * Work Period Deletion Service — der Schreibweg für „Periode löschen"
 *
 * D2 (13-CONTEXT.md): Löschen ist ein Soft-Delete plus Storno, kein `DELETE`. Die Periode wird
 * über `deletedAt` weggenommen (Projektregel: kein Hard Delete); die zugehörigen Buchungen
 * werden durch GEGENBUCHUNGEN ausgeglichen, die im Kontoauszug sichtbar bleiben — REQ-31
 * wörtlich: „storniert, nicht gelöscht — die Storno-Geschichte bleibt im Auszug sichtbar".
 *
 * VORBILD FÜR DIE GEGENBUCHUNG: `absenceService.ts` — `revertBalancesAfterDeletion()`
 * (Zeile 1327-1373). Kernprinzip 1:1 übertragen: Die Originalbuchung bleibt UNVERÄNDERT
 * stehen (kein UPDATE ihres `hours`-Werts) — eine neue Buchung mit umgekehrtem Vorzeichen
 * neutralisiert sie. Hier zusätzlich über `reversalOf` (Migration 014) als eindeutigen
 * Paarbezug zwischen zwei `overtime_transactions`-Zeilen ergänzt, den `revertBalancesAfterDeletion`
 * noch nicht kannte.
 *
 * DD-14 — DIE FALLGRUBE DIESER PHASE, IN EIGENEN WORTEN:
 * Eine `model_change`-Zeile ist eine reine DOKUMENTATIONSZEILE ohne eigene Rechenwirkung —
 * ihre Wirkung steckt vollständig in den neu gerechneten Tageszeilen (siehe der Kommentar
 * „CR-01" in `overtimeLiveCalculationService.ts`). Die Gegenbuchung, die dieser Dienst beim
 * Löschen anlegt, trägt deshalb `hours = -original.hours`: Das Paar summiert sich in der
 * Datenbank exakt auf 0, und ihre `balanceBefore`/`balanceAfter` tragen denselben,
 * journal-neutralen Wert (`getJournalBalanceBeforeDate()`) — die Zeile verschiebt den
 * Laufsaldo der Kette um 0, genau wie ihr Original. Würde die Gegenbuchung stattdessen
 * TATSÄCHLICH in eine Saldosumme eingehen, käme die Rückabwicklung ZWEIMAL zustande: einmal
 * aus dem Rebuild ab `validFrom` der gelöschten Periode (das ist die echte, gewollte Wirkung,
 * D4) und einmal aus der Gegenbuchung selbst — exakt die in Phase 12 behobene Doppelzählung,
 * wieder eingebaut. Der Nachweis dafür ist Task 2 dieses Plans (der tatsächlich berechnete
 * Saldo nach dem Löschen entspricht dem Saldo vor dem Eintragen, nicht der Journalsumme).
 *
 * DD-15 — WELCHE BUCHUNGEN STORNIERT WERDEN: alle Zeilen mit
 * `userId = period.userId AND referenceType = 'work_period' AND referenceId = period.id AND
 * reversalOf IS NULL`, für die noch keine Gegenbuchung existiert (`NOT EXISTS ... r.reversalOf
 * = ot.id`). Das sind die Umstellungsbuchung aus Phase 12 UND jede Korrekturbuchung derselben
 * Periode aus Plan 13-03 — „die zur Periode gehörenden Korrekturbuchungen" aus D2. Es können
 * mehrere sein, deshalb liefert der Vertrag `reversedTransactions` als Liste.
 *
 * DD-16 — REIHENFOLGE DER SCHREIBSCHRITTE, TRIGGER-VERTRÄGLICH: `softDeleteWorkPeriod()` zuerst
 * (der Update-Riegel überspringt die Prüfung, weil Migration 013 ihm `NEW.deletedAt IS NULL`
 * als Bedingung mitgibt), dann `extendWorkPeriodTo(previous.id, period.validTo)` — die
 * weggenommene Periode ist für die Riegel jetzt unsichtbar (`p.deletedAt IS NULL`), es
 * entsteht weder Überlappung noch Lücke. DER KETTENRIEGEL WIRD HIER NICHT AUSGESETZT — anders
 * als bei der Korrektur (Plan 13-03, DD-11) ist jeder Zwischenzustand dieser Reihenfolge
 * gültig. `checkPeriodChain()` läuft trotzdem unmittelbar danach als Zusicherung, innerhalb
 * derselben Transaktionsklammer.
 *
 * DD-17 — DIE ERSTE PERIODE IST NICHT LÖSCHBAR (D3): Sie hat keine Vorgängerin, die die Lücke
 * schließen könnte. Wird serverseitig geprüft, unabhängig davon, ob die Oberfläche den Knopf
 * bereits ausblendet (13-UI-SPEC, Zustand 23).
 *
 * DD-18 — TEXT DER GEGENBUCHUNG: wörtlich nach 13-UI-SPEC, Textbuch „Kontoauszug —
 * Storno-Paar": `Storno zur Buchung vom {TT.MM.JJJJ}: Periode ab {TT.MM.JJJJ} gelöscht (Grund:
 * {Begründung})`. Das erste Datum ist das `date` der stornierten Originalbuchung, das zweite
 * das `validFrom` der gelöschten Periode.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul.
 *
 * Kontext: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-CONTEXT.md (D2, D3, D4, D6, D7),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-UI-SPEC.md (Fehlertexte, Journaltext),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-04-PLAN.md (DD-14 bis DD-18).
 */

import { db } from '../database/connection.js';
import { getUserById } from './userService.js';
import {
  getWorkPeriodById,
  getWorkPeriodsWithFlags,
  softDeleteWorkPeriod,
  extendWorkPeriodTo,
  checkPeriodChain,
  WorkPeriodConflictError,
} from './workPeriodService.js';
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
  monthsInRange,
  runWithPreviewRollback,
  PreviewRollback,
} from './workPeriodChangeService.js';
import { getTodayString } from '../utils/timezone.js';
import logger from '../utils/logger.js';
import type {
  WorkPeriodDeletionInput,
  WorkPeriodDeletionOutcome,
  WorkPeriodDeletionPreview,
} from '../types/index.js';

/** WR-04-Muster (Phase 12): Obergrenze für die Pflichtbegründung — sie landet unverändert im
 *  Kontoauszug. Lokal übernommen (nicht importiert), weil D1 die Trennung der Aktionen auch in
 *  ihren jeweiligen Validierungsbausteinen verlangt — nur die reinen RECHENBAUSTEINE
 *  (toGermanDate, monthsInRange, PreviewRollback) sind laut Plan 13-02/13-03 gemeinsames Gut. */
const MAX_REASON_LENGTH = 500;

/**
 * WR-04-Muster (Phase 12): C0-/C1-Steuerzeichen ohne die drei, die in einem mehrzeiligen
 * Freitextfeld legitim sind: Tabulator, Zeilenvorschub, Wagenrücklauf. Wortgleiche Kopie aus
 * `workPeriodChangeService.ts`/`workPeriodCorrectionService.ts` (dort nicht exportiert).
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
 * Fehlerklasse für alle serverseitigen Validierungsfehler dieses Vorgangs — eigene Klasse
 * statt Wiederverwendung von `WorkTimeChangeValidationError`/`WorkPeriodCorrectionValidationError`,
 * damit die serverseitige Trennung der drei Aktionen auch im Fehlertyp sichtbar bleibt (D1).
 */
export class WorkPeriodDeletionValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkPeriodDeletionValidationError';
  }
}

/**
 * Prüft die Lösch-Eingabe serverseitig — nicht nur in der Route (D7). `isFirst` wird
 * UNBEDINGT geprüft (DD-17, 13-UI-SPEC Zustand 23: „Fall tritt nur bei umgangener Oberfläche
 * auf, muss aber tragen") — auch im Trockenlauf, denn eine Vorschau auf eine nicht löschbare
 * Periode wäre irreführend. Die Begründung wird ausschließlich im Speicherpfad geprüft
 * (`dryRun === false`), damit die Vorschau schon vor dem Eintippen der Begründung berechnet
 * werden kann.
 */
function validateDeletionInput(
  input: WorkPeriodDeletionInput,
  isFirst: boolean,
  dryRun: boolean
): void {
  if (isFirst) {
    throw new WorkPeriodDeletionValidationError(
      'Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen.'
    );
  }

  if (!dryRun) {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new WorkPeriodDeletionValidationError('Begründung ist erforderlich');
    }
    const trimmedReason = input.reason.trim();
    if (trimmedReason.length < 10) {
      throw new WorkPeriodDeletionValidationError('Begründung muss mindestens 10 Zeichen lang sein');
    }
    if (trimmedReason.length > MAX_REASON_LENGTH) {
      throw new WorkPeriodDeletionValidationError(
        `Begründung darf höchstens ${MAX_REASON_LENGTH} Zeichen lang sein.`
      );
    }
    if (containsControlCharacters(trimmedReason)) {
      throw new WorkPeriodDeletionValidationError('Begründung darf keine Steuerzeichen enthalten.');
    }
  }
}

/**
 * Berechnet das Löschen einer Periode und wendet es wahlweise an (`dryRun: false`) oder
 * verwirft es nach der Messung (`dryRun: true`) — dieselbe Trockenlauf-/Speicher-Mechanik wie
 * `applyWorkTimeChange()`/`correctWorkPeriod()` (`runWithPreviewRollback`), kein zweiter
 * Rechenweg. Wirft `WorkPeriodDeletionValidationError` bei jedem Validierungs- oder
 * Kettenproblem; in diesem Fall wird nichts geschrieben.
 */
export function deleteWorkPeriod(
  input: WorkPeriodDeletionInput,
  options: { dryRun: boolean; createdBy: number | null }
): WorkPeriodDeletionOutcome {
  const run = db.transaction((): WorkPeriodDeletionOutcome => {
    // 1. Periode und Nutzer laden.
    const period = getWorkPeriodById(input.periodId);
    if (!period) {
      throw new WorkPeriodDeletionValidationError(`Periode ${input.periodId} existiert nicht.`);
    }
    const user = getUserById(period.userId);
    if (!user) {
      throw new WorkPeriodDeletionValidationError(`Nutzer ${period.userId} existiert nicht.`);
    }

    // 2. Nachbarschaft in der Kette (DD-6-Muster aus Plan 13-02): index 0 der aufsteigend nach
    //    validFrom sortierten, nicht weggenommenen Kette ist die erste Periode.
    const periodsWithFlags = getWorkPeriodsWithFlags(period.userId);
    const periodIndex = periodsWithFlags.findIndex((p) => p.id === period.id);
    const isFirst = periodIndex === 0;
    // Ist die Periode nicht die erste, garantiert Schritt-3-Validierung (validateDeletionInput
    // wirft sonst DD-17), dass eine Vorperiode existiert.
    const previous = periodIndex > 0 ? periodsWithFlags[periodIndex - 1] : null;

    // 3. Validierung (D7/DD-17, Meldungstexte wörtlich aus 13-UI-SPEC).
    validateDeletionInput(input, isFirst, options.dryRun);
    const previousPeriod = previous as NonNullable<typeof previous>;

    // 3b. WR-04-Muster: Ab hier wird ausschließlich die GETRIMMTE Begründung geschrieben.
    const reason = input.reason.trim();

    // 4. Zeitraum (D4): rebuildFrom = validFrom der gelöschten Periode, nicht Kontobeginn.
    const today = getTodayString();
    const rebuildFrom = period.validFrom;
    const rangeEnd = rebuildFrom > today ? rebuildFrom : today;
    const affectedMonths = monthsInRange(rebuildFrom, rangeEnd);

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

    const rebuildMonths = [...affectedMonths, ...staleFutureMonths];

    // 5. Ist-Basis herstellen — sonst enthielte die gemessene Differenz den Nachhall einer
    //    ausstehenden Selbstheilung.
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(period.userId, month);
    }
    const balanceBefore = getOvertimeBalance(period.userId);

    // 6. Die zu stornierenden Buchungen nach DD-15 erheben — die Umstellungsbuchung aus
    //    Phase 12 UND jede Korrekturbuchung derselben Periode aus Plan 13-03, für die noch
    //    keine Gegenbuchung existiert.
    const reversedTransactions = db
      .prepare(
        `SELECT ot.id, ot.date, ot.hours
         FROM overtime_transactions ot
         WHERE ot.userId = ?
           AND ot.referenceType = 'work_period'
           AND ot.referenceId = ?
           AND ot.reversalOf IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM overtime_transactions r WHERE r.reversalOf = ot.id
           )
         ORDER BY ot.id ASC`
      )
      .all(period.userId, period.id) as Array<{ id: number; date: string; hours: number }>;

    // 7. Schreiben nach DD-16: Soft-Delete zuerst, dann Lückenschluss über die Vorperiode.
    //    Der Kettenriegel wird HIER NICHT ausgesetzt — jeder Zwischenzustand dieser
    //    Reihenfolge ist gültig (anders als beim Verschieben von validFrom in Plan 13-03).
    try {
      softDeleteWorkPeriod(period.id, options.createdBy);
      extendWorkPeriodTo(previousPeriod.id, period.validTo);
    } catch (err) {
      if (err instanceof WorkPeriodConflictError) {
        throw new WorkPeriodDeletionValidationError(err.message, { cause: err });
      }
      throw err;
    }

    // 8. Kettenprüfung — als Zusicherung, innerhalb derselben Transaktionsklammer (D6). Bei
    //    Befund rollt die gesamte Klammer zurück.
    const chainResult = checkPeriodChain(period.userId);
    if (!chainResult.ok) {
      throw new WorkPeriodDeletionValidationError(
        `Die Periodenkette wäre nach dem Löschen ungültig: ${chainResult.findings.join(' ')}`
      );
    }

    // 9. Nachrechnen: derselbe begrenzte Bereich, jetzt ohne die gelöschte Periode in der
    //    Kette (D4). Die eigentliche Rückabwicklung des Saldos kommt AUSSCHLIESSLICH aus
    //    diesem Rebuild — nicht aus der Gegenbuchung (DD-14).
    for (const month of rebuildMonths) {
      rebuildOvertimeTransactionsForMonth(period.userId, month);
    }
    const balanceAfter = getOvertimeBalance(period.userId);
    const balanceDelta = Math.round((balanceAfter - balanceBefore) * 100) / 100;

    // 10. Vorschau zusammensetzen — deletedPeriod trägt die Werte VOR dem Wegnehmen.
    const preview: WorkPeriodDeletionPreview = {
      periodId: period.id,
      userId: period.userId,
      deletedPeriod: {
        validFrom: period.validFrom,
        validTo: period.validTo,
        weeklyHours: period.weeklyHours,
      },
      previousPeriod: {
        validFrom: previousPeriod.validFrom,
        weeklyHours: previousPeriod.weeklyHours,
        newValidTo: period.validTo,
      },
      reversedTransactions: reversedTransactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        hours: tx.hours,
      })),
      rebuildFrom,
      balanceBefore,
      balanceAfter,
      balanceDelta,
      affectedMonths,
    };

    // 11. Gegenbuchungen nur im Speicherpfad, eine je erhobener Originalzeile (DD-14/DD-18).
    //     hours = -original.hours: die Summe des Paares ist exakt 0 — auch eine naive
    //     SUM(hours) über overtime_transactions bleibt unbeeinflusst. balanceBefore/
    //     balanceAfter tragen denselben Wert (journal-neutral, CR-02-Muster) — die
    //     TATSÄCHLICHE Rückabwicklung des Saldos kommt allein aus dem Rebuild in Schritt 9.
    const reversalTransactionIds: number[] = [];
    if (!options.dryRun) {
      for (const original of reversedTransactions) {
        const description =
          `Storno zur Buchung vom ${toGermanDate(original.date)}: ` +
          `Periode ab ${toGermanDate(period.validFrom)} gelöscht (Grund: ${reason})`;

        const journalBalance = getJournalBalanceBeforeDate(period.userId, original.date);

        const reversalId = createTransaction({
          userId: period.userId,
          date: original.date,
          type: 'model_change',
          hours: -original.hours,
          description,
          referenceType: 'work_period',
          referenceId: period.id,
          reversalOf: original.id,
          createdBy: options.createdBy,
          balanceBefore: journalBalance,
          balanceAfter: journalBalance,
        });

        // CR-06-Muster (Phase 12): createTransaction() ist idempotent und liefert null bei
        // einem Duplikat. Eine stillschweigend ausgelassene Gegenbuchung wäre genau die
        // "bereinigte Lücke", die REQ-31 verbietet — die gesamte Klammer rollt zurück.
        if (reversalId === null) {
          throw new Error(
            `Löschen der Periode ${period.id} (Nutzer ${period.userId}): die Gegenbuchung ` +
            `zur Original-Buchung ${original.id} wurde als Duplikat verworfen — es wird für ` +
            `jede erhobene Originalzeile genau eine Gegenbuchung erwartet.`
          );
        }

        reversalTransactionIds.push(reversalId);
      }
    }

    // 12. Revisionssichere Protokollierung (WR-05-Muster) — nur beim Speichern, innerhalb
    //     derselben Transaktionsklammer: ein zurückgerollter Vorgang hinterlässt keinen Eintrag.
    if (!options.dryRun) {
      db.prepare(
        `INSERT INTO audit_log (userId, action, entity, entityId, changes)
         VALUES (?, 'delete', 'work_period', ?, ?)`
      ).run(
        options.createdBy,
        period.id,
        JSON.stringify({
          affectedUserId: period.userId,
          deletedPeriod: preview.deletedPeriod,
          previousPeriodNewValidTo: preview.previousPeriod.newValidTo,
          rebuildFrom,
          balanceBefore,
          balanceAfter,
          balanceDelta,
          reason,
          reversalTransactionIds,
        })
      );
    }

    // 13. Protokoll — ausschließlich Ids, Datumsangaben und Zahlen, keine Namen, keine
    //     Begründung (T-13-19).
    logger.info(
      {
        periodId: period.id,
        userId: period.userId,
        rebuildFrom,
        balanceDelta,
        reversedCount: reversedTransactions.length,
        dryRun: options.dryRun,
      },
      'Periode gelöscht'
    );

    // 14. Trockenlauf: gezielt werfen, damit die gesamte Klammer zurückrollt.
    if (options.dryRun) {
      throw new PreviewRollback<WorkPeriodDeletionOutcome>({ preview, reversalTransactionIds: [] });
    }

    return { preview, reversalTransactionIds };
  });

  return runWithPreviewRollback(run);
}
