/**
 * Tagesplan-Typwächter und Wertebereiche — EINE Stelle für alle Schreibwege.
 *
 * WARUM DIESE DATEI EXISTIERT (CR-04, Code-Review Phase 12):
 * `isWorkSchedule()` lag doppelt vor — in `routes/workPeriods.ts` und in
 * `services/workPeriodChangeService.ts` — und prüfte an beiden Stellen ausschließlich
 * "Zahl und endlich". Akzeptiert wurden damit `{ monday: -100, ... }`,
 * `{ monday: 999999, ... }` oder `{ monday: 8.5e15, ... }`. `weeklyHours` wird zwar
 * sorgfältig auf 0..60 begrenzt, aber sobald ein `workSchedule` gesetzt ist, gewinnt dieser
 * (`.claude/CLAUDE.md`: "workSchedule existiert → weeklyHours wird IGNORIERT!") — die
 * Begrenzung lief ins Leere.
 *
 * KONKRETE WIRKUNG des Lecks: Negative Tagessollstunden erzeugen über
 * `sumTargetHoursInRange`/`rebuildOvertimeTransactionsForMonth` negative Soll-Summen und
 * damit einen frei wählbaren, beliebig großen `balanceDelta`, der als `model_change`-Buchung
 * festgeschrieben wird — eine schreibende Gutschrift auf ein Arbeitszeitkonto ohne
 * Obergrenze.
 *
 * Eine Verschärfung, die nur an einer der beiden Kopien ankommt, ist keine Verschärfung.
 * Deshalb liegt der Wächter ab jetzt hier; Route und Service importieren ihn.
 *
 * ABGRENZUNG: `workPeriodService.isWorkSchedule()` bleibt bewusst unangetastet. Der dortige
 * Wächter prüft Tagespläne, die aus der DATENBANK gelesen werden (JSON-Spalte). Ihn zu
 * verschärfen würde bestehende Zeilen unlesbar machen; diese Datei prüft ausschließlich
 * EINGABEN auf dem Schreibweg.
 */

import type { WorkSchedule } from '../types/index.js';

export const WEEKDAY_KEYS: readonly (keyof WorkSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Ein Kalendertag hat 24 Stunden — die Typdokumentation (`types/index.ts`) sagt "0-24". */
export const MAX_DAILY_HOURS = 24;

/** Dieselbe Obergrenze, die `weeklyHours` schon immer hatte (UI-SPEC: "0 und 60"). */
export const MAX_WEEKLY_HOURS = 60;

/**
 * Typwächter für einen EINGEGEBENEN Tagesplan: alle sieben Wochentagsschlüssel vorhanden,
 * jeweils eine endliche Zahl im Bereich 0..24.
 */
export function isWorkSchedule(value: unknown): value is WorkSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return WEEKDAY_KEYS.every((key) => {
    const dayHours = record[key];
    return (
      typeof dayHours === 'number' &&
      Number.isFinite(dayHours) &&
      dayHours >= 0 &&
      dayHours <= MAX_DAILY_HOURS
    );
  });
}

/**
 * Typwächter für einen GESPEICHERTEN Tagesplan (JSON-Spalte): alle sieben
 * Wochentagsschlüssel vorhanden und jeweils eine endliche Zahl — bewusst OHNE
 * Wertebereichsprüfung.
 *
 * WARUM OHNE BEREICH (WR-13): Diese Funktion prüft Bestandsdaten. Eine Zeile mit einem
 * historisch gewachsenen Wert außerhalb 0..24 darf nicht plötzlich als "kein Tagesplan"
 * gelesen werden — das würde stillschweigend die Sollstundenrechnung dieses Nutzers
 * verändern. Für EINGABEN gilt der strengere `isWorkSchedule()` oben.
 */
export function isStoredWorkSchedule(value: unknown): value is WorkSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return WEEKDAY_KEYS.every(
    (key) => typeof record[key] === 'number' && Number.isFinite(record[key])
  );
}

/**
 * Kanonisiert einen Tagesplan zu einer vergleichbaren Zeichenkette: `null` wird zu `'null'`,
 * ein Objekt wird mit SORTIERTEN Schlüsseln und über `Number(...)` normalisierten Werten neu
 * aufgebaut, bevor `JSON.stringify` läuft. Zwei Objekte mit denselben Werten in
 * unterschiedlicher Schlüsselreihenfolge liefern damit dieselbe Zeichenkette.
 *
 * EINE STELLE (WR-11/IN-01): Diese Funktion lag bisher ausschließlich in
 * `workTimeChangeToken.ts` (dort ist sie die Grundlage der HMAC-Signatur). Das Prüfskript
 * `verifyDesktopEffectiveness.ts` verglich stattdessen ROHE JSON-Zeichenketten und zählte
 * zwei inhaltsgleiche Tagespläne mit unterschiedlicher Schlüsselreihenfolge oder
 * Formatierung als Drift. Beide benutzen jetzt diese eine Fassung.
 */
export function canonicalizeWorkSchedule(workSchedule: WorkSchedule | null): string {
  if (workSchedule === null) {
    return 'null';
  }

  const canonical: Record<string, number> = {};
  const sortedKeys = [...WEEKDAY_KEYS].sort();
  for (const key of sortedKeys) {
    canonical[key] = Number(workSchedule[key]);
  }
  return JSON.stringify(canonical);
}

/** Summe der sieben Tageswerte, auf zwei Nachkommastellen gerundet. */
export function sumWorkScheduleHours(workSchedule: WorkSchedule): number {
  const total = WEEKDAY_KEYS.reduce((sum, key) => sum + workSchedule[key], 0);
  return Math.round(total * 100) / 100;
}
