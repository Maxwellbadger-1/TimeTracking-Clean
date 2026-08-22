import type { DayName, WorkSchedule } from '../../types';

/**
 * Reine Entscheidungen des Korrektur-Dialogs (`WorkTimePeriodEditModal.tsx`, Plan 13-08), aus
 * der Komponente gezogen, damit sie ohne vitest (im Desktop projektweit nicht lauffaehig,
 * fehlendes `@babel/runtime`) maschinell geprueft werden koennen
 * (`workTimePeriodEditRules.check.ts`, `npx tsx` + `node:assert`).
 *
 * DD-34 (13-08-PLAN.md): Arbeitstage, Sollstunden und Saldodifferenz werden NIE hier bestimmt —
 * die kommen ausschliesslich aus der Server-Vorschau. Die Funktionen dieser Datei sind reine
 * Formularvalidierung/-Steuerung (Pflichtfelder, Wertebereiche, Nachbarschaftsgrenzen,
 * Knopfbeschriftung) — laut DD-34 ausdruecklich als Bequemlichkeit erlaubt; der eigentliche
 * Riegel steht im Service (Plan 13-03).
 *
 * AUSNAHME seit M-1 (UI-Review Phase 13): "rueckwirkend ja/nein" ist KEINE reine
 * Formularsteuerung. Die Aussage kommt aus der Vorschau (`resolveIsRetroactive()`); der
 * Zeichenkettenvergleich `isRetroactivePeriod()` traegt nur noch den Zustand "noch keine
 * Vorschau" und bildet dort dasselbe Minimum wie der Server.
 */

/** Die sieben Tagesschluessel in fester Reihenfolge — Gegenstueck zu `WEEKDAY_KEYS` im Server
 *  (`workPeriodChangeService.workScheduleEquals()`). */
const WEEKDAY_KEYS: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Obergrenze der Wochensumme eines Tagesplans — Spiegel von `MAX_WEEKLY_HOURS` im Server
 *  (`server/src/utils/workSchedule.ts`). */
export const MAX_WEEKLY_HOURS = 60;

/**
 * WERTVERGLEICH zweier Tagesplaene — feldweise ueber die sieben Tagesschluessel, KEIN
 * `JSON.stringify`.
 *
 * WR-09 (Code-Review Phase 13): Hier stand vorher
 * `JSON.stringify(a) === JSON.stringify(b)`. Das ist schluesselreihenfolgeabhaengig. Der
 * Server verwendet an derselben Stelle `workScheduleEquals()`, das feldweise ueber
 * `WEEKDAY_KEYS` vergleicht. Zwei inhaltsgleiche Tagesplaene mit anderer Schluesselreihenfolge
 * — etwa, wenn der `WorkScheduleEditor` ein Objekt neu aufbaut — galten clientseitig als
 * geaendert, serverseitig als No-Op: Das Formular liess das Speichern zu, der Server
 * antwortete mit 400 „Es wurde nichts geaendert." Zwei Wahrheiten fuer dieselbe Regel, genau
 * das, was `.claude/CLAUDE.md` unter „Dual Calculation System" verbietet.
 */
export function workScheduleEquals(a: WorkSchedule | null, b: WorkSchedule | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return WEEKDAY_KEYS.every((key) => a[key] === b[key]);
}

/** Wochensumme eines Tagesplans — Gegenstueck zu `sumWorkScheduleHours()` im Server. */
export function sumWorkScheduleHours(schedule: WorkSchedule): number {
  return WEEKDAY_KEYS.reduce((sum, key) => sum + schedule[key], 0);
}

/** `validFrom < today`, reiner Zeichenkettenvergleich auf YYYY-MM-DD, kein `Date`. Gleichstand
 *  (Beginn == heute) gilt NICHT als rueckwirkend. */
export function isRetroactivePeriod(validFrom: string, today: string): boolean {
  return validFrom < today;
}

export interface ResolveIsRetroactiveArgs {
  /** `preview.isRetroactive` aus der Server-Vorschau, oder `null`, solange keine vorliegt. */
  previewIsRetroactive: boolean | null;
  /** Der aktuell im Formular stehende Beginn (kann leer sein, wenn das Feld geleert wurde). */
  validFrom: string;
  /** Der Beginn der Periode VOR der Korrektur — die zweite Haelfte des Minimums, das der
   *  Server bildet. */
  originalValidFrom: string;
  today: string;
}

