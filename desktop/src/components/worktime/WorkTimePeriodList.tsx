import { useMemo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWorkPeriods } from '../../hooks/useWorkTimeChange';
import type { WorkTimePeriod, DayName } from '../../types';

interface WorkTimePeriodListProps {
  userId: number;
  /** Zustand 10: hebt die betroffene Zeile hervor (z. B. Ueberlappung). */
  highlightPeriodId?: number | null;
  /** Ist die Prop nicht gesetzt, wird die Aktionsspalte gar nicht gerendert (Schnitt Phase 13). */
  renderActions?: (period: WorkTimePeriod) => ReactNode;
}

const DAY_SHORT_LABELS: Record<DayName, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
};

const DAY_ORDER: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Zeitzonensicheres YYYY-MM-DD von "heute" — kein `toISOString().split('T')[0]`
 *  (`.claude/CLAUDE.md`), Muster aus `desktop/src/hooks/useTimeEntries.ts:80-81`. */
function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatIsoDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

function formatWeeklyHours(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

function formatWorkSchedule(period: WorkTimePeriod): string {
  if (period.workSchedule === null) {
    return 'Standard (5 Tage)';
  }
  const schedule = period.workSchedule;
  return DAY_ORDER
    .filter((day) => schedule[day] > 0)
    .map((day) => `${DAY_SHORT_LABELS[day]} ${formatWeeklyHours(schedule[day])}`)
    .join(' · ');
}

export function WorkTimePeriodList({ userId, highlightPeriodId, renderActions }: WorkTimePeriodListProps) {
  const { data, isLoading, error, refetch } = useWorkPeriods(userId);

  const sortedPeriods = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : 0));
  }, [data]);

  const today = useMemo(() => formatDateLocal(new Date()), []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Perioden konnten nicht geladen werden: {error.message}</p>
        </div>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
            Perioden erneut laden
          </Button>
        </div>
      </div>
    );
  }

  if (sortedPeriods.length === 0) {
    return (
      <div className="py-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Noch kein Stichtag hinterlegt
        </h4>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Für diesen Mitarbeiter gibt es bisher keine Periode mit Stichtag. Es gelten die
          Stammdatenwerte seit dem Eintrittsdatum. Über „Stundenwechsel ab Datum …" tragen Sie die
          erste Umstellung ein.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Gültig ab
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Gültig bis
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
              Wochenstunden
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Tagesplan
            </th>
            {renderActions && (
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedPeriods.map((period) => {
            const isCurrent = period.validFrom <= today && (period.validTo === null || period.validTo > today);
            const isPlanned = period.validFrom > today;
            const isHighlighted = highlightPeriodId != null && period.id === highlightPeriodId;

            return (
              <tr
                key={period.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  isHighlighted ? 'ring-2 ring-red-400' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    {formatIsoDate(period.validFrom)}
                    {(isCurrent || isPlanned) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {isCurrent ? 'Aktuell' : 'Geplant'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {period.validTo ? formatIsoDate(period.validTo) : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                  {formatWeeklyHours(period.weeklyHours)} h
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {formatWorkSchedule(period)}
                </td>
                {renderActions && (
                  <td className="px-4 py-3 text-sm text-right">
                    {renderActions(period)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
