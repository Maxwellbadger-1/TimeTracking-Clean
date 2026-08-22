import { formatHours } from '../../utils/timeUtils';

/**
 * Reine Formatierhilfen des Ueberstunden-Kontoauszugs.
 *
 * Sie liegen bewusst neben der Komponente statt in ihr: `OvertimeTransactions.tsx` zieht ueber
 * `useWorkTimeAccounts` -> `api/client` auch `import.meta.env` herein und ist damit ausserhalb
 * von Vite nicht ladbar. Als eigenes Modul sind beide Funktionen mit `npx tsx` + `node:assert`
 * pruefbar (vitest ist im Desktop projektweit kaputt, @babel/runtime fehlt).
 */

/**
 * CR-04 (Code-Review Phase 12): `createdAt` kommt aus `overtime_transactions.createdAt` mit
 * dem Spaltendefault `datetime('now')`. SQLite liefert dort IMMER UTC im Format
 * 'YYYY-MM-DD HH:MM:SS' — unabhaengig von `TZ=Europe/Berlin` im Serverprozess.
 *
 * Die Vorfassung schnitt mit `createdAt.slice(0, 10)` den UTC-Tag heraus und behandelte ihn
 * anschliessend als Ortstag. Ein Wechsel, den ein Admin am 22.08. um 01:30 Ortszeit eintraegt,
 * steht als '2026-08-21 23:30:00' in der Datenbank und wurde als "eingetragen am 21.08.2026"
 * angezeigt — ein Tag zu frueh, taeglich im Fenster 00:00-02:00 (Sommerzeit) bzw. 00:00-01:00
 * (Winterzeit). Das ist dieselbe Fehlerklasse, die `.claude/CLAUDE.md` unter
 * "toISOString().split('T')[0] -> Timezone bugs!" verbietet, nur ueber `slice(0, 10)` statt
 * `split('T')` — und sie sitzt im Pruefpfad einer Personaldatenaenderung (REQ-29).
 *
 * Richtig ist, den Zeitstempel als das zu behandeln, was er ist: ein UTC-Moment. Traegt er
 * bereits eine Zonenkennzeichnung (ISO mit 'Z' oder Offset), wird sie respektiert. Ein
 * unlesbarer Wert liefert '' — der Aufrufer laesst die Angabe dann ersatzlos weg, statt
 * "Invalid Date" in einen Pruefpfad zu schreiben.
 */
export function formatCreatedAtDe(createdAt: string): string {
  const trimmed = createdAt.trim();
  if (trimmed === '') return '';
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = trimmed.replace(' ', 'T');
  const moment = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(moment.getTime()) ? '' : moment.toLocaleDateString('de-DE');
}

/**
 * Server-CR-01 (Phase 12): Die `model_change`-Zeile ist eine reine Dokumentationszeile. Ihr
 * `hours` ist bewusst 0, weil die Wirkung der Umstellung bereits in den neu gerechneten
 * Tageszeilen steckt; wuerde sie zusaetzlich summieren, laege die Summe der angezeigten
 * Zeilen um genau diesen Betrag ueber dem daneben angezeigten Saldo.
 *
 * "0,0 h" ist fuer den Leser aber falsch: die Umstellung HAT einen Betrag bewirkt, er steht
 * nur nicht in dieser Zeile. Deshalb zeigt die Stundenspalte den dokumentierten Betrag aus
 * `documentedDelta` — vorzeichenbehaftet, mit "± 0:00h" fuer die Nulldifferenz (dasselbe
 * Muster wie im Vorschaupanel des Wechsel-Dialogs).
 */
export function formatDocumentedDelta(delta: number | undefined): string {
  const value = delta ?? 0;
  if (!Number.isFinite(value) || value === 0) return '± 0:00h';
  return `${value > 0 ? '+' : ''}${formatHours(value)}`;
}

/** Farbklasse zur dokumentierten Differenz — gray bei 0, sonst gruen/rot wie im Bestand. */
export function documentedDeltaToneClass(delta: number | undefined): string {
  const value = delta ?? 0;
  if (!Number.isFinite(value) || value === 0) return 'text-gray-600 dark:text-gray-400';
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}
