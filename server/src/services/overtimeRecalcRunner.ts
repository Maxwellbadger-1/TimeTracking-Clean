/**
 * Überstunden-Neuberechnungslauf — WR-05 (Phase 9.1, Plan 09.1-04)
 *
 * Der Kern von D-01: Diese Nutzerschleife läuft ausschließlich über die geteilte
 * Verbindung des Serverprozesses (`db` aus `../database/connection.js`). Dieses Modul
 * darf NIEMALS eine eigene Datenbankverbindung mit dem SQLite-Treiber öffnen oder die
 * geteilte Verbindung am Ende beenden. Genau das war die Ursache des Vorfalls
 * `.planning/debug/wal-abgehaengt-20260827.md`: der bisherige Lauf (`scripts/fix-overtime.ts`)
 * öffnete als eigener `npx tsx`-Prozess eine zweite Verbindung auf `production.db` und
 * beendete sie am Ende selbst — SQLite räumte dabei WAL und SHM auf, sobald der beendende
 * Prozess kurz die exklusive Sperre bekam (nachts um 03:00, wenn der Server idle ist), und
 * der Serverprozess schrieb danach in eine aus dem Dateisystem gelöste Datei. Das passierte
 * jede Nacht.
 *
 * D-05: Ein einzelner defekter Datensatz darf die übrige Belegschaft in diesem Lauf nicht
 * blockieren. Deshalb: kein `throw`, kein `break`, kein harter Prozessabbruch in der
 * Schleife — jeder Fehler wird pro Nutzer abgefangen, strukturiert mit `userId`
 * protokolliert, und am Ende steht eine Bilanzzeile mit `verarbeitet`/`fehlgeschlagen`.
 *
 * Scheduler (Task 2), Serverstart (Task 3) und das Handbetriebs-Werkzeug (Plan 09.1-05)
 * rufen alle dieselbe Funktion `runOvertimeRecalcForAllUsers()` auf — genau eine Kopie
 * dieser Logik statt einer zweiten (Befund A-1 aus Phase 9).
 */

import { db } from '../database/connection.js';
import { ensureOvertimeBalanceEntries } from './overtimeService.js';
import { getCurrentMonth } from '../utils/timezone.js';
import logger from '../utils/logger.js';

export interface OvertimeRecalcBilanz {
  anlass: string;
  gesamt: number;
  verarbeitet: number;
  fehlgeschlagen: number;
  fehler: Array<{ userId: number; meldung: string }>;
  dauerMs: number;
}

interface RecalcUserRow {
  id: number;
}

/**
 * Führt `ensureOvertimeBalanceEntries()` für einen Nutzerkreis aus — entweder die
 * übergebenen `userIds` (Handbetrieb, Tests) oder alle nicht-gelöschten Nutzer
 * (Nachtlauf, Serverstart-Anlauf).
 *
 * Wirft selbst nicht, außer die Nutzerabfrage schlägt fehl — dieser Fall bleibt bewusst
 * unbehandelt und wird vom äußeren `try/catch` des Aufrufers gefangen (Task 2/3).
 */
export async function runOvertimeRecalcForAllUsers(options: {
  anlass: 'nachtlauf' | 'serverstart' | 'handbetrieb';
  userIds?: number[];
}): Promise<OvertimeRecalcBilanz> {
  const { anlass } = options;
  const startZeit = Date.now();

  let userIds: number[];
  if (options.userIds) {
    userIds = options.userIds;
  } else {
    const rows = db
      .prepare('SELECT id FROM users WHERE deletedAt IS NULL ORDER BY id')
      .all() as RecalcUserRow[];
    userIds = rows.map((row) => row.id);
  }

  const monat = getCurrentMonth();
  const gesamt = userIds.length;

  logger.info({ anlass, gesamt }, `🔄 Überstunden-Neuberechnungslauf gestartet (${anlass})`);

  let verarbeitet = 0;
  let fehlgeschlagen = 0;
  const fehler: Array<{ userId: number; meldung: string }> = [];

  for (const userId of userIds) {
    try {
      await ensureOvertimeBalanceEntries(userId, monat);
      verarbeitet++;
    } catch (error) {
      fehlgeschlagen++;
      const meldung = error instanceof Error ? error.message : String(error);
      fehler.push({ userId, meldung });
      logger.error(
        { err: error, userId, anlass, monat },
        '❌ Überstunden-Neuberechnung für einen Nutzer fehlgeschlagen'
      );
    }
  }

  const dauerMs = Date.now() - startZeit;
  const bilanz: OvertimeRecalcBilanz = { anlass, gesamt, verarbeitet, fehlgeschlagen, fehler, dauerMs };

  const meldung = `Überstunden-Neuberechnungslauf beendet: ${verarbeitet} verarbeitet, ${fehlgeschlagen} fehlgeschlagen (${anlass})`;
  if (fehlgeschlagen > 0) {
    logger.warn({ anlass, gesamt, verarbeitet, fehlgeschlagen, dauerMs }, `⚠️ ${meldung}`);
  } else {
    logger.info({ anlass, gesamt, verarbeitet, fehlgeschlagen, dauerMs }, `✅ ${meldung}`);
  }

  return bilanz;
}