/**
 * „rueckwirkend ja/nein" — DIE EINE Wahrheit fuer Panelfarbe, Badge, Knopfbeschriftung und
 * vor allem fuer die Frage, ob der Bestaetigungsschritt stattfindet.
 *
 * M-1 (UI-Review Phase 13, BLOCKER, REQ-30): Hier stand vorher `isRetroactivePeriod(validFrom,
 * today)` direkt in der Komponente — also eine Clientrechnung auf dem NEUEN Beginn allein. Der
 * Server bildet den neu zu rechnenden Bereich dagegen aus dem MINIMUM von altem und neuem
 * Beginn (`server/src/services/workPeriodCorrectionService.ts`):
 *
 *     const rangeStart = input.validFrom < period.validFrom ? input.validFrom : period.validFrom;
 *     const isRetroactive = rangeStart < today;
 *
 * Verschiebt ein Admin den Beginn einer VERGANGENEN Periode in die ZUKUNFT — laut Hilfstext
 * des Feldes „Gueltig ab" ausdruecklich vorgesehen —, dann sagte der Client „keine
 * Rueckwirkung" (blaues Panel, Badge „Keine Rueckwirkung", Knopf „Korrektur speichern", KEIN
 * Bestaetigungsschritt), waehrend der Server die Vergangenheit ab dem alten Beginn neu
 * rechnete. Im selben Panel stand aus derselben Vorschau der widersprechende Satz „Neu
 * gerechnet wird vom {alter Beginn} bis heute". Genau an dieser Stelle entfiel der einzige
 * Schutz, den REQ-30 fordert.
 *
 * Aufloesung wie im Nachbardialog aus Phase 12 (`WorkTimeChangeModal.tsx` liest an allen drei
 * Stellen `preview.isRetroactive`): Liegt eine Vorschau vor, ist die Serverantwort die
 * Wahrheit. Nur solange keine vorliegt, entscheidet die Vorab-Weiche — und die bildet
 * dasselbe Minimum wie der Server, damit auch der Wartezustand zwischen Eingabe und
 * entprellter Antwort (400 ms) nicht kurz das Gegenteil behauptet. Ohne Vorschau ist der
 * Primaerknopf ohnehin gesperrt (`isPrimaryDisabled`), der Bestaetigungsschritt kann also nie
 * mit dem geschaetzten Wert entscheiden.
 */
export function resolveIsRetroactive(args: ResolveIsRetroactiveArgs): boolean {
  if (args.previewIsRetroactive !== null) return args.previewIsRetroactive;
  // Leeres Feld: der alte Beginn ist der einzige bekannte Wert — nicht '' vergleichen.
  const rangeStart =
    args.validFrom !== '' && args.validFrom < args.originalValidFrom
      ? args.validFrom
      : args.originalValidFrom;
  return isRetroactivePeriod(rangeStart, args.today);
}

/** Knopfbeschriftung des Primaerbuttons — wortgleich aus dem Textbuch (13-UI-SPEC.md). */
export function primaryButtonLabel(isRetroactive: boolean): string {
  return isRetroactive ? 'Korrektur rückwirkend speichern' : 'Korrektur speichern';
}

/** Der Primaerknopf ist gesperrt, solange kein previewToken vorliegt, waehrend gespeichert
 *  wird, oder solange die (getrimmte) Begruendung kuerzer als 10 Zeichen ist. */
export function isPrimaryDisabled(args: {
  hasPreviewToken: boolean;
  isSaving: boolean;
  trimmedReasonLength: number;
}): boolean {
  return !args.hasPreviewToken || args.isSaving || args.trimmedReasonLength < 10;
}

export interface CorrectionFormErrors {
  validFrom?: string;
  weeklyHours?: string;
  reason?: string;
  /** Formularweiter Fehler ohne festes Feld — "nichts geändert" (Formularfehler-Banner,
   *  Reihenfolgeposition 3 im Dialog). */
  formError?: string;
  /** Gesetzt, wenn `validFrom` mit einer Nachbarperiode kollidiert — der Aufrufer ruft damit
   *  `onConflict(conflictPeriodId)`, die Liste hebt diese Zeile hervor (Muster aus Phase 12). */
  conflictPeriodId?: number;
}

export interface ValidateCorrectionFormArgs {
  validFrom: string;
  /** Roher Feldwert (String), wie im Eingabefeld — nicht vorab geparst. */
  weeklyHoursRaw: string;
  reason: string;
  workSchedule: WorkSchedule | null;
  /** Erste Periode: `validFrom` ist im Formular gesperrt — Nachbarschaftsgrenzen entfallen,
   *  weil es keine Vorperiode gibt und das Eintrittsdatum bereits der feste Wert ist. */
  isFirst: boolean;
  hireDate: string | null;
  endDate: string | null;
  previousPeriod: { id: number; validFrom: string } | null;
  nextPeriod: { id: number; validFrom: string } | null;
  /** Werte der Periode VOR der Korrektur — Grundlage der "nichts geändert"-Prüfung. */
  original: {
    validFrom: string;
    weeklyHours: number;
    workSchedule: WorkSchedule | null;
  };
}

