/**
 * Vacation Transaction Service — Urlaubs-Journal
 *
 * Jede Bewegung auf dem Urlaubskonto ist eine Buchungszeile; der verfügbare Rest eines
 * Jahres ist die Summe seiner Buchungen. Vorbild ist `overtimeTransactionService`.
 *
 * WARUM: `vacation_balance.taken` war ein handgepflegter Zähler ohne Historie. Wurde eine
 * Gegenbuchung vergessen, entstand eine stille Differenz, die niemand sehen konnte — im
 * August 2026 waren das 16 Urlaubstage bei zwei Mitarbeitern, drei Monate lang unentdeckt.
 * Mit einem Journal ist eine fehlende Gegenbuchung keine stille Differenz mehr, sondern
 * eine fehlende Zeile.
 *
 * BUCHUNGSTYPEN
 *   entitlement        Jahresanspruch                          positiv
 *   carryover          Übertrag aus dem Vorjahr                positiv
 *   vacation_taken     genehmigter Urlaub                      negativ
 *   vacation_reverted  Storno einer Genehmigung                positiv
 *   correction         manuelle Admin-Korrektur                beide Richtungen
 *   expiry             Verfall nicht genommener Tage           negativ
 *
 * VORZEICHEN: positive `days` schreiben verfügbaren Urlaub gut, negative verbrauchen ihn.
 * Damit ist der Rest schlicht `SUM(days)` — kein zweiter Wert, der abweichen kann.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3-Transaktionen sind synchron. Nur so lässt sich eine Buchung gemeinsam mit
 * dem Statuswechsel eines Antrags in eine `db.transaction()` klammern (Phase 6). Genau diese
 * Klammer verhindert künftig einen halb ausgeführten Vorgang. Kein async/await, keine
 * dynamischen Imports in diesem Modul.
 *
 * Analyse: .planning/debug/urlaubstage-bei-ablehnung-verloren.md
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

export type VacationTransactionType =
  | 'entitlement'
  | 'carryover'
  | 'vacation_taken'
  | 'vacation_reverted'
  | 'correction'
  | 'expiry';

export type VacationReferenceType = 'absence' | 'manual' | 'system' | null;

export interface VacationTransaction {
  id: number;
  userId: number;
  year: number;
  date: string;
  type: VacationTransactionType;
  days: number;
  description: string | null;
  referenceType: VacationReferenceType;
  referenceId: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  createdBy: number | null;
}

export interface RecordVacationTransactionInput {
  userId: number;
  year: number;
  /** Datum der Buchung, YYYY-MM-DD */
  date: string;
  type: VacationTransactionType;
  /** positiv = Gutschrift, negativ = Verbrauch. Darf nicht 0 sein. */
  days: number;
  /** Pflicht — eine Buchung ohne Begründung ist im Auszug wertlos */
  description: string;
  referenceType?: VacationReferenceType;
  referenceId?: number | null;
  /** Wer die Buchung ausgelöst hat. null nur für System-Automatismen. */
  createdBy?: number | null;
}

const VALID_TYPES: readonly VacationTransactionType[] = [
  'entitlement',
  'carryover',
  'vacation_taken',
  'vacation_reverted',
  'correction',
  'expiry',
];

/** Urlaub wird in halben Tagen geführt — auf 2 Nachkommastellen runden reicht und
 *  verhindert, dass sich Gleitkomma-Reste über viele Buchungen aufsummieren. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Verfügbarer Urlaub eines Nutzerjahres = Summe aller Buchungen.
 *
 * Das ist die eigentliche Kernaussage dieses Milestones: Es gibt keinen zweiten,
 * gepflegten Wert, der davon abweichen könnte.
 */
