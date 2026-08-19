/**
 * Vacation Backfill Service — Historie rückwirkend erzeugen
 *
 * Ab Phase 6 bucht jeder Vorgang ins Journal. Was davor passierte, existiert dort nicht.
 * Dieser Service rekonstruiert die Vergangenheit aus `absence_requests` und `audit_log`.
 *
 * HARTE BEDINGUNG: Nach dem Backfill müssen exakt die heutigen Salden herauskommen.
 * Der Backfill ändert KEINE bestehenden Werte — er erzeugt ausschließlich Buchungen, die
 * den vorhandenen Stand erklären. Weicht für ein Konto die geplante Summe vom Ist-Wert ab,
 * wird gar nichts geschrieben.
 *
 * WAS SICH NICHT REKONSTRUIEREN LÄSST: Die Direkteingriffe vom 18.08.2026 (Korrektur von
 * Carmen, Benedikt und den sechs Konten mit falschem Anspruch) fanden ohne Journal statt.
 * Diese Anteile werden als eine klar gekennzeichnete Ausgleichsbuchung je Konto eingestellt.
 * Das ist ehrlicher, als eine Historie zu erfinden, die es nie gab.
 *
 * Analyse: .planning/debug/urlaubstage-bei-ablehnung-verloren.md
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import type { VacationTransactionType, VacationReferenceType } from './vacationTransactionService.js';

/** Kennzeichnung, an der rückwirkend erzeugte Buchungen erkennbar sind (Idempotenz) */
export const BACKFILL_MARKER = '(rückwirkend erzeugt)';

export interface BackfillEntry {
  userId: number;
  userName: string;
  year: number;
  date: string;
  type: VacationTransactionType;
  days: number;
  description: string;
  referenceType: VacationReferenceType;
  referenceId: number | null;
}

export interface BackfillAccountPlan {
  userId: number;
  userName: string;
  year: number;
  entries: BackfillEntry[];
  /** Summe der geplanten Buchungen */
  plannedSum: number;
  /** entitlement + carryover - taken, also der heutige Stand */
  actualBalance: number;
  /** Ausgleich, der nötig war, damit beide übereinstimmen */
  reconciliation: number;
}

