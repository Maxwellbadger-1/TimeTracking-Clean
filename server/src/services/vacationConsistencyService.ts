/**
 * Vacation Consistency Service — Konsistenzprüfer für das Urlaubs-Journal
 *
 * Beantwortet die drei Fragen, die im August 2026 niemand beantworten konnte:
 *   A) Stimmt der Journal-Saldo mit vacation_balance überein?
 *   B) Hat jeder genehmigte Urlaubsantrag eine Buchung?
 *   C) Hat jeder stornierte Antrag seine Gegenbuchung?
 *
 * Frage C ist der ursprüngliche Fehler: Ein genehmigter Urlaub wurde storniert, die Tage
 * kamen nie zurück. Wäre dieser Prüfer im Mai gelaufen, hätte er den Fall am selben Tag
 * gemeldet statt nach drei Monaten und nur durch Zufall.
 *
 * Der Prüfer ist eine reine Lesefunktion — er ändert nichts und kann jederzeit laufen.
 *
 * Analyse: .planning/debug/urlaubstage-bei-ablehnung-verloren.md
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

export type ConsistencySeverity = 'error' | 'warning' | 'info';

export interface ConsistencyFinding {
  severity: ConsistencySeverity;
  check: 'balance' | 'missing_booking' | 'missing_reversal' | 'orphaned_booking' | 'no_journal';
  userId: number;
  userName: string;
  year: number | null;
  absenceId: number | null;
  message: string;
  /** Was zu tun ist — der Bericht soll ohne Rückfrage handlungsfähig machen */
  action: string;
}

export interface ConsistencyAccount {
  userId: number;
  userName: string;
  year: number;
  journalBalance: number;
  balanceTableValue: number;
  difference: number;
  transactionCount: number;
}

export interface ConsistencyReport {
  checkedAccounts: number;
  findings: ConsistencyFinding[];
  accounts: ConsistencyAccount[];
  summary: { error: number; warning: number; info: number };
  ok: boolean;
}

