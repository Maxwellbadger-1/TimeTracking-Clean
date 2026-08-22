import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { invalidateUserAffectedQueries } from './invalidationHelpers';
import type {
  WorkTimePeriod,
  WorkTimeChangeInput,
  WorkTimeChangePreviewResponse,
  WorkTimeChangeResult,
  WorkPeriodCorrectionInput,
  WorkPeriodCorrectionPreviewResponse,
  WorkPeriodCorrectionOutcome,
  WorkPeriodDeletionInput,
  WorkPeriodDeletionPreviewResponse,
  WorkPeriodDeletionOutcome,
} from '../types';

/**
 * Datenschicht des Desktops fuer den Stundenwechsel (Phase 12, D2) sowie fuer Korrigieren und
 * Ruckgaengigmachen (Phase 13, REQ-30/REQ-31, D7).
 *
 * D2/D7: Die Vorschau kommt unveraendert vom Server. Diese Hooks rechnen keine Zwischensumme
 * und keine Differenz selbst — sie reichen die Serverantwort unveraendert durch.
 */

/**
 * Liefert alle Arbeitszeitperioden eines Nutzers, absteigend nach validFrom zu sortieren
 * durch die aufrufende Komponente (WorkTimePeriodList).
 *
 * DD-31 (Phase 13, 13-07-PLAN.md): unterscheidet einen 403 von jedem anderen Fehler, damit
 * die aufrufende Komponente (Plan 13-08) zwischen Zustand 2 (Ladefehler) und Zustand 3
 * („Kein Zugriff") entscheiden kann. Die Fehlermeldung selbst bleibt in beiden Faellen die
 * Servermeldung — nur der Sondertext `FORBIDDEN` markiert den 403-Fall eindeutig.
 */
export function useWorkPeriods(userId: number | null) {
  return useQuery({
    queryKey: ['work-periods', userId],
    queryFn: async () => {
      const response = await apiClient.get<WorkTimePeriod[]>(`/work-periods?userId=${userId}`);
      if (!response.success) {
        if (response.status === 403) {
          throw new Error('FORBIDDEN');
        }
        throw new Error(response.error || 'Perioden konnten nicht geladen werden');
      }
      return response.data || [];
    },
    enabled: userId !== null,
    retry: false,
  });
}

/**
 * Berechnet die Vorschau einer Stammdaten-Korrektur serverseitig (D1: eigene, getrennte
 * Aktion). Kein `onSuccess`, das Werte umrechnet — invalidiert nichts (DD-30).
 */
export function useCorrectWorkPeriodPreview() {
  return useMutation({
    mutationFn: async (vars: {
      periodId: number;
      input: Omit<WorkPeriodCorrectionInput, 'periodId' | 'reason'>;
    }) => {
      const response = await apiClient.post<WorkPeriodCorrectionPreviewResponse>(
        `/work-periods/${vars.periodId}/correct/preview`,
        vars.input
      );
      if (!response.success) {
        throw new Error(response.error || 'Die Vorschau konnte nicht berechnet werden');
      }
      return response.data;
    },
  });
}

/**
 * Speichert eine Stammdaten-Korrektur unter Bezug auf ein zuvor ausgestelltes previewToken.
 * Lehnt der Server das Token ab, liefert er `PREVIEW_STALE` (Muster aus Phase 12) — dieser
 * Hook reicht die Servermeldung unveraendert weiter. `userId` wird ausschliesslich fuer die
 * Invalidierung mitgefuehrt, nicht an den Server geschickt (der leitet ihn aus der Periode ab).
 */
export function useCorrectWorkPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      periodId: number;
      userId: number;
      input: WorkPeriodCorrectionInput & { previewToken: string };
    }) => {
      const response = await apiClient.put<WorkPeriodCorrectionOutcome>(
        `/work-periods/${vars.periodId}`,
        vars.input
      );
      if (!response.success) {
        throw new Error(response.error || 'Die Korrektur wurde nicht gespeichert');
      }
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['work-periods', variables.userId] });
      await invalidateUserAffectedQueries(queryClient);
    },
  });
}

/**
 * Berechnet die Vorschau einer Loeschung serverseitig (D2/D3: Soft-Delete plus Storno statt
 * Loeschen, Luecke wird durch die Vorperiode geschlossen). Kein `onSuccess`, das Werte
 * umrechnet — invalidiert nichts (DD-30).
 */
export function useDeleteWorkPeriodPreview() {
  return useMutation({
    mutationFn: async (vars: { periodId: number }) => {
      const response = await apiClient.post<WorkPeriodDeletionPreviewResponse>(
        `/work-periods/${vars.periodId}/delete/preview`,
        {}
      );
      if (!response.success) {
        throw new Error(response.error || 'Die Auswirkung konnte nicht berechnet werden');
      }
      return response.data;
    },
  });
}

/**
 * Loescht eine Periode (Soft-Delete + Storno der zugehoerigen Buchungen) unter Bezug auf ein
 * zuvor ausgestelltes previewToken. `userId` wird ausschliesslich fuer die Invalidierung
 * mitgefuehrt, nicht an den Server geschickt.
 */
export function useDeleteWorkPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      periodId: number;
      userId: number;
      input: WorkPeriodDeletionInput & { previewToken: string };
    }) => {
      const response = await apiClient.delete<WorkPeriodDeletionOutcome>(
        `/work-periods/${vars.periodId}`,
        vars.input
      );
      if (!response.success) {
        throw new Error(response.error || 'Die Periode wurde nicht geloescht');
      }
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['work-periods', variables.userId] });
      await invalidateUserAffectedQueries(queryClient);
    },
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
