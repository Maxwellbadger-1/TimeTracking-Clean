/**
 * TanStack Query Hooks for Holidays
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
// WR-21: EINE Stelle fuer das geladene Jahresfenster — der Ladecode unten und die Pruefung
// in `AbsenceRequestForm` duerfen nicht auseinanderlaufen.
import { getHolidayWindowYears } from './holidayWindow';

export { HOLIDAY_WINDOW_RADIUS_YEARS, getHolidayWindowYears, isYearInHolidayWindow } from './holidayWindow';

export interface Holiday {
  id: number;
  date: string;
  name: string;
  federal: number;
}

/**
 * CR-05 (Code-Review Phase 12): `apiClient.request()` WIRFT bei einem Serverfehler nicht,
 * sondern liefert `{ success: false, error, data: undefined }` (`src/api/client.ts`).
 * Beide Hooks hier prueften `response.success` nicht und lieferten deshalb stumm `[]` —
 * ein Ladefehler war von "es gibt keine Feiertage" nicht zu unterscheiden.
 *
 * Konkrete Wirkung im `AbsenceRequestForm`: `holidaysError` wurde nie wahr, der dort
 * ausdruecklich gebaute Schutz `previewUnavailable` war ein Scheinschutz, jeder Feiertag
 * zaehlte als voller Arbeitstag — und die Pruefung "Du hast nur noch {n} Urlaubstage
 * verfuegbar" blockierte damit einen sachlich zulaessigen Weihnachtsurlaub, ohne dass
 * irgendetwas auf den Ladefehler hinwies.
 */

/**
 * Get all holidays for a specific year
 * @param year - Year to fetch holidays for (defaults to current year on backend)
 */
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      // Note: Backend defaults to current year if no year provided
      const response = await apiClient.get<Holiday[]>(`/holidays${params}`);
      if (!response.success) {
        throw new Error(response.error || 'Feiertage konnten nicht geladen werden');
      }
      return response.data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get holidays for current year
 */
export function useCurrentYearHolidays() {
  const currentYear = new Date().getFullYear();
  return useHolidays(currentYear);
}

/**
 * Get holidays for past 2 years + current year + next 2 years (5 years total)
 * Best practice: Covers historical data + future planning
 * Example (2026): 2024, 2025, 2026, 2027, 2028
 */
export function useMultiYearHolidays() {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['holidays', 'multi-year', currentYear],
    queryFn: async () => {
      // Load: -2, -1, current, +1, +2 years (5 years total) — EINE Stelle, damit
      // `isYearInHolidayWindow()` und dieser Ladecode nicht auseinanderlaufen (WR-21).
      const years = getHolidayWindowYears();
      const allHolidays: Holiday[] = [];

      // Fetch holidays for all 5 years
      for (const year of years) {
        const response = await apiClient.get<Holiday[]>(`/holidays?year=${year}`);
        // CR-05: Ein Fehlschlag ist ein Fehler, kein leeres Jahr. Ein unvollstaendiges
        // Feiertagsfenster wuerde eine falsche Abwesenheitsvorschau erzeugen.
        if (!response.success) {
          throw new Error(response.error || `Feiertage ${year} konnten nicht geladen werden`);
        }
        allHolidays.push(...(response.data || []));
      }

      return allHolidays;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - holidays don't change often
  });
}
