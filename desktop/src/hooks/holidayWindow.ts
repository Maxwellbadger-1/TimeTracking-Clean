/**
 * Das Jahresfenster, in dem `useMultiYearHolidays()` Feiertage laedt.
 *
 * WR-21 (Code-Review Phase 12): `useMultiYearHolidays()` laedt ausschliesslich +/- 2 Jahre um
 * "heute". Ein Antrag ausserhalb dieses Fensters — bei Langzeitplanung oder Nacherfassung
 * durchaus real — findet keinen einzigen Feiertag, und die Abwesenheitsvorschau zaehlt sie
 * als Arbeitstage. Ein Fehlerzustand entstand dabei nicht: die zu hohe Zahl wurde ohne
 * Vorbehalt angezeigt und ueber `requiredDays > vacationDays` auch zur Blockade herangezogen.
 *
 * Die Grenze steht deshalb hier benannt und abfragbar, statt nur implizit im Ladecode. Und
 * sie liegt in einem eigenen, abhaengigkeitsfreien Modul, weil `useHolidays.ts` ueber
 * `api/client` auch `import.meta.env` hereinzieht und ausserhalb von Vite nicht ladbar ist —
 * so bleibt die Regel mit `npx tsx` + `node:assert` pruefbar (vitest ist im Desktop
 * projektweit kaputt).
 */

export const HOLIDAY_WINDOW_RADIUS_YEARS = 2;

/** Die Jahre, die `useMultiYearHolidays()` tatsaechlich laedt. */
export function getHolidayWindowYears(reference: Date = new Date()): number[] {
  const currentYear = reference.getFullYear();
  const years: number[] = [];
  for (let offset = -HOLIDAY_WINDOW_RADIUS_YEARS; offset <= HOLIDAY_WINDOW_RADIUS_YEARS; offset++) {
    years.push(currentYear + offset);
  }
  return years;
}

/**
 * Liegt das Jahr im geladenen Feiertagsfenster?
 *
 * Bewusst gegen das FENSTER geprueft, nicht gegen die gelieferten Daten: ein Jahr ohne
 * Treffer in `holidays` waere sonst von einem ungeladenen Jahr nicht zu unterscheiden.
 */
export function isYearInHolidayWindow(year: number, reference: Date = new Date()): boolean {
  if (!Number.isFinite(year)) return false;
  const currentYear = reference.getFullYear();
  return Math.abs(year - currentYear) <= HOLIDAY_WINDOW_RADIUS_YEARS;
}
