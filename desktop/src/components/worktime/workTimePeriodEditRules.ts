import type { WorkSchedule } from '../../types';

/**
 * Reine Entscheidungen des Korrektur-Dialogs (`WorkTimePeriodEditModal.tsx`, Plan 13-08), aus
 * der Komponente gezogen, damit sie ohne vitest (im Desktop projektweit nicht lauffaehig,
 * fehlendes `@babel/runtime`) maschinell geprueft werden koennen
 * (`workTimePeriodEditRules.check.ts`, `npx tsx` + `node:assert`).
 *
 * DD-34 (13-08-PLAN.md): Arbeitstage, Sollstunden und Saldodifferenz werden NIE hier bestimmt —
 * die kommen ausschliesslich aus der Server-Vorschau. Die vier Funktionen dieser Datei sind
 * reine Formularvalidierung/-Steuerung (Pflichtfelder, Wertebereiche, Nachbarschaftsgrenzen,
 * Knopfbeschriftung, "rueckwirkend ja/nein" als reiner Zeichenkettenvergleich fuer die
 * Panel-/Knopfsteuerung) — laut DD-34 ausdruecklich als Bequemlichkeit erlaubt; der eigentliche
 * Riegel steht im Service (Plan 13-03).
 */

/** `validFrom < today`, reiner Zeichenkettenvergleich auf YYYY-MM-DD, kein `Date`. Gleichstand
 *  (Beginn == heute) gilt NICHT als rueckwirkend. */
export function isRetroactivePeriod(validFrom: string, today: string): boolean {
  return validFrom < today;
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
      JSON.stringify(args.workSchedule) === JSON.stringify(args.original.workSchedule);
    if (nothingChanged) {
      errors.formError = 'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.';
    }
  }

  return errors;
}
