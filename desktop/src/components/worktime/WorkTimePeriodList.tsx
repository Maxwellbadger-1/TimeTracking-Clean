import { useMemo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWorkPeriods } from '../../hooks/useWorkTimeChange';
import { getTodayDate, resolveWorkTimePeriodIn } from '../../utils';
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

  /**
   * WR-19 (Code-Review Phase 12): Frueher `useMemo(..., [])`. Die leere Abhaengigkeitsliste
   * fror das Tagesdatum fuer die Lebensdauer der Komponente ein; die Tauri-Anwendung bleibt
   * ueblicherweise ueber Nacht offen, und nach Mitternacht wurden die Badges "Aktuell" und
   * "Geplant" gegen den Vortag bestimmt. `getTodayDate()` ist billig.
   */
  const today = getTodayDate();

  /**
   * WR-06 (Code-Review Phase 12): Die Intervallbedingung war hier je Zeile nachgebaut.
   * `resolveWorkTimePeriodIn()` ist DIE EINE Aufloesungsstelle im Desktop, zeichengleich zu
   * `resolveWorkPeriodIn()` im Server — jede zweite Fassung ist ein Dual-Calculation-Fehler.
   * Die heute gueltige Periode wird deshalb einmal bestimmt und je Zeile nur noch ueber die
   * Id verglichen.
   */
  const currentPeriodId = useMemo(
    () => resolveWorkTimePeriodIn(sortedPeriods, today)?.id ?? null,
    [sortedPeriods, today]
  );

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
            const isCurrent = period.id === currentPeriodId;
            const isPlanned = period.validFrom > today;
            const isHighlighted = highlightPeriodId != null && period.id === highlightPeriodId;

            /**
             * UI-Review Phase 12 (V-2): Frueher `ring-2 ring-red-400` auf dem `<tr>`.
             * Tailwind bildet `ring-*` als `box-shadow` ab; der Schatten liegt also
             * ausserhalb der Zeilenbox. Am 22.08.2026 in headless Edge (dieselbe
             * Blink/WebView2-Engine wie Tauri unter Windows) mit dem echten Markup
             * nachgestellt: Der Schatten wird zwar gemalt — die Annahme, `border-collapse:
             * collapse` unterdruecke ihn, trifft in aktuellem Blink nicht zu —, aber der
             * umgebende `overflow-x-auto`-Container beschneidet ihn. `overflow-x: auto`
             * macht die y-Achse rechnerisch ebenfalls zum Scrollbereich, und die Tabelle
             * ist exakt so breit wie er (`w-full`): Es bleiben zwei rote Querstriche ueber
             * und unter der Zeile, bei der ersten oder letzten Zeile sogar nur einer. Das
             * liest sich als Trennlinie, nicht als Markierung — Zustand 10 kam nicht an.
             * Ersatz: Flaechen- und Randmarkierung auf den Zellen. Zellhintergruende liegen
             * innerhalb der Zeile und koennen nicht beschnitten werden.
             */
            const highlightCellClass = isHighlighted ? 'bg-red-50 dark:bg-red-900/20' : '';
            const highlightFirstCellClass = isHighlighted
              ? 'border-l-4 border-red-500 dark:border-red-400'
              : '';

            return (
              <tr
                key={period.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td
                  className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${highlightCellClass} ${highlightFirstCellClass}`}
                >
                  <div className="flex items-center gap-2">
                    {formatIsoDate(period.validFrom)}
                    {(isCurrent || isPlanned) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {isCurrent ? 'Aktuell' : 'Geplant'}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${highlightCellClass}`}>
                  {period.validTo ? formatIsoDate(period.validTo) : '—'}
                </td>
                <td className={`px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 ${highlightCellClass}`}>
                  {formatWeeklyHours(period.weeklyHours)} h
                </td>
                <td className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${highlightCellClass}`}>
                  {formatWorkSchedule(period)}
                </td>
                {renderActions && (
                  <td className={`px-4 py-3 text-sm text-right ${highlightCellClass}`}>
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
