import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { invalidateUserAffectedQueries } from './invalidationHelpers';
import type {
  WorkTimePeriod,
  WorkTimeChangeInput,
  WorkTimeChangePreviewResponse,
  WorkTimeChangeResult,
} from '../types';

/**
 * Datenschicht des Desktops fuer den Stundenwechsel (Phase 12, D2).
 *
 * D2: Die Vorschau kommt unveraendert vom Server. Diese Hooks rechnen keine Zwischensumme
 * und keine Differenz selbst — sie reichen die Serverantwort unveraendert durch.
 */

/**
 * Liefert alle Arbeitszeitperioden eines Nutzers, absteigend nach validFrom zu sortieren
 * durch die aufrufende Komponente (WorkTimePeriodList).
 */
export function useWorkPeriods(userId: number | null) {
  return useQuery({
    queryKey: ['work-periods', userId],
    queryFn: async () => {
      const response = await apiClient.get<WorkTimePeriod[]>(`/work-periods?userId=${userId}`);
      if (!response.success) {
        throw new Error(response.error || 'Perioden konnten nicht geladen werden');
      }
      return response.data || [];
    },
    enabled: userId !== null,
    retry: false,
  });
}

/**
 * Berechnet die Vorschau eines Stundenwechsels serverseitig. Kein `onSuccess`, das Werte
 * umrechnet — die Antwort wird unveraendert durchgereicht (D2). Die Begruendung ist fuer die
 * Vorschau nicht erforderlich und ist auch nicht an das Token gebunden.
 */
export function usePreviewWorkTimeChange() {
  return useMutation({
    mutationFn: async (input: Omit<WorkTimeChangeInput, 'reason'>) => {
      const response = await apiClient.post<WorkTimeChangePreviewResponse>(
        '/work-periods/preview',
        input
      );
      if (!response.success) {
        throw new Error(response.error || 'Die Vorschau konnte nicht berechnet werden');
      }
      return response.data;
    },
  });
}

/**
 * Speichert einen Stundenwechsel unter Bezug auf ein zuvor ausgestelltes previewToken.
 * Lehnt der Server das Token ab, liefert er den Fehlercode `PREVIEW_STALE` (Plan 12-05) —
 * dieser Hook reicht die Servermeldung unveraendert weiter.
 */
export function useSaveWorkTimeChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WorkTimeChangeInput & { previewToken: string }) => {
      const response = await apiClient.post<WorkTimeChangeResult>('/work-periods/change', input);
      if (!response.success) {
        throw new Error(response.error || 'Der Stundenwechsel wurde nicht gespeichert');
      }
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      // Betroffene Queries invalidieren, sonst zeigen die schreibgeschuetzten Felder im
      // EditUserModal nach dem Speichern noch den alten Wert.
      await queryClient.invalidateQueries({ queryKey: ['work-periods', variables.userId] });
      await invalidateUserAffectedQueries(queryClient);
    },
  });
}