export interface BackfillPlan {
  accounts: BackfillAccountPlan[];
  totalEntries: number;
  /** Konten, bei denen die Summe trotz Ausgleich nicht stimmt — muss leer sein */
  mismatches: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Prüft, ob bereits rückwirkend erzeugte Buchungen existieren.
 * Der Backfill darf nur einmal laufen — sonst verdoppelt er die Historie.
 */
export function hasExistingBackfill(): boolean {
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM vacation_transactions
    WHERE description LIKE ?
  `).get(`%${BACKFILL_MARKER}%`) as { cnt: number };
  return row.cnt > 0;
}

/**
 * Baut den Backfill-Plan. BERECHNET NUR — schreibt nichts.
 * So lässt sich das Ergebnis vollständig prüfen, bevor etwas in die Datenbank geht.
 */
export function buildBackfillPlan(): BackfillPlan {
  const accounts: BackfillAccountPlan[] = [];
  const mismatches: string[] = [];

  const balances = db.prepare(`
    SELECT vb.userId, vb.year, vb.entitlement, vb.carryover, vb.taken,
           u.firstName || ' ' || u.lastName AS userName, u.hireDate
    FROM vacation_balance vb
    JOIN users u ON u.id = vb.userId
    ORDER BY u.lastName, vb.year
  `).all() as Array<{
    userId: number; year: number; entitlement: number; carryover: number;
    taken: number; userName: string; hireDate: string | null;
  }>;

  for (const b of balances) {
    const entries: BackfillEntry[] = [];
    const actualBalance = round2(b.entitlement + b.carryover - b.taken);

    // --- a) Jahresanspruch ---------------------------------------------------
    // Datum: Jahresbeginn, oder das Eintrittsdatum, wenn es in dieses Jahr fällt.
    // Der Anspruch soll im Auszug dort stehen, wo er entsteht.
    let entitlementDate = `${b.year}-01-01`;
    if (b.hireDate && b.hireDate.startsWith(String(b.year))) {
      entitlementDate = b.hireDate;
    }

    if (b.entitlement !== 0) {
      entries.push({
        userId: b.userId, userName: b.userName, year: b.year,
        date: entitlementDate,
        type: 'entitlement',
        days: b.entitlement,
        description: `Jahresanspruch ${b.year} ${BACKFILL_MARKER}`,
        referenceType: 'system', referenceId: null,
      });
    }

    // --- b) Übertrag ---------------------------------------------------------
    if (b.carryover !== 0) {
      entries.push({
        userId: b.userId, userName: b.userName, year: b.year,
        date: `${b.year}-01-01`,
        type: 'carryover',
        days: b.carryover,
        description: `Übertrag aus ${b.year - 1} ${BACKFILL_MARKER}`,
        referenceType: 'system', referenceId: null,
      });
    }

    // --- c) Genehmigte Urlaubsanträge ---------------------------------------
    const approved = db.prepare(`
      SELECT id, startDate, endDate, days
      FROM absence_requests
      WHERE userId = ? AND type = 'vacation' AND status = 'approved'
        AND substr(startDate, 1, 4) = ?
      ORDER BY startDate, id
    `).all(b.userId, String(b.year)) as Array<{
      id: number; startDate: string; endDate: string; days: number;
    }>;

    for (const a of approved) {
      entries.push({
        userId: b.userId, userName: b.userName, year: b.year,
        date: a.startDate,
        type: 'vacation_taken',
        days: -a.days,
        description: `Urlaub ${a.startDate} bis ${a.endDate} genehmigt ${BACKFILL_MARKER}`,
        referenceType: 'absence', referenceId: a.id,
      });
    }

    // --- d) Stornierte Anträge, die einmal genehmigt waren --------------------
    // Das sind die Fälle, um die es in diesem Milestone geht. Das audit_log hält
    // fest, welcher Antrag erst 'approve' und später 'reject' erhielt.
    const rejected = db.prepare(`
      SELECT id, startDate, endDate, days
      FROM absence_requests
      WHERE userId = ? AND type = 'vacation' AND status = 'rejected'
        AND substr(startDate, 1, 4) = ?
      ORDER BY startDate, id
    `).all(b.userId, String(b.year)) as Array<{
      id: number; startDate: string; endDate: string; days: number;
    }>;

    for (const r of rejected) {
      const events = db.prepare(`
        SELECT changes, createdAt FROM audit_log
        WHERE entity = 'absence_request' AND entityId = ? AND action = 'update'
        ORDER BY id
      `).all(r.id) as Array<{ changes: string; createdAt: string }>;

      let approvedAt: string | null = null;
      let rejectedAt: string | null = null;
      for (const e of events) {
        try {
          const c = JSON.parse(e.changes);
          if (c.action === 'approve') approvedAt = e.createdAt;
          if (c.action === 'reject' && approvedAt) rejectedAt = e.createdAt;
        } catch { /* kein JSON — ignorieren */ }
      }

      // Nur wenn der Antrag tatsächlich einmal genehmigt war, entstand ein Verbrauch,
      // der zurückgebucht werden muss. Ein direkt abgelehnter Antrag hat nie gebucht.
      if (approvedAt && rejectedAt) {
        // Datum der Genehmigung, NICHT des Urlaubsbeginns.
        //
        // Bei Carmens Antrag #61 lag der Urlaub im August, die Stornierung aber davor
        // (18.08. storniert, Urlaub ab 24.08.). Mit dem Startdatum stünde der Storno im
        // Auszug vor der Genehmigung und der laufende Saldo spränge unlogisch:
        // 10 → 16 (Storno) → 9 (Genehmigung). Mit dem Genehmigungsdatum stimmt die
        // Chronologie: erst gebucht, dann storniert.
        entries.push({
          userId: b.userId, userName: b.userName, year: b.year,
          date: approvedAt.substring(0, 10),
          type: 'vacation_taken',
          days: -r.days,
          description: `Urlaub ${r.startDate} bis ${r.endDate} genehmigt ${BACKFILL_MARKER}`,
          referenceType: 'absence', referenceId: r.id,
        });
        entries.push({
          userId: b.userId, userName: b.userName, year: b.year,
          date: rejectedAt.substring(0, 10),
          type: 'vacation_reverted',
          days: r.days,
          description: `Storno des Antrags vom ${r.startDate} ${BACKFILL_MARKER}`,
          referenceType: 'absence', referenceId: r.id,
        });
      }
    }

    // --- e) Ausgleich --------------------------------------------------------
    const sumBeforeReconciliation = round2(entries.reduce((s, e) => s + e.days, 0));
    const reconciliation = round2(actualBalance - sumBeforeReconciliation);

    if (Math.abs(reconciliation) > 0.001) {
      entries.push({
        userId: b.userId, userName: b.userName, year: b.year,
        date: `${b.year}-01-01`,
        type: 'correction',
        days: reconciliation,
        description:
          `Nicht rekonstruierbare Anfangsdifferenz ${BACKFILL_MARKER} — ` +
          `Vorgänge vor Einführung des Journals, u. a. Direktkorrekturen an der Datenbank`,
        referenceType: 'system', referenceId: null,
      });
    }

    const plannedSum = round2(entries.reduce((s, e) => s + e.days, 0));

    if (Math.abs(plannedSum - actualBalance) > 0.011) {
      mismatches.push(
        `${b.userName} ${b.year}: geplant ${plannedSum}, tatsächlich ${actualBalance}`
      );
    }

    // Buchungen chronologisch — der laufende Saldo im Auszug soll Sinn ergeben
    entries.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

    accounts.push({
      userId: b.userId, userName: b.userName, year: b.year,
      entries, plannedSum, actualBalance, reconciliation,
    });
  }

  const plan: BackfillPlan = {
    accounts,
    totalEntries: accounts.reduce((s, a) => s + a.entries.length, 0),
    mismatches,
  };

  logger.info(
    { accounts: plan.accounts.length, entries: plan.totalEntries, mismatches: plan.mismatches.length },
    'Backfill-Plan erstellt'
  );

  return plan;
}
