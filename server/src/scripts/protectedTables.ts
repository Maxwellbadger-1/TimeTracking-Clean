/**
 * Nebenwirkungsfreies Modul mit den fuenf nach D-01 geschuetzten Tabellen (Phase 14.2,
 * 14.2-01-PLAN.md, Task 1) und den beiden Messfunktionen, die bislang nur lokal und nicht
 * importierbar in `purgeFutureOvertimeRows.ts` standen (14.2-PATTERNS.md, Abschnitt
 * „Pruefsummen-Muster").
 *
 * Dieses Modul enthaelt KEINEN Top-Level-Code, der eine Datenbank oeffnet, und importiert
 * NICHT `../database/connection.js` — jeder Aufrufer entscheidet selbst, wie und in welchem
 * Modus (readonly oder schreibend) die Datenbank geoeffnet wird.
 */

import { createHash } from 'node:crypto';
// Reiner Typ-Import — vom Compiler restlos entfernt, erzeugt zur Laufzeit keinen Import
// (dieselbe Begruendung wie in purgeFutureOvertimeRows.ts und snapshotBalances.ts).
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

/** Die fuenf nach D-01 geschuetzten Tabellen — in ihnen wird keine Zeile angefasst. */
export const PROTECTED_TABLES: readonly string[] = [
  'time_entries',
  'absence_requests',
  'overtime_corrections',
  'vacation_balance',
  'vacation_transactions',
];

export interface ProtectedMetric {
  table: string;
  rowCount: number;
  checksum: string;
}

/**
 * Zeilenzahl und SHA-256 ueber alle Zeilen einer Tabelle (nach `id` sortiert, JSON-
 * Darstellung) — dasselbe Verfahren wie in den Nachweisen zu BL-01 bis BL-04 und D-08
 * (Phase 14.1), damit die Werte ueber die ganze Phase hinweg vergleichbar bleiben. Der
 * Rumpf ist zeichengleich zur bisherigen lokalen Fassung in `purgeFutureOvertimeRows.ts`.
 */
export function measureProtectedTables(db: BetterSqlite3Database): ProtectedMetric[] {
  return PROTECTED_TABLES.map((table) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all() as unknown[];
    const checksum = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    return { table, rowCount: rows.length, checksum };
  });
}

/**
 * Rumpf zeichengleich zur bisherigen lokalen Fassung in `purgeFutureOvertimeRows.ts`.
 */
export function printProtectedTables(label: string, metrics: ProtectedMetric[]): void {
  console.log(`=== D-01 — die fuenf geschuetzten Tabellen (${label}) ===`);
  for (const m of metrics) {
    console.log(
      `  ${m.table.padEnd(22)} Zeilen=${String(m.rowCount).padStart(5)}  sha256=${m.checksum}`
    );
  }
}

/**
 * Markdown-Tabelle mit den Spalten `Tabelle | Zeilen | sha256`, damit die Werte ohne
 * Nacharbeit in ein SUMMARY oder Nachweisdokument kopiert werden koennen.
 */
export function formatProtectedTablesMarkdown(metrics: ProtectedMetric[]): string {
  const header = '| Tabelle | Zeilen | sha256 |\n|---|---:|---|';
  const rows = metrics.map((m) => `| ${m.table} | ${m.rowCount} | ${m.checksum} |`);
  return [header, ...rows].join('\n');
}