/** Anzeige eines ISO-Datums im deutschen Format — niemals über `toISOString().split('T')[0]`. */
function formatGermanDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

/** Wochenstunden in der Schreibweise der Servermeldungen (`formatWeeklyHoursDe()` in
 *  `workPeriodChangeService.ts`): eine Nachkommastelle, deutsches Dezimalkomma. */
function formatWeeklyHoursDe(hours: number): string {
  return hours.toFixed(1).replace('.', ',');
}

/**
 * Liefert die Feldfehler-Zuordnung für das Korrekturformular. Prüfreihenfolge bei `validFrom`:
 * Eintrittsdatum -> Vorperiode -> Nachperiode -> Austrittsdatum (13-UI-SPEC.md, Tabelle
 * "Fehlermeldungen (Validierung)", in dieser Reihenfolge aufgeführt). "Nichts geändert" wird
 * nur geprüft, wenn `validFrom` und `weeklyHours` für sich genommen bereits gültig sind.
 */
export function validateCorrectionForm(args: ValidateCorrectionFormArgs): CorrectionFormErrors {
  const errors: CorrectionFormErrors = {};

  if (!args.isFirst) {
    if (args.hireDate && args.validFrom < args.hireDate) {
      errors.validFrom = `Der Beginn darf nicht vor dem Eintrittsdatum (${formatGermanDate(args.hireDate)}) liegen.`;
    } else if (args.previousPeriod && args.validFrom <= args.previousPeriod.validFrom) {
      errors.validFrom = `Der Beginn muss nach dem ${formatGermanDate(args.previousPeriod.validFrom)} liegen — dem Beginn der vorherigen Periode.`;
      errors.conflictPeriodId = args.previousPeriod.id;
    } else if (args.nextPeriod && args.validFrom >= args.nextPeriod.validFrom) {
      errors.validFrom = `Der Beginn muss vor dem ${formatGermanDate(args.nextPeriod.validFrom)} liegen — dem Beginn der nächsten Periode.`;
      errors.conflictPeriodId = args.nextPeriod.id;
    } else if (args.endDate && args.validFrom > args.endDate) {
      errors.validFrom = `Der Beginn liegt nach dem Austrittsdatum (${formatGermanDate(args.endDate)}).`;
    }
  }

  const weeklyHoursNum = args.weeklyHoursRaw === '' ? Number.NaN : Number(args.weeklyHoursRaw);
  if (args.weeklyHoursRaw === '' || Number.isNaN(weeklyHoursNum)) {
    errors.weeklyHours = 'Wochenstunden sind erforderlich';
  } else if (weeklyHoursNum < 0 || weeklyHoursNum > 60) {
    errors.weeklyHours = 'Wochenstunden müssen zwischen 0 und 60 liegen';
  } else if (
    args.workSchedule !== null &&
    sumWorkScheduleHours(args.workSchedule) > MAX_WEEKLY_HOURS
  ) {
    // WR-09 (Code-Review Phase 13): Der Tagesplan gewinnt gegen weeklyHours — ohne diese
    // Prüfung ist die 0-bis-60-Grenze darüber umgehbar. Der Server weist den Fall bereits ab
    // (`workPeriodCorrectionService.validateCorrectionInput()`); hier fehlte das Gegenstück,
    // sodass das Formular das Speichern zuliess und der Server mit 400 antwortete. Wortgleich
    // zur Servermeldung, damit derselbe Satz erscheint, egal wer ihn erzeugt.
    errors.weeklyHours =
      `Die Summe des Tagesplans (${formatWeeklyHoursDe(sumWorkScheduleHours(args.workSchedule))} h) darf ` +
      `${MAX_WEEKLY_HOURS} Stunden pro Woche nicht überschreiten.`;
  }

  const trimmedReason = args.reason.trim();
  if (!trimmedReason) {
    errors.reason = 'Begründung ist erforderlich';
  } else if (trimmedReason.length < 10) {
    errors.reason = 'Begründung muss mindestens 10 Zeichen lang sein';
  }

  if (!errors.validFrom && !errors.weeklyHours) {
    const nothingChanged =
      args.validFrom === args.original.validFrom &&
      weeklyHoursNum === args.original.weeklyHours &&
      // WR-09: feldweiser Wertvergleich wie im Server, nicht JSON.stringify.
      workScheduleEquals(args.workSchedule, args.original.workSchedule);
    if (nothingChanged) {
      errors.formError = 'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.';
    }
  }

  return errors;
}
