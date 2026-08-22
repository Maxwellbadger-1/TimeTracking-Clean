import { formatHours } from '../../utils/timeUtils';
import type { OvertimeTransactionRow } from '../../hooks/useWorkTimeAccounts';

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

/**
 * Phase 13 (REQ-31, DD-25/DD-41/DD-43): Zustand, Klartextbezug und Beleg-Chip-Auswahl des
 * Storno-Paars im Kontoauszug. Reine Funktionen, damit sie ohne Renderer per `npx tsx` +
 * `node:assert` pruefbar sind (13-UI-SPEC.md Abschnitt 5, Zustaende 26-28).
 */

/** DD-41: 'storniert' auf der stornierten Originalzeile, 'Storno' auf der Gegenbuchung, sonst null. */
export function reversalStateLabel(
  row: Pick<OvertimeTransactionRow, 'reversalOf' | 'reversedBy'>
): 'storniert' | 'Storno' | null {
  if (row.reversedBy) return 'storniert';
  if (row.reversalOf) return 'Storno';
  return null;
}

/** DD-43: Zielzeile des Beleg-Chips — die Id der jeweils anderen Zeile des Storno-Paars. */
export function reversalPartnerId(
  row: Pick<OvertimeTransactionRow, 'reversalOf' | 'reversedBy'>
): number | null {
  return row.reversalOf ?? row.reversedBy ?? null;
}

/**
 * Zweite Beschreibungszeile des Storno-Paars.
 *
 * Originalzeile: Das Datum ist `reversedAt` — der Zeitstempel der Gegenbuchung
 * (`overtime_transactions.createdAt`, server/src/services/overtimeLiveCalculationService.ts:527),
 * dasselbe Spaltenformat wie `createdAt`. Deshalb ueber `formatCreatedAtDe()` formatiert,
 * NICHT ueber `new Date(iso + 'T12:00:00')`: Jenes Muster ist fuer reine Datumsstrings
 * (YYYY-MM-DD) gedacht — bei einem UTC-Zeitstempel waere es exakt der Timezone-Bug, den
 * `formatCreatedAtDe()` oben in diesem Modul dokumentiert behebt (`.claude/CLAUDE.md`
 * verbietet genau diese Fehlerklasse — UTC-Zeitstempel per Substring als Ortstag
 * behandeln — ausdruecklich).
 *
 * Gegenbuchung: Das Datum ist `row.date` — ein reines Datumsfeld (der Stichtag der Periode,
 * den beide Zeilen des Paares teilen, 13-UI-SPEC.md „Welches Datum die Storno-Zeile
 * traegt"). Dafuer ist `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')` das im
 * Projekt etablierte Muster fuer Datumsstrings ohne Uhrzeit (OvertimeTransactions.tsx:230,
 * WorkTimePeriodList.tsx:46 u.a.).
 */
export function reversedNoteLine(
  row: Pick<
    OvertimeTransactionRow,
    'reversalOf' | 'reversedBy' | 'reversedAt' | 'reversedByName' | 'referenceId' | 'date'
  >
): string | null {
  if (row.reversedBy) {
    const dateStr = row.reversedAt ? formatCreatedAtDe(row.reversedAt) : '';
    const namePart = row.reversedByName ? ` von ${row.reversedByName}` : '';
    return `Storniert am ${dateStr}${namePart} · Beleg #${row.referenceId}`;
  }
  if (row.reversalOf) {
    const dateStr = new Date(`${row.date}T12:00:00`).toLocaleDateString('de-DE');
    return `Gleicht die Buchung vom ${dateStr} aus · Beleg #${row.referenceId}`;
  }
  return null;
}

/** DD-43: Sichtbarer Text des Beleg-Chips, identisch auf beiden Zeilen des Paares. */
export function receiptChipLabel(referenceId: number | undefined): string {
  return `Beleg #${referenceId}`;
}

/** DD-43: `aria-label` des Beleg-Chips, je nach Rolle der Zeile im Storno-Paar. */
export function receiptChipAriaLabel(isOriginalRow: boolean): string {
  return isOriginalRow
    ? 'Zugehörige Storno-Buchung anzeigen'
    : 'Zugehörige Ursprungsbuchung anzeigen';
}

/**
 * DD-43: Auswahl unter den drei Fehlfaellen des Beleg-Chip-Klicks plus dem Erfolgsfall
 * (13-UI-SPEC.md Abschnitt 5, Zustaende 26-28). Reihenfolge bindend: Abschneidegrenze wird
 * VOR dem Zeitraumfilter geprueft, weil eine volle Liste den wahren Grund verdeckt.
 */
export function resolveReceiptJumpOutcome(args: {
  partnerFound: boolean;
  loadedCount: number;
  limit?: number;
  month?: number;
  year?: number;
}): { kind: 'jump' } | { kind: 'toast'; message: string } {
  if (args.partnerFound) return { kind: 'jump' };

  if (args.limit !== undefined && args.loadedCount >= args.limit) {
    return {
      kind: 'toast',
      message: `Die zugehörige Buchung ist in dieser Ansicht nicht geladen — angezeigt werden nur die letzten ${args.limit} Buchungen. Wählen Sie einen engeren Zeitraum.`,
    };
  }

  if (args.month !== undefined && args.year !== undefined) {
    // Tag 15: identisch zum Muster in WorkTimeChangeModal.tsx (Monatsname aus einem
    // Datum ableiten, ohne Monatsgrenzen-Verschiebung durch Zeitzonen zu riskieren).
    const monthLabel = new Date(args.year, args.month - 1, 15).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
    return {
      kind: 'toast',
      message: `Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums (${monthLabel}).`,
    };
  }

  return {
    kind: 'toast',
    message: `Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums (${args.year}).`,
  };
}