/** Gleitkomma-Toleranz — Urlaub wird in halben Tagen geführt */
const TOLERANCE = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function checkVacationConsistency(
  options?: { userId?: number; year?: number }
): ConsistencyReport {
  const findings: ConsistencyFinding[] = [];
  const accounts: ConsistencyAccount[] = [];

  // ---------------------------------------------------------------- Konten laden
  let balanceQuery = `
    SELECT vb.userId, vb.year, vb.entitlement, vb.carryover, vb.taken,
           u.firstName || ' ' || u.lastName AS userName
    FROM vacation_balance vb
    JOIN users u ON u.id = vb.userId
    WHERE u.deletedAt IS NULL
  `;
  const balanceParams: unknown[] = [];

  if (options?.userId !== undefined) {
    balanceQuery += ` AND vb.userId = ?`;
    balanceParams.push(options.userId);
  }
  if (options?.year !== undefined) {
    balanceQuery += ` AND vb.year = ?`;
    balanceParams.push(options.year);
  }
  balanceQuery += ` ORDER BY u.lastName, vb.year`;

  const balances = db.prepare(balanceQuery).all(...balanceParams) as Array<{
    userId: number; year: number; entitlement: number; carryover: number;
    taken: number; userName: string;
  }>;

  // ---------------------------------------------------------------- Prüfung A: Saldo
  for (const b of balances) {
    const journal = db.prepare(`
      SELECT COALESCE(SUM(days), 0) AS balance, COUNT(*) AS cnt
      FROM vacation_transactions WHERE userId = ? AND year = ?
    `).get(b.userId, b.year) as { balance: number; cnt: number };

    const expected = round2(b.entitlement + b.carryover - b.taken);
    const journalBalance = round2(journal.balance);
    const difference = round2(journalBalance - expected);

    accounts.push({
      userId: b.userId, userName: b.userName, year: b.year,
      journalBalance, balanceTableValue: expected, difference,
      transactionCount: journal.cnt,
    });

    // Zwischenzustand: Journal für dieses Konto noch nicht befüllt.
    // Ein Sammelbefund statt vieler Einzelmeldungen — sonst ist der Bericht vor dem
    // Backfill unlesbar (42 Anträge ergäben dutzende Fehlalarme).
    if (journal.cnt === 0) {
      findings.push({
        severity: 'info',
        check: 'no_journal',
        userId: b.userId, userName: b.userName, year: b.year, absenceId: null,
        message: `Kein Journal für ${b.userName}, Jahr ${b.year} — Konto führt ${expected} Tage`,
        action: 'Backfill ausstehend (Phase 7). Nach dem Backfill darf dieser Hinweis nicht mehr erscheinen.',
      });
      continue;
    }

    if (Math.abs(difference) > TOLERANCE) {
      findings.push({
        severity: 'error',
        check: 'balance',
        userId: b.userId, userName: b.userName, year: b.year, absenceId: null,
        message:
          `Saldo weicht ab: Journal ${journalBalance}, Konto ${expected} ` +
          `(Differenz ${difference > 0 ? '+' : ''}${difference} Tage)`,
        action: 'Journal prüfen — fehlt eine Buchung, oder wurde vacation_balance am Journal vorbei geändert?',
      });
    }
  }

  // ---------------------------------------------------------------- Anträge laden
  let absenceQuery = `
    SELECT ar.id, ar.userId, ar.status, ar.days, ar.startDate, ar.endDate,
           u.firstName || ' ' || u.lastName AS userName
    FROM absence_requests ar
    JOIN users u ON u.id = ar.userId
    WHERE ar.type = 'vacation' AND u.deletedAt IS NULL
  `;
  const absenceParams: unknown[] = [];
  if (options?.userId !== undefined) {
    absenceQuery += ` AND ar.userId = ?`;
    absenceParams.push(options.userId);
  }
  if (options?.year !== undefined) {
    absenceQuery += ` AND substr(ar.startDate, 1, 4) = ?`;
    absenceParams.push(String(options.year));
  }

  const absences = db.prepare(absenceQuery).all(...absenceParams) as Array<{
    id: number; userId: number; status: string; days: number;
    startDate: string; endDate: string; userName: string;
  }>;

  // Konten ohne jedes Journal überspringen — deren Anträge sind bereits über den
  // no_journal-Sammelbefund abgedeckt.
  const accountsWithoutJournal = new Set(
    accounts.filter(a => a.transactionCount === 0).map(a => `${a.userId}:${a.year}`)
  );

  for (const ar of absences) {
    const year = parseInt(ar.startDate.substring(0, 4));
    if (accountsWithoutJournal.has(`${ar.userId}:${year}`)) continue;

    const bookings = db.prepare(`
      SELECT type, days FROM vacation_transactions
      WHERE referenceType = 'absence' AND referenceId = ?
    `).all(ar.id) as Array<{ type: string; days: number }>;

    const taken = bookings.filter(t => t.type === 'vacation_taken');
    const reverted = bookings.filter(t => t.type === 'vacation_reverted');

    // Prüfung B: genehmigter Antrag ohne Buchung
    if (ar.status === 'approved' && taken.length === 0) {
      findings.push({
        severity: 'error',
        check: 'missing_booking',
        userId: ar.userId, userName: ar.userName, year, absenceId: ar.id,
        message:
          `Antrag #${ar.id} (${ar.startDate} bis ${ar.endDate}, ${ar.days} Tage) ist genehmigt, ` +
          'hat aber keine Buchung',
        action: 'Buchung nachtragen — der Urlaub ist genehmigt, wurde aber nie vom Konto abgezogen.',
      });
    }

    // Prüfung C: Storno ohne Gegenbuchung — DER ursprüngliche Fehler
    if (ar.status === 'rejected' && taken.length > 0 && reverted.length === 0) {
      findings.push({
        severity: 'error',
        check: 'missing_reversal',
        userId: ar.userName ? ar.userId : ar.userId, userName: ar.userName, year, absenceId: ar.id,
        message:
          `Antrag #${ar.id} (${ar.startDate} bis ${ar.endDate}, ${ar.days} Tage) wurde storniert, ` +
          'aber die Tage wurden nie zurückgebucht',
        action: 'Gegenbuchung nachtragen — dem Mitarbeiter fehlen diese Tage auf dem Konto.',
      });
    }

    // Summe muss bei einem stornierten Antrag 0 ergeben
    if (ar.status === 'rejected' && bookings.length > 0) {
      const sum = round2(bookings.reduce((s, t) => s + t.days, 0));
      if (Math.abs(sum) > TOLERANCE) {
        findings.push({
          severity: 'error',
          check: 'missing_reversal',
          userId: ar.userId, userName: ar.userName, year, absenceId: ar.id,
          message: `Antrag #${ar.id} ist storniert, seine Buchungen ergeben aber ${sum} statt 0`,
          action: 'Buchungen zu diesem Antrag prüfen — Genehmigung und Storno müssen sich aufheben.',
        });
      }
    }
  }

  // ---------------------------------------------------------------- Prüfung D: verwaiste Buchungen
  // Kein Fehler: Wird ein Antrag gelöscht, bleibt seine Buchung bewusst bestehen, damit der
  // Kontoauszug die Saldoänderung weiterhin erklären kann.
  let orphanQuery = `
    SELECT vt.referenceId, vt.userId, vt.year, COUNT(*) AS cnt,
           u.firstName || ' ' || u.lastName AS userName
    FROM vacation_transactions vt
    JOIN users u ON u.id = vt.userId
    WHERE vt.referenceType = 'absence'
      AND vt.referenceId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM absence_requests ar WHERE ar.id = vt.referenceId)
  `;
  const orphanParams: unknown[] = [];
  if (options?.userId !== undefined) {
    orphanQuery += ` AND vt.userId = ?`;
    orphanParams.push(options.userId);
  }
  if (options?.year !== undefined) {
    orphanQuery += ` AND vt.year = ?`;
    orphanParams.push(options.year);
  }
  orphanQuery += ` GROUP BY vt.referenceId, vt.userId, vt.year, userName`;

  const orphans = db.prepare(orphanQuery).all(...orphanParams) as Array<{
    referenceId: number; userId: number; year: number; cnt: number; userName: string;
  }>;

  for (const o of orphans) {
    findings.push({
      severity: 'info',
      check: 'orphaned_booking',
      userId: o.userId, userName: o.userName, year: o.year, absenceId: o.referenceId,
      message: `${o.cnt} Buchung(en) verweisen auf den gelöschten Antrag #${o.referenceId}`,
      action: 'Kein Handlungsbedarf — die Buchung bleibt erhalten, damit der Kontoauszug die Änderung erklärt.',
    });
  }

  // ---------------------------------------------------------------- Ergebnis
  const summary = {
    error: findings.filter(f => f.severity === 'error').length,
    warning: findings.filter(f => f.severity === 'warning').length,
    info: findings.filter(f => f.severity === 'info').length,
  };

  const report: ConsistencyReport = {
    checkedAccounts: accounts.length,
    findings,
    accounts,
    summary,
    ok: summary.error === 0,
  };

  logger.info(
    { checkedAccounts: report.checkedAccounts, ...summary, ok: report.ok },
    report.ok ? '✅ Urlaubskonten konsistent' : '❌ Urlaubskonten inkonsistent'
  );

  return report;
}
