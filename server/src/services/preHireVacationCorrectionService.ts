/**
 * Pre-Hire Vacation Correction Service — Korrektur der 06-04-Pro-rata-Artefakte
 *
 * Vor dem Fix in `06-04` (`initializeVacationBalance()` in `absenceService.ts`) berechnete der
 * Auto-Init-/Anzeige-Pfad den Anspruch als vollen Jahreswert unabhängig vom Eintrittsdatum. Das
 * erzeugte reale Datenartefakte: Konten mit Anspruch für ein Jahr, in dem der Mitarbeiter laut
 * `hireDate` noch gar nicht beschäftigt war. Details und die vollständige Herleitung, warum eine
 * `correction`-Buchung (nicht Löschung) der richtige Mechanismus ist, siehe `06-07-PLAN.md`
 * (`<objective>`) und `06-VERIFICATION.md`.
 *
 * Dieser Service liefert nur die testbare Kernlogik (Plan bauen, Korrektur anwenden,
 * Idempotenz prüfen) — analog zu `vacationBackfillService.ts`. Das CLI-Skript
 * `server/src/scripts/correctPreHireVacationBalances2025.ts` orchestriert Konsolenausgabe,
 * Trockenlauf/--apply-Schalter und die hartkodierte Kandidatenliste.
 *
 * Mechanismus: `updateVacationBalance(id, { entitlement: 0, ... })` bucht die Feld-Differenz
 * (`0 − aktueller Anspruch`) als `correction`-Transaktion und aktualisiert `entitlement`
 * atomar — der bereits produktive Korrekturpfad, den ein Admin über die Oberfläche auslösen
 * würde. `taken` und `remaining` synchronisieren sich danach automatisch aus dem Journal.
 */

import { db } from '../database/connection.js';
import {
  getVacationBalance,
  updateVacationBalance,
  calculateProRataVacationDays,
  type VacationBalance,
} from './vacationBalanceService.js';
import { getVacationBalanceFromTransactions } from './vacationTransactionService.js';

/** Kennzeichnung, an der die Korrekturbuchungen dieses Plans erkennbar sind (Idempotenz). */
export const PRE_HIRE_CORRECTION_MARKER = '[BACKFILL-06-07]';

export interface PreHireCorrectionCandidate {
  userId: number;
  year: number;
}

export interface PreHireCorrectionPlanEntryEligible {
  eligible: true;
  userId: number;
  year: number;
  balanceId: number;
  currentEntitlement: number;
  userName: string;
  hireDate: string;
}

export interface PreHireCorrectionPlanEntryIneligible {
  eligible: false;
  userId: number;
  year: number;
  reason: string;
}

export type PreHireCorrectionPlanEntry =
  | PreHireCorrectionPlanEntryEligible
  | PreHireCorrectionPlanEntryIneligible;

interface UserRow {
  vacationDaysPerYear: number;
  hireDate: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Prüft, ob für (userId, year) bereits eine Korrekturbuchung dieses Plans existiert.
 * Analog zu `vacationBackfillService.hasExistingBackfill()`.
 */
export function hasExistingPreHireCorrection(userId: number, year: number): boolean {
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM vacation_transactions
    WHERE userId = ? AND year = ? AND type = 'correction' AND description LIKE ?
  `).get(userId, year, `%${PRE_HIRE_CORRECTION_MARKER}%`) as { cnt: number };
  return row.cnt > 0;
}

/**
 * Baut den Korrekturplan. LIEST NUR — schreibt nichts. Prüft für jeden Kandidaten die
 * vollständige Prüfkette aus `06-07-PLAN.md` in genau dieser Reihenfolge; die erste
 * fehlschlagende Prüfung liefert sofort einen `eligible: false`-Eintrag.
 */
export function buildPreHireCorrectionPlan(
  candidates: PreHireCorrectionCandidate[]
): PreHireCorrectionPlanEntry[] {
  const results: PreHireCorrectionPlanEntry[] = [];

  for (const candidate of candidates) {
    const { userId, year } = candidate;

    const user = db.prepare(`
      SELECT vacationDaysPerYear, hireDate, firstName, lastName FROM users WHERE id = ?
    `).get(userId) as UserRow | undefined;

    const balance = getVacationBalance(userId, year);

    if (!balance) {
      results.push({ eligible: false, userId, year, reason: 'Kein Konto vorhanden' });
      continue;
    }

    if (!user || !user.hireDate) {
      results.push({
        eligible: false,
        userId,
        year,
        reason: 'Nutzer oder Eintrittsdatum nicht gefunden',
      });
      continue;
    }

    const expectedEntitlement = calculateProRataVacationDays(
      user.hireDate,
      user.vacationDaysPerYear,
      year
    );

    if (expectedEntitlement !== 0) {
      results.push({
        eligible: false,
        userId,
        year,
        reason: `Konto passt nicht zum Fehlerbild — erwarteter Anspruch für ${year} ist ${expectedEntitlement}, nicht 0`,
      });
      continue;
    }

    if (balance.carryover !== 0) {
      results.push({
        eligible: false,
        userId,
        year,
        reason: `Konto hat bereits eigene Bewegungen — carryover ist ${balance.carryover}, nicht 0`,
      });
      continue;
    }

    if (balance.taken !== 0) {
      results.push({
        eligible: false,
        userId,
        year,
        reason: `Konto hat bereits eigene Bewegungen — taken ist ${balance.taken}, nicht 0`,
      });
      continue;
    }

    const journalBalance = getVacationBalanceFromTransactions(userId, year);
    if (journalBalance !== balance.entitlement) {
      results.push({
        eligible: false,
        userId,
        year,
        reason: `Journalsumme (${journalBalance}) weicht vom gebuchten Anspruch (${balance.entitlement}) ab — unerwarteter Zustand, nicht automatisiert korrigiert`,
      });
      continue;
    }

    if (hasExistingPreHireCorrection(userId, year)) {
      results.push({ eligible: false, userId, year, reason: 'Bereits korrigiert (Marker gefunden)' });
      continue;
    }

    results.push({
      eligible: true,
      userId,
      year,
      balanceId: balance.id,
      currentEntitlement: balance.entitlement,
      userName: `${user.firstName} ${user.lastName}`,
      hireDate: user.hireDate,
    });
  }

  return results;
}

/**
 * Wendet die Korrektur für einen einzelnen, bereits als `eligible: true` geprüften Eintrag an.
 * Wirft bei `eligible: false`, damit ein Aufrufer nie versehentlich ein ungeeignetes Konto
 * bucht.
 */
export function applyPreHireCorrection(
  entry: PreHireCorrectionPlanEntryEligible
): VacationBalance {
  if (!entry.eligible) {
    throw new Error('applyPreHireCorrection() darf nur mit einem eligible:true-Eintrag aufgerufen werden');
  }

  const reason =
    `Fehlerhafter Alt-Datensatz vor Eintrittsdatum (${entry.currentEntitlement} Tage Anspruch ` +
    `für ${entry.year} gebucht, Eintritt erst ${entry.hireDate}) — behoben durch den ` +
    `Pro-rata-Fix aus Phase 6/06-04 ${PRE_HIRE_CORRECTION_MARKER}`;

  return updateVacationBalance(entry.balanceId, {
    entitlement: 0,
    actorId: null,
    reason,
  });
}