export function getVacationBalanceFromTransactions(userId: number, year: number): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(days), 0) AS balance
    FROM vacation_transactions
    WHERE userId = ? AND year = ?
  `).get(userId, year) as { balance: number };

  return round2(result.balance);
}

/**
 * Setzt `vacation_balance.taken` auf den Wert, der sich aus dem Journal ergibt.
 *
 * KERN DES MILESTONES: `taken` wird nicht mehr fortgeschrieben (`taken = taken ± x`),
 * sondern nach jeder Buchung **absolut neu berechnet**. Ein inkrementeller Zähler driftet,
 * sobald ein einziger Aufruf fehlt — genau das passierte im Mai 2026 und blieb drei Monate
 * unbemerkt. Ein absolut berechneter Wert kann das nicht.
 *
 * HERLEITUNG: Der Journal-Saldo ist definitionsgemäß der verfügbare Rest:
 *
 *     journalSaldo = entitlement + carryover − taken
 *   ⟹ taken        = entitlement + carryover − journalSaldo
 *
 * Diese Umformung ist der Grund, warum hier **nicht** nach Buchungstypen gefiltert wird.
 * Eine naheliegende Variante wäre, nur `vacation_taken` und `vacation_reverted` zu summieren
 * — dann müsste man aber `correction`-Buchungen danach unterscheiden, ob sie auf `taken`
 * oder auf `entitlement` zielen. Beide tragen denselben Typ; die Unterscheidung ginge nur
 * über die Beschreibung und wäre damit fragil.
 *
 * Über die Invariante fällt das Problem weg: Eine Korrektur an `entitlement` verändert die
 * Spalte **und** den Journal-Saldo um denselben Betrag, `taken` bleibt korrekt unverändert.
 * Eine Korrektur an `taken` verändert nur den Saldo — und genau das ist gewollt.
 *
 * `entitlement` und `carryover` bleiben Stammdaten des Kontos und werden nicht abgeleitet.
 *
 * SYNCHRON — in `db.transaction()` einsetzbar.
 *
 * @returns der neu gesetzte Wert von `taken`
 */
export function syncTakenFromJournal(userId: number, year: number): number {
  const balance = db.prepare(`
    SELECT entitlement, carryover FROM vacation_balance WHERE userId = ? AND year = ?
  `).get(userId, year) as { entitlement: number; carryover: number } | undefined;

  // Kein Konto vorhanden → nichts zu synchronisieren. Hier bewusst keines anlegen:
  // Konten entstehen bei der Nutzeranlage oder durch einen Admin, nicht als Nebenwirkung
  // einer Buchung.
  if (!balance) {
    logger.debug({ userId, year }, 'syncTakenFromJournal: kein Konto vorhanden, übersprungen');
    return 0;
  }

  const journal = db.prepare(`
    SELECT COALESCE(SUM(days), 0) AS balance
    FROM vacation_transactions WHERE userId = ? AND year = ?
  `).get(userId, year) as { balance: number };

  const taken = round2(balance.entitlement + balance.carryover - journal.balance);

  db.prepare(`UPDATE vacation_balance SET taken = ? WHERE userId = ? AND year = ?`)
    .run(taken, userId, year);

  logger.debug({ userId, year, journalBalance: round2(journal.balance), taken },
    'taken aus Journal synchronisiert');

  return taken;
}

/**
 * Journal eines Nutzers — chronologisch.
 *
 * Sortierung `date ASC, id ASC`: Mehrere Buchungen können dasselbe Datum tragen
 * (z. B. Storno und Neuantrag am selben Tag). `id` als Sekundärschlüssel hält die
 * Reihenfolge stabil, damit der laufende Saldo im Kontoauszug nachvollziehbar bleibt.
 */
export function getVacationTransactions(
  userId: number,
  options?: { year?: number; limit?: number }
): VacationTransaction[] {
  let query = `SELECT * FROM vacation_transactions WHERE userId = ?`;
  const params: unknown[] = [userId];

  if (options?.year !== undefined) {
    query += ` AND year = ?`;
    params.push(options.year);
  }

  query += ` ORDER BY date ASC, id ASC`;

  if (options?.limit !== undefined) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  return db.prepare(query).all(...params) as VacationTransaction[];
}

/**
 * Alle Buchungen zu einem Abwesenheitsantrag.
 *
 * Ein genehmigter und später stornierter Antrag hat hier zwei Zeilen, die sich zu 0
 * aufheben. Der Konsistenzprüfer (Phase 7) erkennt daran, ob eine Gegenbuchung fehlt.
 */
export function getVacationTransactionsForAbsence(absenceId: number): VacationTransaction[] {
  return db.prepare(`
    SELECT * FROM vacation_transactions
    WHERE referenceType = 'absence' AND referenceId = ?
    ORDER BY date ASC, id ASC
  `).all(absenceId) as VacationTransaction[];
}

/**
 * Eine Buchung schreiben. SYNCHRON — in `db.transaction()` verwendbar.
 *
 * `balanceBefore`/`balanceAfter` werden mitgeschrieben, damit jede Zeile ihren eigenen
 * Nachweis trägt: Der Kontoauszug kann ohne Nachrechnen angezeigt werden, und eine
 * gebrochene Kette fällt sofort auf.
 *
 * @returns id der neuen Buchung
 */
export function recordVacationTransaction(input: RecordVacationTransactionInput): number {
  const {
    userId,
    year,
    date,
    type,
    days,
    description,
    referenceType = null,
    referenceId = null,
    createdBy = null,
  } = input;

  // Prüfungen vorab — eine unbrauchbare Buchung soll gar nicht erst entstehen.
  if (!Number.isFinite(days) || days === 0) {
    throw new Error(
      `Ungültige Buchung: days muss eine Zahl ungleich 0 sein (erhalten: ${days})`
    );
  }

  if (!description || description.trim() === '') {
    throw new Error(
      'Ungültige Buchung: description ist Pflicht — eine Buchung ohne Begründung ist im ' +
      'Kontoauszug wertlos'
    );
  }

  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      `Ungültige Buchung: unbekannter Typ "${type}". Erlaubt: ${VALID_TYPES.join(', ')}`
    );
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Ungültige Buchung: year muss zwischen 2000 und 2100 liegen (erhalten: ${year})`);
  }

  const balanceBefore = getVacationBalanceFromTransactions(userId, year);
  const balanceAfter = round2(balanceBefore + days);

  const result = db.prepare(`
    INSERT INTO vacation_transactions
      (userId, year, date, type, days, description,
       referenceType, referenceId, balanceBefore, balanceAfter, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    year,
    date,
    type,
    round2(days),
    description.trim(),
    referenceType,
    referenceId,
    balanceBefore,
    balanceAfter,
    createdBy
  );

  logger.info(
    { userId, year, type, days, balanceBefore, balanceAfter, referenceType, referenceId },
    `✅ Urlaubsbuchung: ${type} ${days > 0 ? '+' : ''}${days} Tage`
  );

  // Der Cache zieht sofort nach. Damit ist es unmöglich, dass eine Buchung existiert,
  // ohne dass sich `taken` entsprechend ändert — die Fehlerklasse, die diesen Milestone
  // ausgelöst hat, kann per Konstruktion nicht mehr auftreten.
  //
  // Beides ist synchron und läuft damit in derselben Transaktion wie der auslösende
  // Vorgang: Entweder wird gebucht UND synchronisiert, oder keines von beidem.
  syncTakenFromJournal(userId, year);

  return result.lastInsertRowid as number;
}
