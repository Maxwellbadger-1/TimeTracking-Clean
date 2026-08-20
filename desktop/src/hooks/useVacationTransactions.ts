import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Vacation Transactions (Kontoauszug) Hook
 *
 * Liest den Kontoauszug (Journal + Saldo) über `GET /api/vacation-transactions`.
 * Vertrag und Rollenprüfung stammen aus Plan 08-01 (server/src/routes/vacationTransactions.ts):
 * ein Mitarbeiter erhält ausschließlich das eigene Konto, ein Admin kann `userId` setzen und
 * jedes Konto einsehen. Diese Oberfläche stellt die Zugriffsregel nicht her — sie zeigt
 * lediglich, was der Server freigibt.
 */

export type VacationTransactionType =
  | 'entitlement'
  | 'carryover'
  | 'vacation_taken'
  | 'vacation_reverted'
  | 'correction'
  | 'expiry';

/** Antragsdaten, die eine Journalzeile mit referenceType = 'absence' begleiten. */
export interface VacationJournalAbsence {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  days: number;
}

/** Eine Buchungszeile des Urlaubs-Kontoauszugs. */
export interface VacationJournalEntry {
  id: number;
  userId: number;
  year: number;
  date: string;
  type: VacationTransactionType;
  days: number;
  description: string | null;
  referenceType: 'absence' | 'manual' | 'system' | null;
  referenceId: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  createdBy: number | null;
  absence: VacationJournalAbsence | null;
}

/** Kontoauszug eines Nutzerjahres: Stammdaten + laufender Saldo + Journal. */
export interface VacationAccountStatement {
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
  taken: number;
  /** entitlement + carryover − taken — identisch mit der Spalte „Verbleibend" der Urlaubsliste */
  available: number;
  /** Summe aller days des Jahres (per Invariante identisch mit available) */
  journalBalance: number;
  transactions: VacationJournalEntry[];
}

/**
 * Lädt den Urlaubs-Kontoauszug.
 *
 * @param userId Nur für Admins wirksam; ohne Angabe liefert der Server das eigene Konto
 * @param year Standard: laufendes Jahr
 * @param limit Standard 200, Obergrenze 500
 */
export function useVacationTransactions(userId?: number, year?: number, limit?: number) {
  return useQuery({
    queryKey: ['vacation-transactions', userId ?? 'self', year, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId !== undefined) params.append('userId', String(userId));
      if (year !== undefined) params.append('year', String(year));
      if (limit !== undefined) params.append('limit', String(limit));

      const response = await apiClient.get<VacationAccountStatement>(
        `/vacation-transactions${params.toString() ? '?' + params.toString() : ''}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vacation transactions');
      }

      return response.data;
    },
    // Nach einer Genehmigung, einem Storno oder einer Admin-Korrektur muss der Auszug
    // sofort den neuen Stand zeigen — dasselbe Argument wie bei useVacationBalance.
    staleTime: 0,
  });
}
